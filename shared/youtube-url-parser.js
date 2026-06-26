const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export function parseYouTubeVideoId(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  if (VIDEO_ID_PATTERN.test(raw)) {
    return raw;
  }

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return normalizeVideoId(url.pathname.split("/").filter(Boolean)[0]);
    }

    if (!host.endsWith("youtube.com")) {
      return null;
    }

    const fromSearch = normalizeVideoId(url.searchParams.get("v"));
    if (fromSearch) {
      return fromSearch;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) => ["embed", "shorts", "live"].includes(part));
    if (marker >= 0) {
      return normalizeVideoId(parts[marker + 1]);
    }
  } catch (_error) {
    return null;
  }

  return null;
}

export function sourceFromUrl(input, title = "") {
  const id = parseYouTubeVideoId(input);
  if (!id) return null;

  return {
    id,
    url: String(input || "").trim(),
    title: cleanTitle(title),
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    isLive: undefined
  };
}

export function cleanTitle(title) {
  return String(title || "")
    .replace(/\s*-\s*YouTube\s*$/i, "")
    .trim();
}

function normalizeVideoId(value) {
  if (!value) return null;
  const id = String(value).trim();
  return VIDEO_ID_PATTERN.test(id) ? id : null;
}
