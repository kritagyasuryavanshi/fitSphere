import { fakeModel, type Model } from './answer';
import { claudeModel } from './claude';
import { geminiModel } from './gemini';

/**
 * The answer model, or null when the AI guide is off. Claude needs ANTHROPIC_API_KEY (the owner's account; each
 * question costs money). Gemini needs GEMINI_API_KEY; on its free tier Google may use prompts to improve its
 * products, so it runs only outside production, as the fake answerer does: both need a positive sign that this is not
 * production (a Vercel preview or development, or the E2E test server), as the fake payment provider does.
 */
export function aiModel(env: NodeJS.ProcessEnv = process.env): Model | null {
  if (env.AI_PROVIDER === 'claude' && env.ANTHROPIC_API_KEY) return claudeModel(env.ANTHROPIC_API_KEY);
  const notProduction = env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'development' || (!env.VERCEL_ENV && env.E2E_AUTH_CONFIRM === '1');
  if (env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY && notProduction) return geminiModel(env.GEMINI_API_KEY);
  if (env.AI_PROVIDER === 'fake' && notProduction) return fakeModel;
  return null;
}
