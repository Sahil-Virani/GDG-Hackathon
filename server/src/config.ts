import 'dotenv/config';
import { z } from 'zod';
const env = z
  .object({
    DEMO_MODE: z.enum(['true', 'false']).default('true'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3002),
    ROUND_TIMEOUT_SECONDS: z.coerce.number().min(20).max(900).default(180),
    VONAGE_APPLICATION_ID: z.string().default(''),
    VONAGE_PRIVATE_KEY_PATH: z.string().default(''),
    GEMINI_API_KEY: z.string().default(''),
    GEMINI_SCORING_MODEL: z.string().default('gemini-3.8-flash'),
    GEMINI_IMAGE_MODEL: z.string().default('gemini-3.1-flash-image'),
  })
  .parse(process.env);
export const config = {
  ...env,
  demo: env.DEMO_MODE === 'true',
  videoEnabled: !!(env.VONAGE_APPLICATION_ID && env.VONAGE_PRIVATE_KEY_PATH),
};
if (!config.demo && (!config.GEMINI_API_KEY || !config.videoEnabled))
  throw new Error(
    'Live mode requires GEMINI_API_KEY, VONAGE_APPLICATION_ID and VONAGE_PRIVATE_KEY_PATH. See .env.example.',
  );
