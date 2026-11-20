import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { Model } from './answer';

const Reply = z.object({ answer: z.string(), cited: z.array(z.string()) });

/**
 * The real model: Claude Opus 5.5 through the Anthropic SDK, with a structured reply ({answer, cited}). Effort low:
 * short, grounded chat answers. Server-side refusal fallbacks are on ("default" routes by refusal category); a refusal
 * that survives them returns null, which the service turns into a safe refusal.
 */
// shortcut: never run against the live API in tests (it costs money per question); exercise it once the owner adds
// ANTHROPIC_API_KEY, and check the structured reply and fallbacks together on a real request.
export function claudeModel(apiKey: string): Model {
  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  return {
    async answer({ system, user }) {
      const response = await client.beta.messages.parse({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { effort: 'low', format: betaZodOutputFormat(Reply) },
      });
      if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;
      return response.parsed_output ?? null;
    },
  };
}
