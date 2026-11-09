import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// ui holds presentation only: no business rules, no framework routing, no database.
export default tseslint.config(js.configs.recommended, ...tseslint.configs.strict, {
  plugins: { 'react-hooks': reactHooks },
  rules: {
    ...reactHooks.configs.recommended.rules,
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['@fitsphere/*'], message: 'ui must not depend on other workspaces.' },
          { group: ['next', 'next/*'], message: 'ui stays framework-free so it can move to other apps.' },
        ],
      },
    ],
  },
});
