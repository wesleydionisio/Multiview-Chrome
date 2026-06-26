import { sourceFromUrl } from "../shared/youtube-url-parser.js";
import { createDefaultRoom, getLayoutMode, loadRoom, saveRoom, upsertSourceInRoom } from "../shared/store.js";
import { YouTubeIframeAdapter } from "./player-adapter.js";

const grid = document.querySelector("#grid");
const emptyState = document.querySelector("#emptyState");
const addSourceForm = document.querySelector("#addSourceForm");
const sourceUrlInput = document.querySelector("#sourceUrl");
const muteAllButton = document.querySelector("#muteAll");
const clearRoomButton = document.querySelector("#clearRoom");

class MultiviewRoom {
  constructor() {
    this.state = createDefaultRoom();
    this.adapters = new Map();
    this.blockedVideos = new Set();
  }

  async initBlockedVideos() {
    if (globalThis.chrome?.storage?.local) {
      try {
        const data = await chrome.storage.local.get("multiview.blockedVideos");
        if (data["multiview.blockedVideos"]) {
          this.blockedVideos = new Set(data["multiview.blockedVideos"]);
        }
      } catch (err) {
        console.error("Failed to load blocked videos:", err);
      }
    }
  }

  async markVideoBlocked(videoId) {
    if (this.blockedVideos.has(videoId)) return;
    console.log(`[MultiviewRoom] Marking video ${videoId} as blocked for embed`);
    this.blockedVideos.add(videoId);
    if (globalThis.chrome?.storage?.local) {
      try {
        await chrome.storage.local.set({
          "multiview.blockedVideos": Array.from(this.blockedVideos)
        });
      } catch (err) {
        console.error("Failed to save blocked videos:", err);
      }
    }
    
    // Find slot playing this video and reload it!
    const slot = this.state.slots.find(s => s.source && s.source.id === videoId);
    if (slot) {
      console.log(`[MultiviewRoom] Reloading slot ${slot.index} with watch page for video ${videoId}`);
      const slotElement = grid.querySelector(`[data-slot-index="${slot.index}"]`);
      if (slotElement) {
        this.adapters.get(slot.index)?.destroy();
        this.adapters.delete(slot.index);
        
        const playerMount = slotElement.querySelector(".player-mount");
        const adapter = new YouTubeIframeAdapter(playerMount);
        adapter.load(slot.source, { muted: slot.muted, useWatchPage: true });
        adapter.setVolume(slot.volume);
        if (slot.muted) adapter.mute();
        this.adapters.set(slot.index, adapter);
        // No onEmbedBlocked callback here — already using watch page
      }
    }
  }

  async load() {
    this.state = await loadRoom();
    await this.initBlockedVideos();
    this.render();
  }

  async addSource(source) {
    this.state = upsertSourceInRoom(this.state, source);
    await this.persistAndRender();
  }

  async removeSource(slotIndex) {
    if (sourceUrlInput) {
      sourceUrlInput.setCustomValidity("");
    }
    const adapter = this.adapters.get(slotIndex);
    if (adapter) {
      adapter.destroy();
      this.adapters.delete(slotIndex);
    }

    this.state.slots[slotIndex] = {
      ...this.state.slots[slotIndex],
      source: null,
      muted: true,
      active: false
    };

    if (this.state.activeSlotIndex === slotIndex) {
      this.state.activeSlotIndex = null;
      const nextFilled = this.state.slots.find((slot) => slot.source);
      if (nextFilled) {
        await this.focusSlot(nextFilled.index);
        return;
      }
    }

    this.state.layout = getLayoutMode(this.state.slots);
    await this.persistAndRender();
  }

  async focusSlot(slotIndex, shouldPersist = true) {
    this.state.activeSlotIndex = slotIndex;
    this.state.slots = this.state.slots.map((slot) => {
      const isActive = slot.index === slotIndex && Boolean(slot.source);
      const adapter = this.adapters.get(slot.index);
      if (adapter && slot.source) {
        if (isActive) {
          adapter.unmute();
          adapter.setVolume(slot.volume);
        } else {
          adapter.mute();
        }
      }

      return {
        ...slot,
        active: isActive,
        muted: !isActive
      };
    });

    if (shouldPersist) {
      await this.persistAndRender(false);
    } else {
      this.render();
    }
  }

  async muteAll() {
    this.state.activeSlotIndex = null;
    this.state.slots = this.state.slots.map((slot) => {
      const adapter = this.adapters.get(slot.index);
      if (adapter) adapter.mute();
      return {
        ...slot,
        active: false,
        muted: true
      };
    });
    await this.persistAndRender(false);
  }

  async setVolume(slotIndex, volume) {
    const slot = this.state.slots[slotIndex];
    if (!slot) return;

    slot.volume = Math.max(0, Math.min(100, Number(volume) || 0));
    const adapter = this.adapters.get(slotIndex);
    if (adapter && !slot.muted) {
      adapter.setVolume(slot.volume);
    }

    this.state = await saveRoom(this.state);
    this.updateSlotChrome(slot);
  }

  async clear() {
    if (sourceUrlInput) {
      sourceUrlInput.setCustomValidity("");
    }
    for (const adapter of this.adapters.values()) {
      adapter.destroy();
    }
    this.adapters.clear();
    this.state = createDefaultRoom();
    await this.persistAndRender();
  }

  async persistAndRender(reloadPlayers = true) {
    this.state.layout = getLayoutMode(this.state.slots);
    this.state = await saveRoom(this.state);
    this.render(reloadPlayers);
  }

