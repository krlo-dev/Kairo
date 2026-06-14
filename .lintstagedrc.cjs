/**
 * lint-staged config.
 *
 * ESLint v8 emite warning "File ignored because of a matching ignore pattern"
 * cuando se le pasa un path que cae dentro de su `ignorePatterns`. Con
 * `--max-warnings 0` eso tumba el pre-commit. La flag `--no-warn-ignored`
 * solo existe en ESLint v9, así que filtramos los archivos aquí antes de
 * invocar eslint y dejamos que prettier siga corriendo sobre todos.
 *
 * Patrones ignorados por ambos eslint configs: `*.cjs` y `*.config.ts`.
 */
const path = require('path');

// ESLint solo procesa .ts/.tsx en este monorepo; los .json/.css/.cjs se
// dejan a prettier. Ademas, los configs .config.ts estan en ignorePatterns
// de ambos workspaces.
const isLintable = (file) => {
  const base = path.basename(file);
  if (!/\.tsx?$/.test(base)) return false;
  if (/\.config\.ts$/.test(base)) return false;
  return true;
};

const quote = (files) => files.map((f) => `"${f}"`).join(' ');

const lintAndFormat = (files) => {
  const cmds = [`prettier --write ${quote(files)}`];
  const eslintFiles = files.filter(isLintable);
  if (eslintFiles.length > 0) {
    cmds.push(`eslint --fix --max-warnings 0 ${quote(eslintFiles)}`);
  }
  return cmds;
};

module.exports = {
  'backend/**/*.{ts,json}': lintAndFormat,
  'frontend/**/*.{ts,tsx,css,json}': lintAndFormat,
  '*.{md,yml,yaml}': ['prettier --write'],
};
