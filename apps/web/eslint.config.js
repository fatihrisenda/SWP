// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'dev-dist/**', 'coverage/**', 'node_modules/**', '*.config.cjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['error'] }],
      // Aturan proyek (Issue 034/039): tidak ada string UI hard-coded & tidak ada API eksternal.
      // `no-restricted-globals` dipakai (bukan selector nama) agar `const confirm = useConfirm()`
      // milik proyek sendiri tidak ikut kena; yang dilarang hanya dialog bawaan browser.
      'no-restricted-globals': ['error', 'alert', 'confirm', 'prompt'],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name=/^(alert|confirm|prompt)$/]",
          message: 'Gunakan Dialog/useConfirm(), bukan dialog bawaan window.',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML dilarang (XSS).',
        },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name=/^(alert|confirm|prompt)$/]",
          message: 'Gunakan Dialog/useConfirm(), bukan dialog bawaan window.',
        },
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML dilarang (XSS).',
        },
        {
          selector: "JSXText[value=/[A-Za-z]{3}(\\s+[A-Za-z]{2,}){2,}/]",
          message: 'Teks UI harus lewat i18n: gunakan t("…") (Issue 039).',
        },
      ],
    },
  },
  {
    files: ['test/**/*.ts', 'src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-restricted-syntax': 'off', 'no-console': 'off' },
  },
  {
    files: ['vite.config.ts', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-syntax': 'off', 'no-console': 'off' },
  },
);
