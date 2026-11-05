import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// core holds pure business rules: it must not import other workspaces, React or Node-only modules.
export default tseslint.config(js.configs.recommended, ...tseslint.configs.strict, {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['@fitsphere/*'], message: 'core must not depend on other workspaces.' },
          { group: ['react', 'react-dom', 'next', 'next/*'], message: 'core is framework-free.' },
          { group: ['node:*', 'fs', 'path'], message: 'core must run anywhere (browser, server, phone).' },
        ],
      },
    ],
  },
});
