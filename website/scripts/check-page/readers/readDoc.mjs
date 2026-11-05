import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_DIRECTORY } from '../paths.mjs';

export const readDoc = ({ file }) => {
  const path = resolve(REPO_DIRECTORY, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
};
