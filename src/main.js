
import * as THREE from 'three';
import './style.css';

// ==========================================
// ROLL RUSH 2 — MAIN GAME
// ==========================================

const $ = id => document.getElementById(id);

let running = false;
let paused = false;
let renderer = null;
let audioCtx = null;
let musicTimer = null;
let soundOn = true;

let selectedWorld = 'original';
let selectedMode = 'easy';

let elapsed = 0;
let speed = 8;
let spawnClock = 0;
let last = 0;
let jumpV = 0;
let jumping = false;
let ballX = 0;
let targetX = 0;
let runCoins = 0;

let ramps = [];
let hazards = [];
let coins = [];
let track = [];

function showError(message) {
  let box = $('rr2-debug-error');

  if (!box) {
    box = document.createElement('div');
    box.id = 'rr2-debug-error';

    Object.assign(box.style, {
      position: 'fixed',
      zIndex: '999999',
      top: '10px',
      left: '10px',
      right: '10px',
      padding: '16px',
      background: '#650000',
      color: 'white',
      font: '13px monospace',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      borderRadius: '10px'
    });

    document.body.appendChild(box);
  }

  box.textContent = 'RR2 ERROR:\n' + message;
}

function hideError() {
  const box = $('rr2-debug-error');
  if (box) box.remove();
}

function show(id) {
  ['home', 'hud', 'pause-screen', 'gameover', 'shop'].forEach(name => {
    const element = $(name);
    if (element) element.classList.add('hidden');
  });

  if (id && $(id)) $(id).classList.remove('hidden');
}

// ==========================================
// SAVE SYSTEM
// ==========================================

function readSave() {
  try {
    return JSON.parse(localStorage.getItem('rr2-save') || '{}');
  } catch {
    return {};
  }
}

let save = readSave();

save.coins = Number(save.coins) || 0;
save.unlocked = Array.isArray(save.unlocked)
  ? save.unlocked
  : ['original'];

save.skins = Array.isArray(save.skins)
  ? save.skins
  : ['CYAN CORE'];

save.skin = save.skin || 'CYAN CORE';

function persist() {
  try {
    localStorage.setItem('rr2-save', JSON.stringify(save));
  } catch (error) {
    console.warn('Could not save game:', error);
  }

  updateWallet();
}

// ==========================================
// WORLDS, SKINS AND DIFFICULTIES
// ==========================================

const worlds = [
  {
    id: 'original',
    name: 'ORIGINAL',
    emoji: '🌌',
    cost: 0,
    bg: 0x080d18,
    fog: 0x080d18,
    track: 0x17283e,
    edge: 0x39bfff,
    glow: 0x168cff
  },
  {
    id: 'lava',
    name: 'LAVA',
    emoji: '🌋',
    cost: 250,
    bg: 0x1b0808,
    fog: 0x32100a,
    track: 0x38201c,
    edge: 0xff642c,
    glow: 0xff3c12
  },
  {
    id: 'ice',
    name: 'ICE',
    emoji: '❄️',
    cost: 500,
    bg: 0x071b2b,
    fog: 0x0b3148,
    track: 0x24485c,
    edge: 0x8deaff,
    glow: 0x50cfff
  },
  {
    id: 'space',
    name: 'SPACE',
    emoji: '🪐',
    cost: 900,
    bg: 0x09051d,
    fog: 0x170c3b,
    track: 0x20183e,
    edge: 0xb78aff,
    glow: 0x995cff
  }
];

const skins = [
  { name: 'CYAN CORE', color: 0x57c9ff, cost: 0 },
  { name: 'GOLD RUSH', color: 0xffc64b, cost: 120 },
  { name: 'LAVA ORB', color: 0xff593c, cost: 220 },
  { name: 'MINT', color: 0x54f0b0, cost: 350 },
  { name: 'VIOLET', color: 0xb78aff, cost: 500 },
  { name: 'PEARL', color: 0xf4f6ff, cost: 700 }
];

const modes = {
  easy: { start: 8, max: 18, ramp: 0.22, spawn: 1.65 },
  medium: { start: 12, max: 26, ramp: 0.42, spawn: 1.28 },
  hard: { start: 17, max: 34, ramp: 0.65, spawn: 1.02 },
  extreme: { start: 22, max: 44, ramp: 0.9, spawn: 0.82 }
};

// ==========================================
// THREE.JS SETUP
// ==========================================

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  150
);

camera.position.set(0, 5.7, 9.2);
camera.lookAt(0, 0, -4);

const hemisphere = new THREE.HemisphereLight(
  0xa9d7ff,
  0x20243b,
  1.65
);

