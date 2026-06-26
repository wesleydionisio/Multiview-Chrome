import { test, beforeEach } from "node:test";
import assert from "node:assert";

// Mock da API chrome.storage
const mockStorage = {};
globalThis.chrome = {
  storage: {
    local: {
      get: async (key) => {
        return { [key]: mockStorage[key] };
      },
      set: async (data) => {
        Object.assign(mockStorage, data);
      }
    }
  }
};

// Importar os modulos a serem testados apos configurar o mock
import {
  createDefaultRoom,
  loadRoom,
  saveRoom,
  upsertSourceInRoom,
  getLayoutMode,
  normalizeRoom
} from "../shared/store.js";

beforeEach(() => {
  // Limpar o storage mockado antes de cada teste
  for (const key in mockStorage) {
    delete mockStorage[key];
  }
});

test("createDefaultRoom - gera sala padrão vazia", () => {
  const room = createDefaultRoom();
  assert.strictEqual(room.slots.length, 4);
  assert.strictEqual(room.layout, "single");
  assert.strictEqual(room.activeSlotIndex, null);
  assert.ok(room.slots.every((slot) => slot.source === null));
  assert.ok(room.slots.every((slot) => slot.muted === true));
});

test("getLayoutMode - escolhe layout adequado dependendo do numero de slots ocupados", () => {
  const slots = (count) => Array.from({ length: 4 }, (_, i) => ({
    source: i < count ? { id: "video" + i } : null
  }));

  assert.strictEqual(getLayoutMode(slots(0)), "single");
  assert.strictEqual(getLayoutMode(slots(1)), "single");
  assert.strictEqual(getLayoutMode(slots(2)), "two-columns");
  assert.strictEqual(getLayoutMode(slots(3)), "three-grid");
  assert.strictEqual(getLayoutMode(slots(4)), "four-grid");
});

test("upsertSourceInRoom - adiciona e atualiza fontes corretamente", () => {
  let room = createDefaultRoom();
  const source1 = { id: "5qap5aO4i9A", url: "https://youtu.be/5qap5aO4i9A", title: "Video 1" };
  const source2 = { id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ", title: "Video 2" };

  // Adicionar primeiro vídeo (deve focar e desmutar por padrão se for o primeiro)
  room = upsertSourceInRoom(room, source1);
  assert.strictEqual(room.slots[0].source.id, "5qap5aO4i9A");
  assert.strictEqual(room.slots[0].active, true);
  assert.strictEqual(room.slots[0].muted, false);
  assert.strictEqual(room.activeSlotIndex, 0);
  assert.strictEqual(room.layout, "single");

  // Adicionar segundo vídeo (não deve focar por padrão)
  room = upsertSourceInRoom(room, source2);
  assert.strictEqual(room.slots[1].source.id, "dQw4w9WgXcQ");
  assert.strictEqual(room.slots[1].active, false);
  assert.strictEqual(room.slots[1].muted, true);
  assert.strictEqual(room.layout, "two-columns");
});

test("upsertSourceInRoom - lanca erro se tentar adicionar em sala cheia", () => {
  let room = createDefaultRoom();
  
  for (let i = 0; i < 4; i++) {
    room = upsertSourceInRoom(room, { id: `video-${i}` });
  }

  assert.throws(() => {
    upsertSourceInRoom(room, { id: "video-extra" });
  }, /A sala ja esta cheia/);
});

test("loadRoom e saveRoom - interage com storage local", async () => {
  const defaultRoom = await loadRoom();
  assert.strictEqual(defaultRoom.activeSlotIndex, null);

  const modifiedRoom = createDefaultRoom();
  modifiedRoom.activeSlotIndex = 2;
  modifiedRoom.slots[2].source = { id: "video-id" };

  await saveRoom(modifiedRoom);

  const loadedRoom = await loadRoom();
  assert.strictEqual(loadedRoom.activeSlotIndex, 2);
  assert.strictEqual(loadedRoom.slots[2].source.id, "video-id");
});
