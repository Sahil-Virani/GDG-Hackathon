import { neutral, normalizeJudgment } from '../state/game.js';
import type { Judgment } from '../../../shared/schema.js';
export async function judgeWithRetry(
  request: () => Promise<unknown>,
): Promise<Judgment & { fallback?: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++)
    try {
      return normalizeJudgment(await request());
    } catch {
      /* Retry one provider or structured-output failure. */
    }
  return {
    ...neutral('The AI judge is unavailable. A neutral score keeps you in the battle.'),
    fallback: true,
  };
}