scene.add(hemisphere);

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-4, 10, 6);
sun.castShadow = true;
scene.add(sun);

const glow = new THREE.PointLight(0x24aaff, 22, 35);
glow.position.set(4, 4, -8);
scene.add(glow);

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.43, 32, 24),
  new THREE.MeshStandardMaterial({
    color: 0x57c9ff,
    metalness: 0.55,
    roughness: 0.2
  })
);

ball.position.set(0, 0.48, 1.5);
ball.castShadow = true;
scene.add(ball);

const ballLight = new THREE.PointLight(0x35aaff, 2.4, 5);
scene.add(ballLight);

const trackGroup = new THREE.Group();
const hazardGroup = new THREE.Group();
const pickupGroup = new THREE.Group();

scene.add(trackGroup);
scene.add(hazardGroup);
scene.add(pickupGroup);

const starPositions = [];

for (let i = 0; i < 300; i++) {
  starPositions.push(
    (Math.random() - 0.5) * 85,
    Math.random() * 30 - 2,
    -Math.random() * 120
  );
}

const starGeometry = new THREE.BufferGeometry();

starGeometry.setAttribute(
  'position',
  new THREE.Float32BufferAttribute(starPositions, 3)
);

const starField = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({
    color: 0x9bcaff,
    size: 0.085,
    transparent: true,
    opacity: 0.75
  })
);

scene.add(starField);

// Renderer is protected so menu buttons can still work
// if WebGL cannot start.

try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, 1.6)
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  $('game').appendChild(renderer.domElement);

} catch (error) {
  renderer = null;
  showError('3D graphics could not start:\n' + error.message);
}

// ==========================================
// AUDIO
// ==========================================

function audio() {
  if (!soundOn) return;

  try {
    audioCtx ||= new (
      window.AudioContext || window.webkitAudioContext
    )();

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (error) {
    console.warn('Audio unavailable:', error);
  }
}

function tone(freq, duration = 0.11, type = 'sine', volume = 0.045) {
  if (!soundOn) return;

  audio();
  if (!audioCtx) return;

  try {
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = freq;

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioCtx.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (error) {
    console.warn('Sound error:', error);
  }
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

function startMusic() {
  stopMusic();

  if (!soundOn) return;

  audio();

  let note = 0;
  const notes = [110, 146.83, 164.81, 130.81];

  musicTimer = setInterval(() => {
    if (!running || paused || !soundOn) return;

    tone(notes[note % notes.length], 0.22, 'triangle', 0.018);

    note++;

    if (note % 4 === 0) {
      tone(55, 0.12, 'sine', 0.025);
    }
  }, 420);
}

// ==========================================
// WORLD AND TRACK
// ==========================================

function materials() {
  const world = worlds.find(w => w.id === selectedWorld);

  scene.background = new THREE.Color(world.bg);
  scene.fog = new THREE.Fog(world.fog, 20, 72);

  glow.color.setHex(world.glow);
  ballLight.color.setHex(world.edge);
}

function makeTrack() {
  while (trackGroup.children.length) {
    trackGroup.remove(trackGroup.children[0]);
  }

  track = [];

  const world = worlds.find(w => w.id === selectedWorld);

  const baseMaterial = new THREE.MeshStandardMaterial({
    color: world.track,
    metalness: 0.35,
    roughness: 0.55
  });

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: world.edge,
    emissive: world.edge,
    emissiveIntensity: 0.65
  });

  for (let i = 0; i < 20; i++) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.34, 5.1),
      baseMaterial
    );

    slab.position.set(0, -0.25, -i * 5);
    slab.receiveShadow = true;

    trackGroup.add(slab);
    track.push(slab);

    for (const x of [-3.92, 3.92]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.18, 5.08),
        edgeMaterial
      );

      rail.position.set(x, -0.01, -i * 5);

      trackGroup.add(rail);
      track.push(rail);
    }
  }
}

function clearGroup(group, array) {
  for (const object of array) {
    group.remove(object.mesh);
  }

  array.length = 0;
}

// ==========================================
// SPAWNING
// ==========================================

function spawnHazard() {
  const height = 0.7 + Math.random() * 0.55;
  const width = 0.85 + Math.random() * 0.9;
  const x = (Math.random() - 0.5) * 5.7;

  const color =
    selectedWorld === 'lava' ? 0xff673b :
    selectedWorld === 'ice' ? 0x8beaff :
    0xff596e;

  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: selectedWorld === 'lava' ? 0x7a1808 : 0x310d22,
    emissiveIntensity: 0.55,
    metalness: 0.25,
    roughness: 0.35
  });

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 0.9),
    material
  );

  mesh.position.set(x, height / 2 - 0.04, -52);
  mesh.castShadow = true;

  hazardGroup.add(mesh);

  hazards.push({
    mesh,
    height,
    width,
    passed: false
  });
}

