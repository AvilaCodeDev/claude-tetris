# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step. Open directly or serve locally:

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Then visit `http://localhost:8000`.

## Architecture

Three files, no dependencies, no bundler:

- **`index.html`** — DOM structure: `<canvas id="board">` (300×600 px) for the board, `<canvas id="next-canvas">` (120×120 px) for the next-piece preview, a side panel with score/lines/level, and a hidden overlay for pause/game-over states.
- **`style.css`** — Dark retro-arcade theme using CSS variables, flexbox, and `backdrop-filter` for overlays.
- **`game.js`** — All game logic (~300 lines, vanilla ES6+, Canvas 2D API):
  - Board is a `ROWS × COLS` matrix (integers 0 = empty, 1–7 = piece color index).
  - Pieces are square matrices; rotation is transpose + row-reverse (`rotateCW`).
  - `collide()` checks bounds and overlap; `tryRotate()` applies wall kicks (±1, ±2 columns).
  - Game loop uses `requestAnimationFrame`; `dropInterval` controls fall speed.
  - `clearLines()` scans bottom-up, splices full rows, and unshifts empty ones.
  - Hold (Shift): `holdPiece()` stores the current piece type in `hold` (drawn in `<canvas id="hold-canvas">`) or swaps it with the stored one; `canHold` limits it to once per piece and is reset in `lockPiece()`. `makePiece(type)` builds a fresh piece at spawn position.
  - Ghost piece computed via `ghostY` and drawn at `globalAlpha = 0.2`.
  - Récords locales: top `RECORDS_MAX` en `localStorage['tetris-records']` como `{name, score, lines, combo, date}` (acceso siempre en try/catch). `trackCombo()` (llamado desde `clearLines()`) cuenta piezas consecutivas que limpian línea y guarda `maxCombo`. Al game over `showGameOverRecords()` pide el nombre (`#name-entry`) si la puntuación entra en el top y `renderRecords()` pinta la tabla (resaltando la nueva) en `#start-screen` y `#over-records`, junto a "Mejor combo" y "Máx. líneas". El juego no arranca solo: "Jugar" en `#start-screen` llama a `init()`; `started` bloquea los controles antes de empezar y el handler de teclado ignora los `<input>`.
  - Speed formula: `max(100, 1000 − (level − 1) × 90)` ms per row.

## Key constants in `game.js`

| Constant | Default | Notes |
|---|---|---|
| `COLS` / `ROWS` | 10 / 20 | If changed, update canvas `width`/`height` in `index.html` accordingly (`COLS×BLOCK`, `ROWS×BLOCK`) |
| `BLOCK` | 30 | Pixels per cell |
| `LINE_SCORES` | `[0,100,300,500,800]` | Multiplied by current level |
| `RECORDS_MAX` / `NAME_MAX` | 5 / 12 | Entradas del top de récords y largo máximo del nombre (el `maxlength` del input en `index.html` debe coincidir) |
| `NUT_MIN_LEVEL` / `NUT_CHANCE` | 3 / 0.1 | Level from which the 3×3 hollow "tuerca" piece can spawn, and its per-piece probability |
