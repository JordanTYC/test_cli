'use strict';

const ARTBOARD = 'Soie et Venin';
const STATE_MACHINE = 'Entrees et pause';
const GAME_URL = new URL('./soie-et-venin.riv', document.baseURI);
const canvas = document.querySelector('#rive-canvas');
const gate = document.querySelector('#gate');
const gateTitle = document.querySelector('#gate-title');
const gateMessage = document.querySelector('#gate-message');
const progress = document.querySelector('#progress-bar');
const progressValue = document.querySelector('#progress-value');
const progressContainer = document.querySelector('#loading-progress');
const retryButton = document.querySelector('#retry-button');
const enterButton = document.querySelector('#enter-button');
const audioButton = document.querySelector('#audio-button');
const fullscreenButton = document.querySelector('#fullscreen-button');
const status = document.querySelector('#runtime-status');
const toast = document.querySelector('#toast');
let player = null;
let started = false;
let readyToEnter = false;
let audioActivated = false;
let gamepadLoop = 0;
let toastTimer = 0;
let startupGeneration = 0;

function setLoading(message, percentage = null) {
  gateMessage.textContent = message;
  if (percentage === null) {
    progress.removeAttribute('value');
    progressValue.textContent = '…';
  } else {
    progress.value = percentage;
    progressValue.textContent = `${Math.floor(percentage)} %`;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2200);
}

