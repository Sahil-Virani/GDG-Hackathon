import { useEffect, useState } from 'react';
import { framing, type Guidance } from '../lib/pose';
const initial: Guidance = { valid: false, message: 'Finding your frame…' };
export function usePose(video: HTMLVideoElement | null, enabled: boolean) {
  const [guidance, setGuidance] = useState<Guidance>(initial);
  useEffect(() => {
    if (!enabled || !video) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let model: import('@mediapipe/tasks-vision').PoseLandmarker | undefined;
    let lastTime = -1;
    let lastUseful = performance.now();
    const update = (g: Guidance) => {
      if (!stopped) {
        setGuidance(g);
      }
    };
    update(initial);
    const fallback = () =>
      update({
        valid: true,
        unavailable: true,
        message: 'Pose tracking unavailable — you can still continue.',
      });
    const watchdog = setInterval(() => {
      if (performance.now() - lastUseful > 6500) fallback();
    }, 1000);
    void (async () => {
      try {
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
        const files = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        if (stopped) return;
        const loaded = await PoseLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: '/mediapipe/pose_landmarker_lite.task', delegate: 'CPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (stopped) {
          loaded.close();
          return;
        }
        model = loaded;
        timer = setInterval(() => {
          if (stopped || video.readyState < 2 || video.currentTime === lastTime) return;
          lastTime = video.currentTime;
          try {
            const result = model!.detectForVideo(video, performance.now());
            if (result.landmarks[0]) {
              lastUseful = performance.now();
              update(framing(result.landmarks[0]));
            } else if (performance.now() - lastUseful < 6500)
              update({ valid: false, message: 'Step into frame so we can see your look' });
          } catch {
            fallback();
          }
        }, 100);
      } catch {
        fallback();
      }
    })();
    return () => {
      stopped = true;
      clearInterval(watchdog);
      clearInterval(timer);
      model?.close();
    };
  }, [video, enabled]);
  return { guidance };
}
