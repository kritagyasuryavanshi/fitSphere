import { fakeModel, type Model } from './answer';
import { claudeModel } from './claude';

/**
 * The answer model, or null when the AI guide is off. Claude needs ANTHROPIC_API_KEY (the owner's account; each
 * question costs money). The fake answerer runs only with AI_PROVIDER=fake and a positive sign that this is not
 * production (a Vercel preview or development, or the E2E test server), as the fake payment provider does.
 */
export function aiModel(env: NodeJS.ProcessEnv = process.env): Model | null {
  if (env.AI_PROVIDER === 'claude' && env.ANTHROPIC_API_KEY) return claudeModel(env.ANTHROPIC_API_KEY);
  const notProduction = env.VERCEL_ENV === 'preview' || env.VERCEL_ENV === 'development' || (!env.VERCEL_ENV && env.E2E_AUTH_CONFIRM === '1');
  if (env.AI_PROVIDER === 'fake' && notProduction) return fakeModel;
  return null;
}