// Only this game's URL can be loaded. The percentage reflects actual bytes
// received; decoding and shader initialization have no measurable percentage.
async function downloadGame() {
  const response = await fetch(GAME_URL, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Game download failed: HTTP ${response.status}`);
  const encoding = response.headers.get('content-encoding');
  // Fetch exposes decompressed bytes, while Content-Length may be compressed.
  const total = !encoding || encoding === 'identity' ? Number(response.headers.get('content-length')) : 0;
  if (!response.body) {
    setLoading('Téléchargement du jeu…');
    return response.arrayBuffer();
  }
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  setLoading('Téléchargement du jeu…', total > 0 ? 0 : null);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    setLoading('Téléchargement du jeu…', total > 0 ? Math.min(100, received / total * 100) : null);
  }
  if (!received) throw new Error('Empty game file');
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

function initializeGame(buffer) {
  const { Rive, Layout, Fit, Alignment } = window.rive;
  return new Promise((resolve, reject) => {
    player = new Rive({
      buffer,
      canvas,
      artboard: ARTBOARD,
      stateMachine: STATE_MACHINE,
      autoBind: true,
      autoplay: true,
      enableGPUCanvas: true,
      useOffscreenRenderer: false,
      tabIndex: 0,
      focusOptions: { allowFocusInterrupt: true },
      layout: new Layout({ fit: Fit.Layout, alignment: Alignment.Center }),
      onLoad: () => {
        player.resizeDrawingSurfaceToCanvas();
        if (audioActivated) player.volume = 1;
        resolve();
      },
      onLoadError: (event) => reject(new Error(String(event.data ?? 'Rive load failed'))),
    });
  });
}

// Importing a .riv is not proof that its scripts executed. A signed build's
// controller updates clock every frame; an unsigned build leaves it frozen.
function waitForController(generation) {
  const clock = player.viewModelInstance?.number('clock');
  if (!clock) throw new Error('Arena view model/clock is missing');
  const firstValue = clock.value;
  const deadline = performance.now() + 8000;
  return new Promise((resolve, reject) => {
    function check() {
      if (generation !== startupGeneration) return reject(new Error('Startup superseded'));
      if (clock.value > firstValue) return resolve();
      if (performance.now() >= deadline) {
        return reject(new Error('Rive controller did not advance. Check script signatures: export with rive --publish=local, not --once or the CLI preview.'));
      }
      window.requestAnimationFrame(check);
    }
    window.requestAnimationFrame(check);
  });
}

async function startGame() {
  const generation = ++startupGeneration;
  started = false;
  readyToEnter = false;
  releaseGamepadKeys();
  if (gamepadLoop) window.cancelAnimationFrame(gamepadLoop);
  gamepadLoop = 0;
  player?.cleanup();
  player = null;
  gate.classList.remove('hidden');
  gate.setAttribute('aria-busy', 'true');
  gateTitle.textContent = 'Soie et Venin';
  progressContainer.hidden = false;
  retryButton.hidden = true;
  enterButton.hidden = true;
  audioButton.hidden = true;
  status.textContent = 'CHARGEMENT';
  setLoading('Préparation du jeu…');
  try {
    if (!window.rive?.Rive) throw new Error('Rive CDN could not be loaded');
    // Load WASM concurrently with the game, and handle both failures.
    const [, buffer] = await Promise.all([
      window.rive.RuntimeLoader.awaitInstance(),
      downloadGame(),
    ]);
    if (generation !== startupGeneration) return;
    setLoading('Préparation de l’arène…');
    await initializeGame(buffer);
    await waitForController(generation);
    if (generation !== startupGeneration) return;
    const paused = player.viewModelInstance?.boolean('paused');
    if (!paused) throw new Error('Arena pause binding is missing');
    paused.value = true;
    readyToEnter = true;
    gate.setAttribute('aria-busy', 'false');
    progressContainer.hidden = true;
    gateMessage.textContent = 'Tout est prêt. Un clic lance le jeu et sa musique.';
    enterButton.hidden = false;
    status.textContent = 'PRÊT';
  } catch (error) {
    if (generation !== startupGeneration) return;
    console.error('Soie et Venin startup failed:', error);
    player?.cleanup();
    player = null;
    readyToEnter = false;
    enterButton.hidden = true;
    gate.setAttribute('aria-busy', 'false');
    gateTitle.textContent = 'L’arène est indisponible';
    gateMessage.textContent = 'Le jeu n’a pas pu démarrer. Réessaie après quelques instants ou après la prochaine mise à jour.';
    progressContainer.hidden = true;
    retryButton.hidden = false;
    status.textContent = 'INDISPONIBLE';
  }
}

retryButton.addEventListener('click', () => {
  if (!window.rive?.Rive) window.location.reload();
  else startGame();
});

enterButton.addEventListener('click', (event) => {
  if (!event.isTrusted || !readyToEnter || !player) return;
  readyToEnter = false;
  started = true;
  player.viewModelInstance.boolean('paused').value = false;
  activateAudio(event);
  gate.classList.add('hidden');
  enterButton.hidden = true;
  status.textContent = 'EN JEU';
  const fromPageControl = document.activeElement instanceof HTMLButtonElement;
  canvas.focus({ preventScroll: true });
  // Rive enters its focus tree automatically for keyboard focus. A pointer
  // return from a page button needs Tab traversal to restore the controller.
  if (fromPageControl && !canvas.matches(':focus-visible')) {
    sendKey('Tab', true);
    sendKey('Tab', false);
  }
  gamepadLoop = window.requestAnimationFrame(pollGamepad);
});

// A gamepad's synthetic keyboard events do not grant browser audio permission.
// The embedded miniaudio backend in this pinned runtime unlocks on click or
// touchend, not keydown. Keep the button until that supported gesture occurs.
function activateAudio(event) {
  if (!event.isTrusted || !started) return;
  audioActivated = true;
  if (player) player.volume = 1;
  audioButton.hidden = true;
}
window.addEventListener('click', activateAudio);
window.addEventListener('touchend', activateAudio);
// Clicking page controls must not blur Rive's focused controller node.
// Buttons remain keyboard-accessible; pointer activation preserves game focus.
for (const button of [enterButton, audioButton, fullscreenButton]) {
  button.addEventListener('pointerdown', (event) => event.preventDefault());
}

fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('#game').requestFullscreen();
    if (started) canvas.focus({ preventScroll: true });
  } catch (error) {
    console.error('Fullscreen unavailable:', error);
    showToast('Le plein écran n’est pas disponible.');
  }
});
document.addEventListener('fullscreenchange', () => {
  fullscreenButton.setAttribute('aria-label', document.fullscreenElement ? 'Quitter le plein écran' : 'Passer en plein écran');
  window.requestAnimationFrame(() => player?.resizeDrawingSurfaceToCanvas());
});
window.addEventListener('resize', () => player?.resizeDrawingSurfaceToCanvas());

// Keep the game's existing bindings: A jump, B/Y/LB/RB/LT/RT skills,
// X attack, Back rig, Start pause, L3 dash, R3 heal (standard browser indices).
const gamepadKeys = new Map([
  [0, 'Space'], [1, 'KeyK'], [2, 'KeyJ'], [3, 'KeyU'], [4, 'KeyI'],
  [5, 'KeyO'], [6, 'KeyP'], [7, 'KeyN'], [8, 'Tab'], [9, 'Escape'],
  [10, 'KeyL'], [11, 'KeyH'],
]);
const activeGamepadKeys = new Set();

function sendKey(code, pressed) {
  canvas.dispatchEvent(new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
    key: code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code,
    code,
    bubbles: true,
    cancelable: true,
  }));
}

function releaseGamepadKeys() {
  for (const code of activeGamepadKeys) sendKey(code, false);
  activeGamepadKeys.clear();
}

function pollGamepad() {
  gamepadLoop = 0;
  if (!started) return;
  const desired = new Set();
  if (document.hasFocus() && document.visibilityState === 'visible') {
    const pad = Array.from(navigator.getGamepads?.() ?? []).find((item) => item?.connected);
    if (pad) {
      for (const [index, code] of gamepadKeys) {
        if (pad.buttons[index]?.pressed) desired.add(code);
      }
      const x = pad.axes[0] ?? 0;
      const y = pad.axes[1] ?? 0;
      if (pad.buttons[14]?.pressed || x < -0.28) desired.add('ArrowLeft');
      if (pad.buttons[15]?.pressed || x > 0.28) desired.add('ArrowRight');
      if (pad.buttons[12]?.pressed || y < -0.28) desired.add('ArrowUp');
      if (pad.buttons[13]?.pressed || y > 0.28) desired.add('ArrowDown');
    }
  }
  const focus = document.activeElement;
  const inRive = focus === canvas || (focus instanceof HTMLInputElement && focus.parentElement === canvas.parentElement);
  if (desired.size && !inRive) canvas.focus({ preventScroll: true });
  for (const code of activeGamepadKeys) if (!desired.has(code)) sendKey(code, false);
  for (const code of desired) if (!activeGamepadKeys.has(code)) sendKey(code, true);
  activeGamepadKeys.clear();
  for (const code of desired) activeGamepadKeys.add(code);
  gamepadLoop = window.requestAnimationFrame(pollGamepad);
}

window.addEventListener('gamepadconnected', () => showToast('Manette connectée.'));
window.addEventListener('gamepaddisconnected', () => showToast('Manette déconnectée.'));
window.addEventListener('blur', releaseGamepadKeys);
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));

// Keep Rive's focused controller from accepting play/pause commands behind
// the entrance screen. Real button activation remains available.
for (const type of ['keydown', 'keyup']) {
  document.addEventListener(type, (event) => {
    if (!started && !(event.target instanceof HTMLButtonElement)) {
      if (type === 'keydown' && event.code === 'Tab') {
        if (readyToEnter) enterButton.focus({ preventScroll: true });
        else if (!retryButton.hidden) retryButton.focus({ preventScroll: true });
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true });
}

document.addEventListener('keydown', (event) => {
  if (!started || event.ctrlKey || event.altKey || event.metaKey || event.target instanceof HTMLButtonElement) return;
  // Rive handles both the canvas and its hidden keyboard-input proxy.
  // Redispatching proxy events would execute each action twice (notably pause).
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(event.code)) event.preventDefault();
});

startGame();
