import { defineConfig } from 'vitest/config';

// npm run eval:ai: the AI guide's eval set only (src/**/*.eval.ts); the unit tests keep their own config.
export default defineConfig({ test: { include: ['src/**/*.eval.ts'] } });
