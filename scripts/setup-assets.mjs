import { mkdir, cp, access, writeFile } from 'node:fs/promises';
const destination = new URL('../client/public/mediapipe/', import.meta.url);
await mkdir(destination, { recursive: true });
await cp(
  new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url),
  new URL('wasm/', destination),
  { recursive: true },
);
const model = new URL('pose_landmarker_lite.task', destination);
try {
  await access(model);
} catch {
  try {
    const response = await fetch(
      'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      { signal: AbortSignal.timeout(30000) },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await writeFile(model, Buffer.from(await response.arrayBuffer()));
    console.log('Local pose model ready.');
  } catch {
    console.warn(
      'Pose model download unavailable. Run npm run setup:assets when online. Ready will fail open until then.',
    );
  }
}
