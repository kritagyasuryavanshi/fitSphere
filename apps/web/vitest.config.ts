import { configDefaults, defineConfig } from 'vitest/config';

// Playwright owns e2e/; keep Vitest out of it.
export default defineConfig({ test: { exclude: [...configDefaults.exclude, 'e2e/**'] } });
