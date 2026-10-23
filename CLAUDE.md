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
  - Skins: `SKINS` (`retro`, `neon`, `pastel`, `pixel`) define per-theme palettes (`colors.dark/light`, index 1–8) and `block()` / `hole()` draw functions in pixel coords. `drawBlock` / `drawNutHole` delegate to `SKINS[skin]` via `skinColor()`; shadows (neon) are cleared after drawing. Board/hold/next background and grid color come from CSS variables overridden by `[data-skin="…"]` on `<html>` (`applySkin()` re-reads `--grid`). The `<select id="skin-select">` (fixed top-right, below the theme toggle) persists the choice in `localStorage['skin']` and redraws live, even when paused.
  - Ghost piece computed via `ghostY` and drawn at `globalAlpha = 0.2`.
  - Speed formula: `max(100, 1000 − (level − 1) × 90)` ms per row.

## Key constants in `game.js`

| Constant | Default | Notes |
|---|---|---|
| `COLS` / `ROWS` | 10 / 20 | If changed, update canvas `width`/`height` in `index.html` accordingly (`COLS×BLOCK`, `ROWS×BLOCK`) |
| `BLOCK` | 30 | Pixels per cell |
| `LINE_SCORES` | `[0,100,300,500,800]` | Multiplied by current level |
| `SKINS` / `skin` | `retro` | Visual skins (`retro`, `neon`, `pastel`, `pixel`); to add one, add an entry with `label`, `colors`, `block`, `hole`, an `<option>` in `index.html` and `[data-skin]` CSS overrides |
| `NUT_MIN_LEVEL` / `NUT_CHANCE` | 3 / 0.1 | Level from which the 3×3 hollow "tuerca" piece can spawn, and its per-piece probability |
