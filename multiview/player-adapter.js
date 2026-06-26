import { PLAYER_RELAY_URL } from "../shared/config.js";

const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com";
const YOUTUBE_ORIGINS = new Set([
  "https://www.youtube-nocookie.com",
  "https://www.youtube.com",
  "https://youtube.com"
]);

export class YouTubeIframeAdapter {
  constructor(container) {
    this.container = container;
    this.iframe = document.createElement("iframe");
    this.iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    this.iframe.allowFullscreen = true;
    this.iframe.referrerPolicy = "strict-origin-when-cross-origin";
    this.iframe.title = "YouTube player";
    this.source = null;
    this.isReady = false;
    this.pendingCommands = [];
    this.commandTargetOrigin = YOUTUBE_EMBED_ORIGIN;
    this._onEmbedBlocked = null;
    this._embedBlockNotified = false;

    console.log("[PlayerAdapter] Init. YOUTUBE_EMBED_ORIGIN:", YOUTUBE_EMBED_ORIGIN, "window.location.origin:", window.location.origin);
    if (globalThis.chrome?.declarativeNetRequest) {
      chrome.declarativeNetRequest.getEnabledRulesets().then(rulesets => {
        console.log("[PlayerAdapter] Enabled DNR rulesets:", rulesets);
      }).catch(err => {
        console.error("[PlayerAdapter] Failed to get DNR rulesets:", err);
      });
    } else {
      console.warn("[PlayerAdapter] chrome.declarativeNetRequest is not available");
    }

    this.iframe.addEventListener("load", () => {
      console.log("[PlayerAdapter] Iframe loaded event fired. Source:", this.source?.id, "Ready:", this.isReady);
      if (!this.source) return;
      this.isReady = true;
      this.flushCommands();
    });

    // Listen for YouTube IFrame API postMessage events (error detection)
    this._messageHandler = (event) => {
      if (!this.source) return;
      if (!YOUTUBE_ORIGINS.has(event.origin)) return;

      let data = event.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch (_e) { return; }
      }
      if (!data) return;

      // YouTube IFrame API error codes:
      // 101 = video owner does not allow embedded playback
      // 150 = same as 101 (used by content owners like LiveMode O&O)
      if (data.event === "onError" && (data.info === 150 || data.info === 101)) {
        console.warn("[PlayerAdapter] YouTube embed BLOCKED (error", data.info, ") for:", this.source.id);
        this._notifyEmbedBlocked();
      }
    };
    window.addEventListener("message", this._messageHandler);

    this.container.append(this.iframe);
  }

  set onEmbedBlocked(callback) {
    this._onEmbedBlocked = callback;
  }

  _notifyEmbedBlocked() {
    if (this._embedBlockNotified) return;
    this._embedBlockNotified = true;
    if (this._onEmbedBlocked && this.source) {
      this._onEmbedBlocked(this.source.id);
    }
  }

  load(source, options = {}) {
    console.log("[PlayerAdapter] load() called for source:", source.id, "with options:", options);
    this.source = source;
    this.isReady = false;
    this._embedBlockNotified = false;
    this.pendingCommands = [];
    const muted = options.muted ?? true;
    const params = new URLSearchParams({
      autoplay: "1",
      mute: muted ? "1" : "0",
      playsinline: "1",
      enablejsapi: "1",
      origin: window.location.origin,
      rel: "0",
      modestbranding: "1"
    });

    const finalUrl = this.createPlayerUrl(source, params, options);
    console.log("[PlayerAdapter] Setting iframe.src to:", finalUrl);
    this.iframe.src = finalUrl;
  }

  play() {
    this.command("playVideo");
  }

  pause() {
    this.command("pauseVideo");
  }

  mute() {
    this.command("mute");
  }

  unmute() {
    this.command("unMute");
  }

  setVolume(value) {
    this.command("setVolume", [Math.max(0, Math.min(100, Number(value) || 0))]);
  }

  destroy() {
    window.removeEventListener("message", this._messageHandler);
    this.iframe.remove();
    this.source = null;
    this.isReady = false;
    this._embedBlockNotified = false;
    this.pendingCommands = [];
  }

  command(func, args = []) {
    if (!this.isReady) {
      this.pendingCommands.push({ func, args });
      return;
    }

    this.postCommand(func, args);
  }

  flushCommands() {
    const commands = this.pendingCommands.splice(0);
    for (const { func, args } of commands) {
      this.postCommand(func, args);
    }
  }

  postCommand(func, args = []) {
    if (!this.iframe.contentWindow) return;

    try {
      this.iframe.contentWindow.postMessage(this.createCommandMessage(func, args), this.commandTargetOrigin);
    } catch (_error) {
      this.isReady = false;
      this.pendingCommands.unshift({ func, args });
    }
  }

  createPlayerUrl(source, playerParams, options = {}) {
    if (options.useWatchPage) {
      this.commandTargetOrigin = "https://www.youtube.com";
      const watchParams = new URLSearchParams({
        v: source.id,
        multiview: "1",
        autoplay: playerParams.get("autoplay") || "1",
        mute: playerParams.get("mute") || "1"
      });
      return `https://www.youtube.com/watch?${watchParams.toString()}`;
    }

    if (PLAYER_RELAY_URL) {
      const relayUrl = new URL(PLAYER_RELAY_URL);
      relayUrl.searchParams.set("v", source.id);
      relayUrl.searchParams.set("autoplay", playerParams.get("autoplay") || "1");
      relayUrl.searchParams.set("mute", playerParams.get("mute") || "1");
      relayUrl.searchParams.set("parentOrigin", window.location.origin);
      this.commandTargetOrigin = relayUrl.origin;
      return relayUrl.toString();
    }

    this.commandTargetOrigin = YOUTUBE_EMBED_ORIGIN;
    return `${YOUTUBE_EMBED_ORIGIN}/embed/${source.id}?${playerParams.toString()}`;
  }

  createCommandMessage(func, args) {
    if (PLAYER_RELAY_URL || this.commandTargetOrigin === "https://www.youtube.com") {
      return {
        type: "MULTIVIEW_PLAYER_COMMAND",
        func,
        args
      };
    }

    return JSON.stringify({
      event: "command",
      func,
      args
    });
  }
}