function spawnRamp() {
  const x = (Math.random() - 0.5) * 4.6;
  const world = worlds.find(w => w.id === selectedWorld);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.28, 3.6),
    new THREE.MeshStandardMaterial({
      color: world.edge,
      emissive: world.edge,
      emissiveIntensity: 0.45,
      metalness: 0.35,
      roughness: 0.3
    })
  );

  mesh.position.set(x, 0.18, -55);
  mesh.rotation.x = -0.22;
  mesh.castShadow = true;

  hazardGroup.add(mesh);
  ramps.push({ mesh, x, hit: false });
}

function spawnCoinLine() {
  const x = (Math.random() - 0.5) * 5.7;

  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.075, 10, 20),
      new THREE.MeshStandardMaterial({
        color: 0xffd45e,
        metalness: 0.7,
        roughness: 0.22,
        emissive: 0x6c3e00,
        emissiveIntensity: 0.6
      })
    );

    mesh.position.set(x, 0.85, -49 - i * 1.25);
    mesh.rotation.x = Math.PI / 2;

    pickupGroup.add(mesh);
    coins.push({ mesh, taken: false });
  }
}

// ==========================================
// MENU AND SHOP
// ==========================================

function updateWallet() {
  if ($('home-coins')) $('home-coins').textContent = save.coins;
  if ($('shop-coins')) $('shop-coins').textContent = save.coins;
}

function renderLevels() {
  const element = $('level-list');
  if (!element) return;

  element.innerHTML = '';

  for (const world of worlds) {
    const unlocked = save.unlocked.includes(world.id);

    const button = document.createElement('button');

    button.className =
      'level' +
      (selectedWorld === world.id ? ' selected' : '') +
      (!unlocked ? ' locked' : '');

    button.innerHTML = `
      <span class="emoji">${world.emoji}</span>
      <b>${world.name}</b>
      <small>${unlocked ? 'UNLOCKED' : '◈ ' + world.cost}</small>
    `;

    button.onclick = () => {
      if (unlocked) {
        selectedWorld = world.id;
        renderLevels();
        return;
      }

      if (save.coins >= world.cost) {
        save.coins -= world.cost;
        save.unlocked.push(world.id);
        selectedWorld = world.id;

        persist();
        renderLevels();
      } else {
        button.animate(
          [
            { transform: 'translateX(-3px)' },
            { transform: 'translateX(3px)' },
            { transform: 'translateX(0)' }
          ],
          { duration: 180 }
        );
      }
    };

    element.appendChild(button);
  }
}

function applySkin() {
  const skin = skins.find(s => s.name === save.skin) || skins[0];

  ball.material.color.setHex(skin.color);
  ball.material.emissive.setHex(skin.color);
  ball.material.emissiveIntensity = 0.12;
}

function renderShop() {
  updateWallet();

  const element = $('skin-list');
  if (!element) return;

  element.innerHTML = '';

  for (const skin of skins) {
    const owned = save.skins.includes(skin.name);
    const selected = save.skin === skin.name;

    const card = document.createElement('div');

    card.className = 'skin' + (selected ? ' selected' : '');

    card.innerHTML = `
      <div class="skin-ball"
        style="background:#${skin.color.toString(16).padStart(6, '0')}">
      </div>
      <b>${skin.name}</b>
      <small>${owned ? 'OWNED' : '◈ ' + skin.cost}</small>
      <button>${selected ? 'EQUIPPED' : owned ? 'EQUIP' : 'BUY'}</button>
    `;

    card.querySelector('button').onclick = () => {
      if (owned) {
        save.skin = skin.name;
      } else if (save.coins >= skin.cost) {
        save.coins -= skin.cost;
        save.skins.push(skin.name);
        save.skin = skin.name;
      } else {
        return;
      }

      applySkin();
      persist();
      renderShop();
    };

    element.appendChild(card);
  }
}

// ==========================================
// GAME FLOW
// ==========================================

function fmt(seconds) {
  return (
    String(Math.floor(seconds / 60)).padStart(2, '0') +
    ':' +
    String(Math.floor(seconds % 60)).padStart(2, '0')
  );
}

