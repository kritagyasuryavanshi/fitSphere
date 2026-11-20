import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// npm run eval:ai: the AI guide's eval set only (src/**/*.eval.ts); the unit tests keep their own config. It reads
// apps/web/.env.local too, where Next reads AI_PROVIDER and ANTHROPIC_API_KEY, so a real run is not missed.
export default defineConfig(({ mode }) => ({ test: { include: ['src/**/*.eval.ts'], env: loadEnv(mode, process.cwd(), '') } }));
