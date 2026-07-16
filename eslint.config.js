const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['memes-archive/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['src/main/**/*.js', 'src/preload/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      sourceType: 'commonjs',
    },
  },
  {
    files: ['src/renderer/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      sourceType: 'script',
    },
  },
  {
    rules: {
      indent: ['warn', 2, { SwitchCase: 1 }],
      quotes: ['warn', 'single'],
      semi: ['error', 'always'],
    },
  },
];
