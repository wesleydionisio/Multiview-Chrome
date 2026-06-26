# Multiview Room

Extensao Chrome MV3 para montar uma sala propria com ate 4 videos/lives do YouTube em iframes independentes.

## Como carregar

1. Abra `chrome://extensions`.
2. Ative `Modo do desenvolvedor`.
3. Clique em `Carregar sem compactacao`.
4. Selecione esta pasta: `C:\Users\auehf\OneDrive\Documentos\Multiview-Chrome`.

## Fluxo

- Em uma aba do YouTube, clique no icone da extensao e use `Adicionar live atual`.
- Ou abra a sala e cole uma URL do YouTube manualmente.
- A sala salva o ultimo estado em `chrome.storage.local`.

## Relay HTTPS para YouTube Error 153

O YouTube pode bloquear embeds carregados diretamente de paginas `chrome-extension://` com `Error 153`, porque o Chrome nao envia um `HTTP Referer` web normal nesse contexto.

Para contornar isso, publique `relay/player.html` em um dominio HTTPS e configure a URL completa em `shared/config.js`:

```js
export const PLAYER_RELAY_URL = "https://seu-dominio.com/player.html";
```

Depois disso, a extensao carrega:

```txt
chrome-extension://.../multiview.html
  -> https://seu-dominio.com/player.html?v=VIDEO_ID
    -> https://www.youtube-nocookie.com/embed/VIDEO_ID
```

Opcoes simples de hospedagem:

- Vercel: crie um projeto estatico usando a pasta `relay`.
- Cloudflare Pages: publique a pasta `relay`.
- GitHub Pages: publique `relay/player.html` em um repositorio publico.

## Estrutura

- `shared/youtube-url-parser.js`: extrai `videoId` de URLs do YouTube.
- `shared/store.js`: cria, normaliza e persiste a sala.
- `shared/config.js`: configura a URL HTTPS do relay.
- `popup/`: captura a aba atual ou uma URL manual.
- `multiview/`: renderiza a sala, slots e controles de audio.
- `multiview/player-adapter.js`: controla o iframe embed via comandos da YouTube IFrame API.
- `relay/player.html`: pagina HTTPS intermediaria que hospeda o iframe real do YouTube.
