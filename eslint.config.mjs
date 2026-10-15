export default [{
  ignores: ["node_modules/**", ".next/**", ".vercel/**"],
}, {
  files: ["**/*.{js,mjs}"],
  languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
  rules: {
    "constructor-super": "error", "for-direction": "error", "getter-return": "error",
    "no-async-promise-executor": "error", "no-const-assign": "error", "no-dupe-args": "error",
    "no-dupe-else-if": "error", "no-dupe-keys": "error", "no-duplicate-case": "error",
    "no-func-assign": "error", "no-import-assign": "error", "no-loss-of-precision": "error",
    "no-promise-executor-return": "error", "no-self-assign": "error", "no-setter-return": "error",
    "no-sparse-arrays": "error", "no-this-before-super": "error", "no-unexpected-multiline": "error",
    "no-unreachable": "error", "no-unsafe-finally": "error", "use-isnan": "error", "valid-typeof": "error"
  }
}];
