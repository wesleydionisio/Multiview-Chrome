import { sourceFromUrl } from "../shared/youtube-url-parser.js";
import { createDefaultRoom, loadRoom, saveRoom, upsertSourceInRoom } from "../shared/store.js";

const addCurrentButton = document.querySelector("#addCurrent");
const openRoomButton = document.querySelector("#openRoom");
const manualForm = document.querySelector("#manualForm");
const youtubeUrlInput = document.querySelector("#youtubeUrl");
const currentStatus = document.querySelector("#currentStatus");
const message = document.querySelector("#message");

let currentSource = null;

init();

async function init() {
  currentSource = await getCurrentTabSource();
  if (currentSource) {
    currentStatus.textContent = currentSource.title || `Video ${currentSource.id}`;
    addCurrentButton.disabled = false;
  } else {
    currentStatus.textContent = "Abra uma live ou video do YouTube para capturar automaticamente.";
  }
}

addCurrentButton.addEventListener("click", async () => {
  if (!currentSource) return;
  await addSourceAndOpen(currentSource);
});

openRoomButton.addEventListener("click", openRoom);

manualForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const source = sourceFromUrl(youtubeUrlInput.value);
  if (!source) {
    showMessage("Nao consegui identificar um videoId nessa URL.", true);
    return;
  }

  await addSourceAndOpen(source);
});

async function getCurrentTabSource() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    return null;
  }

  const fromTabUrl = sourceFromUrl(tab.url, tab.title);
  if (!fromTabUrl || !tab.id) {
    return fromTabUrl;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_CURRENT_YOUTUBE_SOURCE" });
    if (response?.ok) {
      return sourceFromUrl(response.url || tab.url, response.title || tab.title) || fromTabUrl;
    }
  } catch (_error) {
    return fromTabUrl;
  }

  return fromTabUrl;
}

async function addSourceAndOpen(source) {
  try {
    const room = await loadRoom();
    const nextRoom = upsertSourceInRoom(room || createDefaultRoom(), source);
    await saveRoom(nextRoom);
    showMessage("Adicionado a sala.");
    await openRoom();
  } catch (error) {
    showMessage(error.message || "Nao foi possivel adicionar a fonte.", true);
  }
}

async function openRoom() {
  await chrome.tabs.create({
    url: chrome.runtime.getURL("multiview/multiview.html")
  });
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}
