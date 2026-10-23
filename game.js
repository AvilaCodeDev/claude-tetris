'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - steel (tuerca)
];

// Paleta más saturada para fondo claro (mejor contraste)
const COLORS_LIGHT = [
  null,
  '#00acc1', // I
  '#f9a825', // O
  '#8e24aa', // T
  '#43a047', // S
  '#e53935', // Z
  '#1e88e5', // J
  '#fb8c00', // L
  '#546e7a', // N
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (reto)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const NUT = 8;
const NUT_MIN_LEVEL = 3;  // nivel desde el que puede salir la tuerca
const NUT_CHANCE = 0.1;   // probabilidad por pieza a partir de ese nivel

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');

let theme = 'dark';
let gridColor = '#22222e';

let board, current, next, hold, canHold, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  const type = level >= NUT_MIN_LEVEL && Math.random() < NUT_CHANCE
    ? NUT
    : Math.floor(Math.random() * 7) + 1;
  return makePiece(type);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  canHold = true;
  spawn();
  drawHold();
}

// Guarda la pieza actual o la intercambia con la guardada (una vez por pieza)
function holdPiece() {
  if (!canHold) return;
  if (hold === null) {
    hold = current.type;
    spawn();
  } else {
    const piece = makePiece(hold);
    if (collide(piece.shape, piece.x, piece.y)) return;
    hold = current.type;
    current = piece;
    dropAccum = 0;
  }
  canHold = false;
  drawHold();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// ---- Skins (apariencia visual) ----
// Cada skin: paleta oscura/clara y funciones block/hole que dibujan en píxeles (px, py).
// El fondo y la cuadrícula del tablero se definen en CSS con [data-skin].

// Las sombras se limpian siempre tras dibujar para que no se filtren a otros trazos
function clearShadow(context) {
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
}

function roundedPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function strokeHole(context, px, py, size, color) {
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
}

const NEON_COLORS = [null, '#00f0ff', '#ffee00', '#d500f9', '#39ff14', '#ff1744', '#2979ff', '#ff9100', '#cfd8dc'];
const PASTEL_COLORS = [null, '#a8e6ef', '#fff1a8', '#d9b8f0', '#b5ead7', '#ffb3ba', '#b5d0ff', '#ffd6a5', '#d5dde2'];
const PASTEL_COLORS_LIGHT = [null, '#7fcfdc', '#f5d86a', '#c39be6', '#8fd6b8', '#f58f9a', '#8fb5f5', '#f5b97a', '#aab8c0'];
const PIXEL_COLORS = [null, '#3cbcfc', '#fcd838', '#b858f8', '#58d854', '#f83800', '#6888fc', '#fc9838', '#a8a8b8'];
const PIXEL_COLORS_LIGHT = [null, '#0078f8', '#e0a800', '#8800cc', '#00a800', '#d82800', '#0058f8', '#e45c10', '#686878'];

const SKINS = {
  retro: {
    label: 'Retro',
    colors: { dark: COLORS, light: COLORS_LIGHT },
    block(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
    hole: strokeHole,
  },
  neon: {
    label: 'Neón',
    colors: { dark: NEON_COLORS, light: NEON_COLORS }, // el tablero siempre es negro
    block(context, px, py, size, color) {
      const a = context.globalAlpha;
      context.shadowColor = color;
      context.shadowBlur = size * 0.6;
      context.fillStyle = '#000';
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      clearShadow(context);
      context.globalAlpha = a * 0.35; // relleno tenue del color
      context.fillStyle = color;
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.globalAlpha = a;
    },
    hole(context, px, py, size, color) {
      context.shadowColor = color;
      context.shadowBlur = size * 0.4;
      strokeHole(context, px, py, size, color);
      clearShadow(context);
    },
  },
  pastel: {
    label: 'Pastel',
    colors: { dark: PASTEL_COLORS, light: PASTEL_COLORS_LIGHT },
    block(context, px, py, size, color) {
      context.fillStyle = color;
      roundedPath(context, px + 1.5, py + 1.5, size - 3, size - 3, size * 0.3);
      context.fill();
      // brillo suave arriba
      context.fillStyle = 'rgba(255,255,255,0.4)';
      roundedPath(context, px + size * 0.2, py + size * 0.15, size * 0.45, size * 0.14, size * 0.07);
      context.fill();
    },
    hole(context, px, py, size, color) {
      context.strokeStyle = color;
      context.lineWidth = 2;
      roundedPath(context, px + 4, py + 4, size - 8, size - 8, size * 0.2);
      context.stroke();
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: { dark: PIXEL_COLORS, light: PIXEL_COLORS_LIGHT },
    block(context, px, py, size, color) {
      const inner = size - 2, p = inner / 6; // celda de "píxel"
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, inner, inner);
      // trama de ajedrez
      context.fillStyle = 'rgba(0,0,0,0.14)';
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 6; j++)
          if ((i + j) % 2 === 0) context.fillRect(px + 1 + i * p, py + 1 + j * p, p, p);
      // biseles: luz arriba/izquierda, sombra abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.55)';
      context.fillRect(px + 1, py + 1, inner, p);
      context.fillRect(px + 1, py + 1, p, inner);
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(px + 1, py + 1 + inner - p, inner, p);
      context.fillRect(px + 1 + inner - p, py + 1, p, inner);
    },
    hole(context, px, py, size, color) {
      const p = Math.floor(size / 6);
      context.fillStyle = color;
      // marco de píxeles alrededor del hueco
      context.fillRect(px + 3, py + 3, size - 6, p);
      context.fillRect(px + 3, py + size - 3 - p, size - 6, p);
      context.fillRect(px + 3, py + 3, p, size - 6);
      context.fillRect(px + size - 3 - p, py + 3, p, size - 6);
    },
  },
};

let skin = 'retro';

function skinColor(colorIndex) {
  return SKINS[skin].colors[theme === 'light' ? 'light' : 'dark'][colorIndex];
}
// ---- Fin skins ----

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.save(); // aísla sombras/estilos de la skin
  context.globalAlpha = alpha ?? 1;
  SKINS[skin].block(context, x * size, y * size, size, skinColor(colorIndex));
  context.restore();
}

