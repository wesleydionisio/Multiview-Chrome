import { test } from "node:test";
import assert from "node:assert";
import { parseYouTubeVideoId, sourceFromUrl, cleanTitle } from "../shared/youtube-url-parser.js";

test("parseYouTubeVideoId - links validos do YouTube", () => {
  const expectedId = "5qap5aO4i9A";

  // Watch URL padrao
  assert.strictEqual(parseYouTubeVideoId("https://www.youtube.com/watch?v=5qap5aO4i9A"), expectedId);
  assert.strictEqual(parseYouTubeVideoId("https://youtube.com/watch?v=5qap5aO4i9A"), expectedId);
  
  // Link encurtado youtu.be
  assert.strictEqual(parseYouTubeVideoId("https://youtu.be/5qap5aO4i9A"), expectedId);
  
  // Embed URL
  assert.strictEqual(parseYouTubeVideoId("https://www.youtube.com/embed/5qap5aO4i9A"), expectedId);
  
  // Shorts URL
  assert.strictEqual(parseYouTubeVideoId("https://www.youtube.com/shorts/5qap5aO4i9A"), expectedId);
  
  // Live URL
  assert.strictEqual(parseYouTubeVideoId("https://www.youtube.com/live/5qap5aO4i9A"), expectedId);
  
  // ID do video direto (11 caracteres)
  assert.strictEqual(parseYouTubeVideoId("5qap5aO4i9A"), expectedId);
});

test("parseYouTubeVideoId - links com parametros adicionais", () => {
  const expectedId = "5qap5aO4i9A";
  
  assert.strictEqual(
    parseYouTubeVideoId("https://www.youtube.com/watch?v=5qap5aO4i9A&t=120s&list=PL123"),
    expectedId
  );
  assert.strictEqual(
    parseYouTubeVideoId("https://youtu.be/5qap5aO4i9A?si=abc&t=45"),
    expectedId
  );
});

test("parseYouTubeVideoId - links invalidos", () => {
  assert.strictEqual(parseYouTubeVideoId("https://google.com"), null);
  assert.strictEqual(parseYouTubeVideoId(""), null);
  assert.strictEqual(parseYouTubeVideoId(null), null);
  assert.strictEqual(parseYouTubeVideoId("12345"), null); // menos de 11 caracteres
  assert.strictEqual(parseYouTubeVideoId("123456789012"), null); // mais de 11 caracteres
});

test("cleanTitle - remove sufixo do YouTube", () => {
  assert.strictEqual(cleanTitle("Minha Live Incrivel - YouTube"), "Minha Live Incrivel");
  assert.strictEqual(cleanTitle("Canal de Jogos - YouTube   "), "Canal de Jogos");
  assert.strictEqual(cleanTitle("Titulo Sem Sufixo"), "Titulo Sem Sufixo");
});

test("sourceFromUrl - cria objeto de origem correto", () => {
  const source = sourceFromUrl("https://www.youtube.com/watch?v=5qap5aO4i9A", "Minha Live - YouTube");
  
  assert.deepStrictEqual(source, {
    id: "5qap5aO4i9A",
    url: "https://www.youtube.com/watch?v=5qap5aO4i9A",
    title: "Minha Live",
    thumbnail: "https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg",
    isLive: undefined
  });
});
