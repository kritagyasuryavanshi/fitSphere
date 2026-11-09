import js from '@eslint/js';
import { globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// db holds the schema and the typed client: no UI, no framework.
export default tseslint.config(globalIgnores(['src/database.types.ts']), js.configs.recommended, ...tseslint.configs.strict, {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['@fitsphere/*'], message: 'db must not depend on other workspaces.' },
          { group: ['react', 'react-dom', 'next', 'next/*'], message: 'db is framework-free.' },
        ],
      },
    ],
  },
});
