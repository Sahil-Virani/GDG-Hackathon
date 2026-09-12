import { useSession } from '../stores/session';
export async function api<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const token = useSession.getState().credentials?.accessToken;
  const response = await fetch(`/api${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(50_000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || 'The mog pit hit a connection issue. Please try again.');
  return data as T;
}
export const roomPath = () => `/rooms/${useSession.getState().credentials!.roomCode}`;
export function soundCue(name: 'ready' | 'countdown' | 'capture' | 'reveal' | 'winner') {
  window.dispatchEvent(new CustomEvent('battle:sound', { detail: name }));
}
export async function compressImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPEG, PNG, or WebP photo.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose a photo smaller than 15 MB.');
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.78);
}
export function captureFrame(video: HTMLVideoElement): string {
  if (video.readyState < 2 || !video.videoWidth)
    throw new Error('Your camera is still warming up. Try again in a moment.');
  const c = document.createElement('canvas');
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  c.width = Math.round(video.videoWidth * scale);
  c.height = Math.round(video.videoHeight * scale);
  c.getContext('2d')!.drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
