/** Browsers may leave permission prompts pending forever. Late streams must be released. */
export function requestMedia(
  constraints: MediaStreamConstraints,
  timeoutMs = 12000,
): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(
        new DOMException('Camera permission timed out. Allow access, then retry.', 'TimeoutError'),
      );
    }, timeoutMs);
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (settled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        settled = true;
        clearTimeout(timeout);
        resolve(stream);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });
  });
}
