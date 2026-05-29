const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      indent: ['warn', 2, { SwitchCase: 1 }],
      'linebreak-style': ['warn', 'windows'],
      quotes: ['warn', 'single'],
      semi: ['error', 'always'],
    },
  },
];