  render(_reloadPlayers = true) {
    const filledSlots = this.state.slots.filter((slot) => slot.source);
    const count = filledSlots.length;

    grid.className = `multiview-grid count-${count}`;
    emptyState.classList.toggle("is-hidden", count > 0);

    const visibleIndexes = new Set(filledSlots.map((slot) => slot.index));
    for (const [index, adapter] of this.adapters.entries()) {
      if (!visibleIndexes.has(index)) {
        adapter.destroy();
        this.adapters.delete(index);
        grid.querySelector(`[data-slot-index="${index}"]`)?.remove();
      }
    }

    for (const slotElement of grid.querySelectorAll(".multiview-slot")) {
      const index = Number(slotElement.dataset.slotIndex);
      if (!visibleIndexes.has(index)) {
        slotElement.remove();
      }
    }

    for (const slot of filledSlots) {
      const existing = grid.querySelector(`[data-slot-index="${slot.index}"]`);
      if (existing?.dataset.sourceId === slot.source.id) {
        this.updateSlotChrome(slot);
        grid.append(existing);
        continue;
      }

      if (existing) {
        this.adapters.get(slot.index)?.destroy();
        this.adapters.delete(slot.index);
        existing.remove();
      }

      const slotElement = this.createSlotElement(slot);
      slotElement.dataset.sourceId = slot.source.id;
      grid.append(slotElement);
      const playerMount = slotElement.querySelector(".player-mount");
      const adapter = new YouTubeIframeAdapter(playerMount);
      const useWatchPage = this.blockedVideos.has(slot.source.id);
      if (!useWatchPage) {
        adapter.onEmbedBlocked = (videoId) => {
          console.log("[MultiviewRoom] onEmbedBlocked fired for:", videoId);
          this.markVideoBlocked(videoId);
        };
      }
      adapter.load(slot.source, { muted: slot.muted, useWatchPage });
      adapter.setVolume(slot.volume);
      if (slot.muted) adapter.mute();
      this.adapters.set(slot.index, adapter);
    }
  }

  createSlotElement(slot) {
    const slotElement = document.createElement("article");
    slotElement.className = `multiview-slot${slot.active ? " active" : ""}`;
    slotElement.dataset.slotIndex = String(slot.index);

    slotElement.innerHTML = `
      <div class="player-mount"></div>
      <div class="slot-topbar">
        <div class="slot-title">
          <span class="slot-number">${slot.index + 1}</span>
          <span class="slot-name"></span>
        </div>
        <div class="slot-actions">
          <button class="slot-control audio-control" type="button" title="Usar audio deste slot" aria-label="Usar audio deste slot">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM15 9.5a4 4 0 0 1 0 5M18 7a8 8 0 0 1 0 10"/></svg>
          </button>
          <button class="slot-control remove-control danger" type="button" title="Remover slot" aria-label="Remover slot">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <label class="slot-volume">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4zM15 9.5a4 4 0 0 1 0 5M18 7a8 8 0 0 1 0 10"/></svg>
        <input class="volume-control" type="range" min="0" max="100" step="1">
        <span class="volume-value"></span>
      </label>
    `;

    slotElement.querySelector(".audio-control").addEventListener("click", () => this.focusSlot(slot.index));
    slotElement.querySelector(".remove-control").addEventListener("click", () => this.removeSource(slot.index));
    slotElement.addEventListener("dblclick", () => this.focusSlot(slot.index));
    slotElement.querySelector(".volume-control").addEventListener("input", (event) => {
      this.setVolume(slot.index, event.currentTarget.value);
    });

    this.updateSlotChrome(slot, slotElement);
    return slotElement;
  }

  updateSlotChrome(slot, element = null) {
    const slotElement = element || grid.querySelector(`[data-slot-index="${slot.index}"]`);
    if (!slotElement) return;

    slotElement.classList.toggle("active", slot.active);
    slotElement.querySelector(".slot-name").textContent = slot.source?.title || `YouTube ${slot.source?.id || ""}`;
    slotElement.querySelector(".audio-control").classList.toggle("active-audio", slot.active);
    slotElement.querySelector(".volume-control").value = String(slot.volume);
    slotElement.querySelector(".volume-value").textContent = `${slot.volume}%`;
  }
}

const room = new MultiviewRoom();
await room.load();

addSourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const source = sourceFromUrl(sourceUrlInput.value);
  if (!source) {
    sourceUrlInput.setCustomValidity("Cole uma URL valida do YouTube.");
    sourceUrlInput.reportValidity();
    return;
  }

  sourceUrlInput.setCustomValidity("");
  try {
    await room.addSource(source);
    sourceUrlInput.value = "";
  } catch (error) {
    sourceUrlInput.setCustomValidity(error.message || "Nao foi possivel adicionar essa URL.");
    sourceUrlInput.reportValidity();
  }
});

sourceUrlInput.addEventListener("input", () => {
  sourceUrlInput.setCustomValidity("");
});

muteAllButton.addEventListener("click", () => room.muteAll());
clearRoomButton.addEventListener("click", () => room.clear());

globalThis.chrome?.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes["multiview.room"]) return;
  const nextState = changes["multiview.room"].newValue || createDefaultRoom();
  if (nextState.updatedAt === room.state.updatedAt) return;
  room.state = nextState;
  room.render();
});

globalThis.chrome?.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
  if (message?.type === "YOUTUBE_EMBED_BLOCKED") {
    const { videoId } = message;
    console.log("[Multiview] Received YOUTUBE_EMBED_BLOCKED for:", videoId);
    if (room) {
      room.markVideoBlocked(videoId);
    }
  }
});
