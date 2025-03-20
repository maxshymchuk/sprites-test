const container = document.querySelector('.container');
const footer = document.querySelector('footer');
const select = footer.querySelector('select');

const configUrl = './configs/config.json';

const globalCtx = document.getElementById('canvas').getContext('2d');

globalCtx.canvas.width = 512;
globalCtx.canvas.height = 512;
globalCtx.imageSmoothingEnabled = false;

let character;
let position = { x: 0, y: 0 };
let effect;

function clear(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

async function loadConfig(url) {
  const response = await fetch(url);
  if (response.ok) {
    const config = await response.json();
    return config;
  } else {
    throw `Can't load config ${url}`;
  }
}

async function createImage(blob) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(blob);
  });
}

async function loadImage(url) {
  const response = await fetch(url);
  if (response.ok) {
    const blob = await response.blob();
    const image = await createImage(blob);
    return image;
  } else {
    throw `Can't load image ${url}`;
  }
}

function createSequence(partState) {
  let elapsed = 0;
  let currentFrame = 0;
  return () => {
    if (!partState.delay) return partState.frames[currentFrame];
    elapsed++;
    if (elapsed >= (partState.frames[currentFrame].delay ?? partState.delay)) {
      elapsed = 0;
      currentFrame = (currentFrame + 1) % partState.frames.length;
    }
    return partState.frames[currentFrame];
  };
}

function createDraw(ctx, state) {
  let prevState = {};
  let frame = {};
  return function draw() {
    clear(ctx);
    const queue = createQueue(state.parts);
    for (const partKey of queue) {
      const part = state.parts[partKey];

      const partState =
        part.states[state.animationState] ?? part.states[part.defaultState];

      if (partState !== prevState[partKey]) {
        frame[partKey] = createSequence(partState);
        prevState[partKey] = partState;
      }

      const { x, y, w, h, rect } = frame[partKey]();
      const [sx, sy, sw, sh] = rect;

      ctx.drawImage(state.image, sx, sy, sw, sh, x, y, w, h);
    }
  };
}

function createQueue(parts) {
  const entries = Object.entries(parts);
  const sortedEntries = entries
    .map(([key, entry]) => ({ key, z: entry.z }))
    .sort((a, b) => a.z - b.z);
  return sortedEntries.map((entry) => entry.key);
}

// temporal ultra shitty code
function moveRight() {
  const stop = () => {
    clearInterval(timer);
    position.x = 0;
    effect = null;
  };
  const timer = setInterval(() => {
    position.x += 5;
    if (position.x > globalCtx.canvas.width) {
      position.x = -globalCtx.canvas.width;
    }
  }, 10);
  return { stop };
}

function loop() {
  clear(globalCtx);
  character.draw();
  const hRatio = globalCtx.canvas.width / character.ctx.canvas.width;
  const vRatio = globalCtx.canvas.height / character.ctx.canvas.height;
  const ratio = Math.min(hRatio, vRatio);
  const width = character.ctx.canvas.width * ratio;
  const height = character.ctx.canvas.height * ratio;
  const centerX = (globalCtx.canvas.width - width) / 2;
  const centerY = (globalCtx.canvas.height - height) / 2;
  globalCtx.drawImage(
    character.ctx.canvas,
    effect ? position.x : centerX,
    effect ? position.y : centerY,
    width,
    height
  );
  requestAnimationFrame(loop);
}

function updateCharacterUI(character) {
  const buttons = [];
  for (const stateKey of character.state.animationStates) {
    const button = document.createElement('button');
    button.dataset['state'] = stateKey;
    button.innerText = stateKey;
    buttons.push(button);
  }
  footer.querySelector('.states').replaceChildren(...buttons);
}

async function createCharacter(characterId) {
  const config = await loadConfig(`configs/${characterId}.json`);
  const original = await loadImage(`assets/${characterId}.png`);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const [width, height] = config.size;

  ctx.canvas.width = width;
  ctx.canvas.height = height;
  ctx.imageSmoothingEnabled = false;

  let state = {
    id: config.id,
    width,
    height,
    image: original,
    animationState: config.initialState,
    animationStates: config.states,
    parts: config.parts,
  };

  let draw = createDraw(ctx, state);

  const changeState = (animationState) => {
    state.animationState = animationState;
    if (animationState === 'walk-right') {
      effect = moveRight();
    } else {
      effect?.stop();
    }
    draw = createDraw(ctx, state);
  };

  const character = { ctx, state, draw, changeState };

  updateCharacterUI(character);

  return character;
}

document.body.onload = async () => {
  try {
    const config = await loadConfig(configUrl);

    const selectedCharacterId = config.characters[0];

    const options = [];
    for (const character of config.characters) {
      const option = document.createElement('option');
      option.setAttribute('value', character);
      option.innerText = character;
      if (option.value === selectedCharacterId) {
        option.setAttribute('selected', true);
      }
      options.push(option);
    }
    select.append(...options);

    select.addEventListener('change', async (e) => {
      character = await createCharacter(e.target.value);
      effect?.stop();
    });

    footer.addEventListener('click', (e) => {
      if (e.target.nodeName !== 'BUTTON') return;
      character.changeState(e.target.dataset['state']);
    });

    character = await createCharacter(selectedCharacterId);

    loop();
  } catch (e) {
    console.error(e);
  }
};
