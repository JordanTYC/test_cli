const ARTBOARD = 'Soie et Venin';
const STATE_MACHINE = 'Entrees et pause';
const DEFAULT_RIV = './soie-et-venin.riv';

const canvas = document.querySelector('#rive-canvas');
const gate = document.querySelector('#gate');
const gateTitle = document.querySelector('#gate-title');
const gateMessage = document.querySelector('#gate-message');
const playButton = document.querySelector('#play-button');
const fileInput = document.querySelector('#rive-file');
const status = document.querySelector('#runtime-status');
const toast = document.querySelector('#toast');
let rive = null;
let ready = false;
let started = false;
let toastTimer = 0;
let objectUrl = null;

function setStatus(message) {
  status.textContent = message.toLocaleUpperCase('fr-FR');
}

function showGate(title, message, canPlay = false) {
  gateTitle.textContent = title;
  gateMessage.textContent = message;
  playButton.disabled = !canPlay;
  gate.classList.remove('hidden');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2200);
}

function stopRive() {
  if (rive) {
    rive.cleanup();
    rive = null;
  }
  ready = false;
  started = false;
}

function loadGame(src, label = 'soie-et-venin.riv') {
  stopRive();
  setStatus('Chargement');
  showGate('Préparation du combat', `Chargement de ${label}…`);

  const { Alignment, Fit, Layout, Rive } = window.rive;
  rive = new Rive({
    src,
    canvas,
    artboard: ARTBOARD,
    stateMachines: STATE_MACHINE,
    autoplay: false,
    enableGPUCanvas: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoad: () => {
      rive.resizeDrawingSurfaceToCanvas();
      ready = true;
      setStatus('Prêt');
      showGate('L’arène vous attend', 'Connecte ta manette ou utilise le clavier, puis entre dans l’arène.', true);
    },
    onLoadError: (event) => {
      console.error('Rive load error:', event);
      setStatus('Fichier requis');
      showGate(
        'Build Rive à ajouter',
        'Dépose ton fichier soie-et-venin.riv à côté de index.html, ou choisis-le ici. Le runtime web demande un build compatible avec le navigateur.',
      );
    },
  });
}

function enterArena() {
  if (!rive || !ready) return;
  started = true;
  canvas.focus({ preventScroll: true });
  rive.play();
  gate.classList.add('hidden');
  setStatus('En jeu');
  if (!gamepadLoop) gamepadLoop = window.requestAnimationFrame(pollGamepads);
}

playButton.addEventListener('click', enterArena);
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const previousUrl = objectUrl;
  objectUrl = URL.createObjectURL(file);
  loadGame(objectUrl, file.name);
  if (previousUrl) URL.revokeObjectURL(previousUrl);
});

document.querySelector('#fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector('#game').requestFullscreen();
  } catch (error) {
    console.error('Fullscreen unavailable:', error);
    showToast('Le plein écran n’est pas disponible dans ce navigateur.');
  }
});

document.addEventListener('fullscreenchange', () => {
  window.requestAnimationFrame(() => rive?.resizeDrawingSurfaceToCanvas());
});
window.addEventListener('resize', () => rive?.resizeDrawingSurfaceToCanvas());

// GLFW key codes used by input.luau; browser gamepads are translated to the
// same keyboard events so the existing Rive script retains its bindings.
const gamepadKeys = new Map([
  [0, 'Space'], [1, 'KeyK'], [2, 'KeyJ'], [3, 'KeyU'], [4, 'KeyI'],
  [5, 'KeyO'], [6, 'KeyP'], [7, 'KeyN'], [8, 'Tab'], [9, 'Escape'],
  [10, 'KeyL'], [11, 'KeyH'],
]);
const activeGamepadKeys = new Set();
const gamepadCodes = new Map();
let gamepadLoop = 0;

function sendKey(code, pressed, repeat = false) {
  const event = new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
    key: code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code,
    code,
    bubbles: true,
    cancelable: true,
    repeat,
  });
  canvas.dispatchEvent(event);
}

function pollGamepads() {
  gamepadLoop = 0;
  if (!started) {
    for (const id of activeGamepadKeys) sendKey(gamepadCodes.get(id), false);
    activeGamepadKeys.clear();
    return;
  }
  const desired = new Set();
  for (const pad of navigator.getGamepads?.() ?? []) {
    if (!pad?.connected) continue;
    for (const [buttonIndex, code] of gamepadKeys) {
      if (pad.buttons[buttonIndex]?.pressed) desired.add(`${pad.index}:${code}`);
    }

    // D-pad left/right and left stick are movement; the game consumes the
    // matching GLFW arrow key events. A dead zone avoids analog jitter.
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    const left = pad.buttons[14]?.pressed || x < -0.28;
    const right = pad.buttons[15]?.pressed || x > 0.28;
    const up = pad.buttons[12]?.pressed || y < -0.28;
    const down = pad.buttons[13]?.pressed || y > 0.28;
    if (left && !right) desired.add(`${pad.index}:ArrowLeft`);
    if (right && !left) desired.add(`${pad.index}:ArrowRight`);
    if (up && !down) desired.add(`${pad.index}:ArrowUp`);
    if (down && !up) desired.add(`${pad.index}:ArrowDown`);
  }

  for (const id of activeGamepadKeys) {
    if (!desired.has(id)) sendKey(gamepadCodes.get(id), false);
  }
  for (const id of desired) {
    if (!activeGamepadKeys.has(id)) {
      const code = id.slice(id.indexOf(':') + 1);
      gamepadCodes.set(id, code);
      sendKey(code, true);
    }
  }
  activeGamepadKeys.clear();
  for (const id of desired) activeGamepadKeys.add(id);
  gamepadLoop = window.requestAnimationFrame(pollGamepads);
}

window.addEventListener('gamepadconnected', (event) => showToast(`Manette connectée : ${event.gamepad.id}`));
window.addEventListener('gamepaddisconnected', () => showToast('Manette déconnectée.'));

document.addEventListener('keydown', (event) => {
  if (event.code === 'F11') {
    event.preventDefault();
    document.querySelector('#fullscreen-button').click();
  }
  if (!started && (event.code === 'Enter' || event.code === 'Space') && ready) {
    event.preventDefault();
    enterArena();
  }
  if (started && ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(event.code)) {
    event.preventDefault();
  }
}, { capture: true });

// Send keyboard input to the focused Rive canvas (the runtime's listener
// system uses focus); keep the page from scrolling on game controls.
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
window.addEventListener('keydown', (event) => {
  if (started && canvas !== document.activeElement) canvas.focus({ preventScroll: true });
  if (started && ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab'].includes(event.code)) event.preventDefault();
}, { capture: false });

if (window.rive?.Rive) {
  loadGame(DEFAULT_RIV);
} else {
  setStatus('Runtime indisponible');
  showGate('Runtime Rive indisponible', 'Vérifie ta connexion Internet puis recharge la page : le lecteur WebGL2 de Rive est chargé depuis son CDN.');
}
