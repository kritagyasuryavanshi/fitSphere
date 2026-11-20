import { fakeModel, type Model } from './answer';
import { claudeModel } from './claude';
import { geminiModel } from './gemini';

/**
 * The answer model, or null when the AI guide is off. Claude needs ANTHROPIC_API_KEY (the owner's account; each
 * question costs money). The fake answerer runs only with a positive sign that this is not production (a Vercel preview
 * or development, or the E2E test server), as the fake payment provider does. Gemini's free tier is stricter: Google may
 * use its prompts to improve its products, and previews share the production database (real athletes), so it runs only
 * on a local test run (no Vercel deploy at all, E2E_AUTH_CONFIRM set), as the eval and the e2e server are.
 */
export function aiModel(env: NodeJS.ProcessEnv = process.env): Model | null {
  if (env.AI_PROVIDER === 'claude' && env.ANTHROPIC_API_KEY) return claudeModel(env.ANTHROPIC_API_KEY);
  const notProduction = env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'development' || (!env.VERCEL_ENV && env.E2E_AUTH_CONFIRM === '1');
  const localTest = !env.VERCEL_ENV && env.E2E_AUTH_CONFIRM === '1';
  if (env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY && localTest) return geminiModel(env.GEMINI_API_KEY);
  if (env.AI_PROVIDER === 'fake' && notProduction) return fakeModel;
  return null;
}
