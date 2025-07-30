// src/assets/enemies/loadEnemyFrames.js

export const loadEnemyFrames = (type, frameCount) => {
  const frames = [];

  for (let i = 0; i < frameCount; i++) {
    const img = new Image();
    img.src = new URL(`./${type}/frame${i}.png`, import.meta.url).href;
    frames.push(img);
  }

  return frames;
};