function startGame() {
  if (!renderer) {
    showError('The 3D game could not start. WebGL is unavailable.');
    return;
  }

  hideError();

  try {
    audio();
    materials();
    makeTrack();

    clearGroup(hazardGroup, hazards);
    clearGroup(pickupGroup, coins);

    for (const ramp of ramps) {
      hazardGroup.remove(ramp.mesh);
    }

    ramps.length = 0;

    elapsed = 0;
    spawnClock = 0;

    speed = modes[selectedMode].start;

    runCoins = 0;
    targetX = 0;
    ballX = 0;

    ball.position.set(0, 0.48, 1.5);
    ball.scale.set(1, 1, 1);

    jumpV = 0;
    jumping = false;

    $('hud-world').textContent =
      worlds.find(w => w.id === selectedWorld).name;

    $('timer').textContent = '00:00';
    $('run-coins').textContent = '0';
    $('speed').textContent = '1.0x';

    running = true;
    paused = false;

    show('hud');
    startMusic();

  } catch (error) {
    running = false;
    show('home');
    showError('Could not start game:\n' + error.message);
    console.error(error);
  }
}

function endGame(cleared = false) {
  if (!running) return;

  running = false;
  stopMusic();

  const earned = runCoins + (cleared ? 40 : 0);

  save.coins += earned;
  persist();

  $('final-time').textContent = fmt(elapsed);
  $('earned').textContent = earned;

  $('over-title').textContent =
    cleared ? 'LEVEL CLEARED!' : 'GAME OVER';

  show('gameover');

  tone(cleared ? 740 : 160, 0.35, 'sawtooth', 0.035);
}

// ==========================================
// GAME UPDATE
// ==========================================

function update(dt) {
  if (!running || paused) return;

  elapsed += dt;

  const config = modes[selectedMode];

  speed = Math.min(
    config.max,
    config.start + elapsed * config.ramp
  );

  $('timer').textContent = fmt(elapsed);

  $('speed').textContent =
    (speed / config.start).toFixed(1) + 'x';

  ballX = THREE.MathUtils.damp(ballX, targetX, 13, dt);
  ball.position.x = ballX;

  // Jump physics
  if (jumping) {
    jumpV -= 22 * dt;
    ball.position.y += jumpV * dt;

    if (ball.position.y <= 0.48) {
      ball.position.y = 0.48;
      jumping = false;
      jumpV = 0;

      ball.scale.set(1.12, 0.82, 1.12);

      setTimeout(() => {
        if (!jumping) ball.scale.set(1, 1, 1);
      }, 75);
    }
  }

  ball.rotation.x -= speed * dt * 0.75;

  ball.rotation.z = THREE.MathUtils.damp(
    ball.rotation.z,
    -(targetX - ballX) * 0.12,
    8,
    dt
  );

  ballLight.position.set(ball.position.x, 0.8, 1.5);

  // Spawn objects
  spawnClock += dt;

  const interval = Math.max(
    0.48,
    config.spawn - elapsed * 0.004
  );

  if (spawnClock > interval) {
    spawnClock = 0;

    spawnHazard();

    if (Math.random() < 0.35) spawnCoinLine();
    if (Math.random() < 0.2) spawnRamp();
  }

  // Obstacles
  for (const hazard of hazards) {
    const previousZ = hazard.mesh.position.z;

    hazard.mesh.position.z += speed * dt;

    const currentZ = hazard.mesh.position.z;

    const crossedBall =
      previousZ <= 1.5 && currentZ >= 1.5;

    const closeToBall =
      currentZ > 0.65 && currentZ < 2.35;

    if (!hazard.passed && (crossedBall || closeToBall)) {
      hazard.passed = true;

      const horizontalHit =
        Math.abs(hazard.mesh.position.x - ball.position.x) <
        hazard.width / 2 + 0.43;

      if (horizontalHit && ball.position.y < hazard.height + 0.35) {
        endGame();
        return;
      }
    }
  }

  // Ramps
  for (const ramp of ramps) {
    ramp.mesh.position.z += speed * dt;

    if (
      !ramp.hit &&
      Math.abs(ramp.mesh.position.z - 1.5) < 0.85 &&
      Math.abs(ball.position.x - ramp.x) < 1.6
    ) {
      ramp.hit = true;
      jumping = true;
      jumpV = 12.4;

      speed = Math.min(config.max + 4, speed + 1.5);

      tone(520, 0.18, 'triangle', 0.05);
    }
  }

  // Coins
  for (const coin of coins) {
    coin.mesh.position.z += speed * dt;
    coin.mesh.rotation.z += dt * 3;

    if (
      !coin.taken &&
      Math.abs(coin.mesh.position.z - 1.5) < 0.7 &&
      Math.abs(coin.mesh.position.x - ball.position.x) < 0.68 &&
      Math.abs(coin.mesh.position.y - ball.position.y) < 1.1
    ) {
      coin.taken = true;
      pickupGroup.remove(coin.mesh);

      runCoins++;

      $('run-coins').textContent = runCoins;

      tone(880, 0.08, 'sine', 0.045);
    }
  }

  // Remove old objects
  for (const array of [hazards, ramps]) {
    for (let i = array.length - 1; i >= 0; i--) {
      if (array[i].mesh.position.z > 9) {
        hazardGroup.remove(array[i].mesh);
        array.splice(i, 1);
      }
    }
  }

  for (let i = coins.length - 1; i >= 0; i--) {
    if (coins[i].taken || coins[i].mesh.position.z > 9) {
      pickupGroup.remove(coins[i].mesh);
      coins.splice(i, 1);
    }
  }

  // Move track
  for (const slab of track) {
    slab.position.z += speed * dt;

    if (slab.position.z > 7) {
      slab.position.z -= 100;
    }
  }

  starField.position.z += speed * dt * 0.16;

  if (starField.position.z > 30) {
    starField.position.z = 0;
  }

  // Fall off the track
  if (Math.abs(ball.position.x) > 4.05) {
    endGame();
  }
}

