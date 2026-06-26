import { MAX_SLOTS } from "./types.js";

const STORAGE_KEY = "multiview.room";

export function createDefaultRoom() {
  return {
    slots: Array.from({ length: MAX_SLOTS }, (_, index) => ({
      index,
      source: null,
      muted: true,
      volume: 80,
      active: false
    })),
    layout: "single",
    activeSlotIndex: null,
    updatedAt: new Date().toISOString()
  };
}

export async function loadRoom() {
  if (globalThis.chrome?.storage?.local) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeRoom(result[STORAGE_KEY]);
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  return normalizeRoom(raw ? JSON.parse(raw) : null);
}

export async function saveRoom(room) {
  const nextRoom = {
    ...normalizeRoom(room),
    updatedAt: new Date().toISOString()
  };

  if (globalThis.chrome?.storage?.local) {
    await chrome.storage.local.set({ [STORAGE_KEY]: nextRoom });
    return nextRoom;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRoom));
  return nextRoom;
}

export function upsertSourceInRoom(room, source) {
  const nextRoom = normalizeRoom(room);
  if (!source?.id) {
    return nextRoom;
  }

  const existingIndex = nextRoom.slots.findIndex((slot) => slot.source?.id === source.id);
  const targetIndex = existingIndex >= 0
    ? existingIndex
    : nextRoom.slots.findIndex((slot) => !slot.source);

  if (targetIndex < 0) {
    throw new Error("A sala ja esta cheia.");
  }

  const shouldFocus = nextRoom.slots.every((slot) => !slot.source);
  nextRoom.slots[targetIndex] = {
    ...nextRoom.slots[targetIndex],
    source,
    active: shouldFocus,
    muted: !shouldFocus
  };

  if (shouldFocus) {
    nextRoom.activeSlotIndex = targetIndex;
  }

  nextRoom.layout = getLayoutMode(nextRoom.slots);
  return nextRoom;
}

export function getLayoutMode(slots) {
  const count = slots.filter((slot) => slot.source).length;
  if (count <= 1) return "single";
  if (count === 2) return "two-columns";
  if (count === 3) return "three-grid";
  return "four-grid";
}

export function normalizeRoom(room) {
  const base = createDefaultRoom();
  if (!room || !Array.isArray(room.slots)) {
    return base;
  }

  const slots = base.slots.map((slot, index) => {
    const saved = room.slots[index] || {};
    return {
      index,
      source: saved.source || null,
      muted: saved.muted !== false,
      volume: clampVolume(saved.volume ?? 80),
      active: Boolean(saved.active)
    };
  });

  const activeSlotIndex = Number.isInteger(room.activeSlotIndex)
    ? room.activeSlotIndex
    : slots.find((slot) => slot.active)?.index ?? null;

  return {
    slots,
    layout: getLayoutMode(slots),
    activeSlotIndex,
    updatedAt: room.updatedAt || base.updatedAt
  };
}

function clampVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 80;
  return Math.max(0, Math.min(100, Math.round(number)));
}
