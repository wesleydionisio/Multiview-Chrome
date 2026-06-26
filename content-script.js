(() => {
  const isWatchPage = window.location.pathname.includes("/watch");
  const isMultiview = window.location.search.includes("multiview=1");

  if (isWatchPage && isMultiview) {
    // Inject hiding styles immediately at document_start
    const style = document.createElement("style");
    style.textContent = `
      html, body {
        overflow: hidden !important;
        background: #000000 !important;
      }
      ytd-masthead,
      #masthead-container,
      ytd-mini-guide-renderer,
      #guide,
      #secondary,
      #comments,
      #footer,
      #related,
      ytd-merch-shelf-renderer,
      ytd-live-chat-frame,
      #above-the-fold,
      #bottom-row,
      .ytp-youtube-button,
      .ytp-share-button {
        display: none !important;
        visibility: hidden !important;
      }
      ytd-app,
      #page-manager,
      #content,
      ytd-watch-flexy,
      #columns,
      #primary,
      #primary-inner,
      #player,
      #player-container-grid,
      #player-grid-container,
      #player-container-outer,
      #player-container-inner,
      #player-container {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: 100% !important;
        max-width: none !important;
        max-height: none !important;
      }
      #movie_player,
      .html5-video-player,
      .html5-main-video {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 999999 !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  // Helper to extract Video ID
  const getVideoIdFromUrl = (url) => {
    const match = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
    const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];
    return null;
  };

  // Check for embed block (e.g. LiveMode O&O, CazéTV)
  const checkForEmbedBlock = () => {
    const errorScreen = document.querySelector(".ytp-error") || document.querySelector(".ytp-error-message-container");
    const isBlocked = errorScreen && (
      document.body.textContent.includes("Watch on YouTube") ||
      document.body.textContent.includes("Assista no YouTube") ||
      document.body.textContent.includes("blocked it from display") ||
      document.body.textContent.includes("bloqueou")
    );

    if (isBlocked) {
      console.log("[Multiview ContentScript] Embed block detected!");
      const videoId = getVideoIdFromUrl(window.location.href);
      if (videoId) {
        chrome.runtime.sendMessage({
          type: "YOUTUBE_EMBED_BLOCKED",
          videoId: videoId
        });
      }
    }
  };

  const injectMainWorldScript = () => {
    const scriptId = "multiview-main-world-script";
    if (document.getElementById(scriptId)) return;

    const script = document.createElement("script");
    script.id = scriptId;
    script.textContent = `
      console.log("[Multiview Main World] Script injected.");
      
      const attemptAutoplay = () => {
        const video = document.querySelector("video");
        if (video) {
          video.muted = true;
          video.play().catch(e => console.log("[Multiview] Autoplay failed:", e));
        }
      };
      
      window.addEventListener("MULTIVIEW_MAIN_COMMAND", (event) => {
        const { func, args } = event.detail;
        const player = document.getElementById("movie_player");
        console.log("[Multiview Main World] Command:", func, args);
        
        if (player && typeof player[func] === "function") {
          try {
            player[func](...args);
          } catch (e) {
            console.error("[Multiview Main World] Player error:", func, e);
          }
        } else {
          const videoEl = document.querySelector("video");
          if (videoEl) {
            if (func === "playVideo") videoEl.play().catch(e => console.error(e));
            else if (func === "pauseVideo") videoEl.pause();
            else if (func === "mute") videoEl.muted = true;
            else if (func === "unMute") videoEl.muted = false;
            else if (func === "setVolume") videoEl.volume = args[0] / 100;
          }
        }
      });
      
      let checks = 0;
      const autoplayInterval = setInterval(() => {
        const video = document.querySelector("video");
        if (video) {
          attemptAutoplay();
          clearInterval(autoplayInterval);
        }
        checks++;
        if (checks > 20) clearInterval(autoplayInterval);
      }, 250);
    `;
    (document.head || document.documentElement).appendChild(script);
  };

  // Main listener for DOM loading
  const init = () => {
    if (isWatchPage && isMultiview) {
      injectMainWorldScript();
      
      // Setup message listener to forward events to the main world
      window.addEventListener("message", (event) => {
        const data = event.data;
        if (!data) return;

        let parsed = null;
        if (typeof data === "string") {
          try {
            parsed = JSON.parse(data);
          } catch (e) {}
        } else if (typeof data === "object") {
          parsed = data;
        }

        if (parsed && (parsed.event === "command" || parsed.type === "MULTIVIEW_PLAYER_COMMAND")) {
          const func = parsed.func;
          const args = parsed.args || [];
          window.dispatchEvent(new CustomEvent("MULTIVIEW_MAIN_COMMAND", {
            detail: { func, args }
          }));
        }
      });
    }

    const isEmbedPage = window.location.pathname.includes("/embed/");
    if (isEmbedPage) {
      let checks = 0;
      const interval = setInterval(() => {
        checkForEmbedBlock();
        checks++;
        if (checks > 10) clearInterval(interval);
      }, 500);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Keep existing behavior for getting current source details
  const getCurrentYouTubeUrl = () => window.location.href;
  const getCurrentTitle = () => {
    const title = document.querySelector("h1 yt-formatted-string")?.textContent?.trim();
    return title || document.title.replace(/\s*-\s*YouTube\s*$/i, "").trim();
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "GET_CURRENT_YOUTUBE_SOURCE") {
      return false;
    }

    sendResponse({
      ok: true,
      url: getCurrentYouTubeUrl(),
      title: getCurrentTitle()
    });

    return false;
  });
})();