// ==========================================
// ANIMATION
// ==========================================

function animate(now) {
  requestAnimationFrame(animate);

  const dt = Math.min((now - last) / 1000 || 0, 0.04);
  last = now;

  update(dt);

  if (!running) {
    ball.position.y = 0.48 + Math.sin(now * 0.0013) * 0.07;
    ball.rotation.y += 0.0015;
    ballLight.position.copy(ball.position);
  }

  if (renderer) {
    renderer.render(scene, camera);
  }
}

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  if (renderer) {
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// ==========================================
// TOUCH AND MOUSE CONTROLS
// ==========================================

let pointerDown = false;
let moved = false;

function pointerStart(event) {
  if (!running || paused || !renderer) return;

  pointerDown = true;
  moved = false;

  targetX = THREE.MathUtils.clamp(
    (event.clientX / window.innerWidth - 0.5) * 10.8,
    -5.4,
    5.4
  );

  try {
    renderer.domElement.setPointerCapture(event.pointerId);
  } catch {}
}

function pointerMove(event) {
  if (!pointerDown || !running || paused) return;

  moved = true;

  targetX = THREE.MathUtils.clamp(
    (event.clientX / window.innerWidth - 0.5) * 10.8,
    -5.4,
    5.4
  );
}

function pointerEnd() {
  if (!pointerDown) return;

  pointerDown = false;

  if (!moved && running && !paused && !jumping) {
    jumping = true;
    jumpV = 9.4;

    tone(390, 0.1, 'triangle', 0.035);
  }
}

// ==========================================
// BUTTONS
// ==========================================

function connectButtons() {
  $('play').onclick = startGame;

  $('pause').onclick = () => {
    if (!running) return;

    paused = true;
    stopMusic();
    show('pause-screen');
  };

  $('resume').onclick = () => {
    if (!running) return;

    paused = false;
    show('hud');
    startMusic();
  };

  $('quit').onclick = () => {
    running = false;
    paused = false;

    stopMusic();
    show('home');
  };

  $('retry').onclick = startGame;

  // Correct ID: home-button, not home
  $('home-button').onclick = () => {
    running = false;
    paused = false;

    stopMusic();
    show('home');
  };

  $('shop-open').onclick = () => {
    renderShop();
    show('shop');
  };

  $('shop-close').onclick = () => {
    show('home');
  };

  $('sound-toggle').onclick = () => {
    soundOn = !soundOn;

    $('sound-toggle').textContent =
      'SOUND: ' + (soundOn ? 'ON' : 'OFF');

    if (soundOn && running && !paused) {
      startMusic();
    } else {
      stopMusic();
    }
  };

  document.querySelectorAll('.diff').forEach(button => {
    button.onclick = () => {
      selectedMode = button.dataset.diff;

      document.querySelectorAll('.diff').forEach(other => {
        other.classList.toggle('selected', other === button);
      });
    };
  });

  if (renderer) {
    renderer.domElement.addEventListener('pointerdown', pointerStart);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerEnd);
    renderer.domElement.addEventListener('pointercancel', () => {
      pointerDown = false;
    });
  }
}

// ==========================================
// INITIALIZE
// ==========================================

try {
  connectButtons();

  renderLevels();
  updateWallet();
  applySkin();
  materials();
  makeTrack();

  window.addEventListener('resize', resize);

  if (renderer) {
    requestAnimationFrame(animate);
  }

  console.log('ROLL RUSH 2 initialized successfully');

} catch (error) {
  showError('Initialization failed:\n' + error.message);
  console.error(error);
}
