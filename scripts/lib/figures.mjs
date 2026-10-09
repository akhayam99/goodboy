import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FIGURES_PATH = resolve(ROOT_DIRECTORY, 'docs/figures.json');
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export const captionOf = ({ version }) => `<sub>Screenshot from Goodboy ${version}</sub>`;

export const readFigures = ({ path = FIGURES_PATH } = {}) => JSON.parse(readFileSync(path, 'utf8'));

export const appVersionOf = ({ override, root = ROOT_DIRECTORY } = {}) => {
  const version =
    override ??
    JSON.parse(readFileSync(resolve(root, 'apps/desktop/package.json'), 'utf8')).version;
  if (!VERSION_PATTERN.test(version)) {
    throw new Error(`"${version}" is not a version like 0.23.0`);
  }
  return version;
};

export const recordFigure = ({ key, version, recipe, path = FIGURES_PATH }) => {
  const figures = readFigures({ path });
  const entry = recipe === undefined ? { version } : { version, recipe };
  const next = { ...figures, [key]: entry };
  const sorted = Object.fromEntries(
    Object.keys(next)
      .sort()
      .map((name) => [name, next[name]]),
  );
  writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
  return entry;
};
