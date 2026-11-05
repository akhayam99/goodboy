import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WEBSITE_DIRECTORY } from '../paths.mjs';

export const readGroups = ({ file }) =>
  readFileSync(resolve(WEBSITE_DIRECTORY, '..', file), 'utf8')
    .split('\n')
    .flatMap((line) => {
      if (line.startsWith('## ')) {
        return [line.slice(3).trim()];
      }
      const summary = line.match(/^<summary><h2>(.*)<\/h2><\/summary>/);
      return summary === null ? [] : [summary[1].trim()];
    });
