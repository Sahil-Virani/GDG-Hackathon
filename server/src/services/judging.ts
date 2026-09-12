import { neutral, normalizeJudgment } from '../state/game.js';
import type { Judgment } from '../../../shared/schema.js';
// Fallbacks keep the game moving, so log why Gemini failed. Never log images or credentials.
export function logAiError(task: string, error: unknown) {
  const e = error as { name?: string; status?: number; message?: string } | undefined;
  const detail = String(e?.message ?? error)
    .replace(/\s+/g, ' ')
    .slice(0, 300);
  console.warn(
    `Gemini ${task} failed${e?.status ? ` (HTTP ${e.status})` : ''}: ${e?.name ?? 'Error'}: ${detail}`,
  );
}
export async function judgeWithRetry(
  request: () => Promise<unknown>,
): Promise<Judgment & { fallback?: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++)
    try {
      return normalizeJudgment(await request());
    } catch (error) {
      /* Retry one provider or structured-output failure. */
      logAiError(`judge attempt ${attempt + 1}/2`, error);
    }
  return {
    ...neutral('The AI judge is unavailable. A neutral score keeps you in the battle.'),
    fallback: true,
  };
}
