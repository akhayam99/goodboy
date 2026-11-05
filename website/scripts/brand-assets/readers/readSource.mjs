import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPOSITORY_DIRECTORY } from '../paths.mjs';

export const readSource = (relativePath) =>
  readFileSync(resolve(REPOSITORY_DIRECTORY, relativePath), 'utf8');