// Contorno del hueco cuadrado central de la tuerca
function drawNutHole(context, x, y, size, alpha) {
  context.save();
  context.globalAlpha = alpha ?? 1;
  SKINS[skin].hole(context, x * size, y * size, size, skinColor(NUT));
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
  if (current.type === NUT) drawNutHole(ctx, current.x + 1, gy + 1, BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  if (current.type === NUT) drawNutHole(ctx, current.x + 1, current.y + 1, BLOCK);
}

function drawPreview(context, cnv, piece, alpha) {
  const NB = 30;
  context.clearRect(0, 0, cnv.width, cnv.height);
  if (!piece) return;
  const shape = piece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB, alpha);
  if (piece.type === NUT) drawNutHole(context, offX + 1, offY + 1, NB, alpha);
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, next);
}

// Atenuada mientras el hold está bloqueado para la pieza actual
function drawHold() {
  drawPreview(holdCtx, holdCanvas, hold === null ? null : makePiece(hold), canHold ? 1 : 0.4);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() puede ejecutarse dentro de este mismo frame (lockPiece → spawn);
  // si se reprogramara aquí, el bucle seguiría vivo tras el game over.
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  hold = null;
  canHold = true;
  next = randomPiece();
  spawn();
  drawHold();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme(t) {
  theme = t === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
  themeLabel.textContent = theme === 'light' ? 'CLARO' : 'OSCURO';
  // el canvas no se repinta solo en pausa / game over
  if (current && next) { draw(); drawNext(); drawHold(); }
}

themeToggle.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light');
  try { localStorage.setItem('theme', theme); } catch (_) {}
  themeToggle.blur(); // evita que Space/flechas vuelvan a activar el botón
});

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') || 'dark'; } catch (_) {}
applyTheme(savedTheme);

// ---- Selector de skin ----
const skinSelect = document.getElementById('skin-select');

function applySkin(name) {
  skin = Object.prototype.hasOwnProperty.call(SKINS, name) ? name : 'retro';
  document.documentElement.dataset.skin = skin;
  // el CSS de la skin puede cambiar --grid
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  skinSelect.value = skin;
  // el canvas no se repinta solo en pausa / game over ni antes de iniciar
  if (current && next) { draw(); drawNext(); drawHold(); }
}

// Las flechas/espacio son del juego: el select no debe cambiar de opción con ellas
skinSelect.addEventListener('keydown', e => {
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  try { localStorage.setItem('skin', skin); } catch (_) {}
  skinSelect.blur(); // evita que Space/flechas cambien la opción
});

let savedSkin = 'retro';
try { savedSkin = localStorage.getItem('skin') || 'retro'; } catch (_) {}
applySkin(savedSkin);

init();
