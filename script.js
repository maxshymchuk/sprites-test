const canvas = document.getElementById('canvas');
const footer = document.querySelector('footer');

const ctx = canvas.getContext('2d');

const SCALE = 10;

const configUrl = './config.json';

let characterState;

async function loadConfig() {
  const response = await fetch(configUrl);
  if (response.ok) {
    const config = await response.json();
    return config;
  } else {
    throw "Can't load config";
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
    throw "Can't load image";
  }
}

function createSequence(state) {
  let elapsed = 0;
  let currentFrame = 0;
  return () => {
    if (!state.delay) return state.frames[currentFrame];
    elapsed++;
    if (elapsed >= state.delay) {
      elapsed = 0;
      currentFrame = (currentFrame + 1) % state.frames.length;
    }
    return state.frames[currentFrame];
  };
}

function createDraw(ctx, image) {
  ctx.imageSmoothingEnabled = false;
  let prevState = {};
  let frame = {};
  return function draw(queue) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const partKey of queue) {
      const part = characterState.parts[partKey];

      const partState =
        part.states[characterState.currentState] ??
        part.states[part.defaultState];

      if (partState !== prevState[partKey]) {
        frame[partKey] = createSequence(partState);
        prevState[partKey] = partState;
      }

      const { x, y, w, h, rect } = frame[partKey]();
      const [sx, sy, sw, sh] = rect;

      ctx.drawImage(
        image,
        sx,
        sy,
        sw,
        sh,
        x * SCALE,
        y * SCALE,
        w * SCALE,
        h * SCALE
      );
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

function createLoop(draw) {
  const queue = createQueue(characterState.parts);
  return function loop() {
    draw(queue);
    requestAnimationFrame(loop);
  };
}

function createCharacterState(config, image) {
  return {
    currentState: config.initialState,
    initialState: config.initialState,
    name: config.name,
    image: image,
    size: config.size,
    states: config.states,
    queue: createQueue(config.parts),
    parts: config.parts,
  };
}

document.body.onload = async () => {
  try {
    const config = await loadConfig();
    const original = await loadImage(config.image);

    console.log(original);

    for (const stateKey of config.states) {
      const button = document.createElement('button');
      button.dataset['state'] = stateKey;
      button.innerText = stateKey;
      footer.append(button);
    }

    characterState = createCharacterState(config, original);

    console.log(characterState);

    canvas.width = characterState.size[0] * SCALE;
    canvas.height = characterState.size[1] * SCALE;

    const runner = createLoop(createDraw(ctx, original));

    runner();
  } catch (e) {
    console.error(e);
  }
};

footer.addEventListener('click', (e) => {
  if (e.target.nodeName !== 'BUTTON') return;
  characterState.currentState = e.target.dataset['state'];
});

// console.log = () => null;
