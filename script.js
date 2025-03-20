const canvas = document.getElementById('canvas');
const footer = document.querySelector('footer');
const select = footer.querySelector('select');

const ctx = canvas.getContext('2d');

const configUrl = './configs/config.json';

let characterState;
let currentRunnerId;

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

function createDraw(ctx, image) {
  ctx.imageSmoothingEnabled = false;
  let prevState = {};
  let frame = {};
  return function draw(queue) {
    clear(ctx);
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

      ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
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
    currentRunnerId = requestAnimationFrame(loop);
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

async function init(character) {
  clear(ctx);
  cancelAnimationFrame(currentRunnerId);

  const config = await loadConfig(`configs/${character}.json`);
  const original = await loadImage(`assets/${character}.png`);

  const buttons = [];
  for (const stateKey of config.states) {
    const button = document.createElement('button');
    button.dataset['state'] = stateKey;
    button.innerText = stateKey;
    buttons.push(button);
  }
  footer.querySelector('.states').replaceChildren(...buttons);

  characterState = createCharacterState(config, original);

  console.log(characterState);

  canvas.width = characterState.size[0];
  canvas.height = characterState.size[1];

  const runner = createLoop(createDraw(ctx, original));

  runner();
}

document.body.onload = async () => {
  try {
    const config = await loadConfig(configUrl);

    const selectedCharacter = config.selectedCharacter ?? config.characters[0];

    const options = [];
    for (const character of config.characters) {
      const option = document.createElement('option');
      option.setAttribute('value', character);
      option.innerText = character;
      if (option.value === selectedCharacter) {
        option.setAttribute('selected', true);
      }
      options.push(option);
    }
    select.append(...options);

    select.addEventListener('change', (e) => {
      init(e.target.value);
    });

    footer.addEventListener('click', (e) => {
      if (e.target.nodeName !== 'BUTTON') return;
      characterState.currentState = e.target.dataset['state'];
    });

    init(selectedCharacter);
  } catch (e) {
    console.error(e);
  }
};

// console.log = () => null;
