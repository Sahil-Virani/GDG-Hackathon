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
    GOOGLE_GENAI_USE_VERTEXAI: z.enum(['true', 'false']).default('false'),
    GOOGLE_CLOUD_PROJECT: z.string().default(''),
    GOOGLE_CLOUD_LOCATION: z.string().default(''),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().default(''),
  })
  .parse(process.env);
export const config = {
  ...env,
  demo: env.DEMO_MODE === 'true',
  videoEnabled: !!(env.VONAGE_APPLICATION_ID && env.VONAGE_PRIVATE_KEY_PATH),
  vertexEnabled: env.GOOGLE_GENAI_USE_VERTEXAI === 'true',
};
const geminiConfigured = config.vertexEnabled
  ? !!(config.GOOGLE_CLOUD_PROJECT && config.GOOGLE_CLOUD_LOCATION && config.GOOGLE_APPLICATION_CREDENTIALS)
  : !!config.GEMINI_API_KEY;
if (!config.demo && (!geminiConfigured || !config.videoEnabled))
  throw new Error(
    'Live mode requires either GEMINI_API_KEY or (GOOGLE_GENAI_USE_VERTEXAI=true with GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GOOGLE_APPLICATION_CREDENTIALS), plus VONAGE_APPLICATION_ID and VONAGE_PRIVATE_KEY_PATH. See .env.example.',
  );
