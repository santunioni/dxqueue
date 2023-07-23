module.exports = {
  ignorePatterns: ['dist/**/*.js', '.eslintrc.js', '**/*.d.ts'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
}
