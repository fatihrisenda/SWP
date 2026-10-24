// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': ['warn', { allow: ['error'] }],
    },
  },
  {
    files: ['prisma/**/*.ts'],
    rules: {
      // Skrip seed CLI: output informatif ke stdout wajar dan bukan debug sisa.
      'no-console': 'off',
    },
  },
);
