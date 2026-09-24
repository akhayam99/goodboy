import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const CALLEES = ['showToast', 'previewNotification', 'reportError', 'emitNotification'];

const COPY_FIELD = /\b(title|message):\s*(['"`])([^'"`$])/g;

const collectSourceFiles = ({ dir }: { readonly dir: string }): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return collectSourceFiles({ dir: full });
    }
    if (/\.test\.tsx?$/.test(entry) || !/\.tsx?$/.test(entry)) {
      return [];
    }
    return [full];
  });

const callBodies = ({ contents }: { readonly contents: string }): ReadonlyArray<string> => {
  const bodies: Array<string> = [];
  const pattern = new RegExp(`\\b(?:${CALLEES.join('|')})\\(\\{`, 'g');
  for (const match of contents.matchAll(pattern)) {
    const start = match.index + match[0].length - 1;
    let depth = 0;
    let end = start;
    for (let index = start; index < contents.length; index += 1) {
      const char = contents[index];
      if (char === '{') {
        depth += 1;
      }
      if (char === '}') {
        depth -= 1;
      }
      if (depth === 0) {
        end = index;
        break;
      }
    }
    bodies.push(contents.slice(start, end + 1));
  }
  return bodies;
};

const lowercaseCopy = ({ file }: { readonly file: string }): ReadonlyArray<string> =>
  callBodies({ contents: readFileSync(file, 'utf8') }).flatMap((body) =>
    [...body.matchAll(COPY_FIELD)].flatMap((match) => {
      const first = match[3] ?? '';
      return first !== first.toLowerCase() || first === first.toUpperCase()
        ? []
        : [`${relative(SRC, file)}: ${match[1]} starts with "${first}"`];
    }),
  );

describe('feedback copy', () => {
  it('writes toast and notification titles and messages as sentences', () => {
    const offenders = collectSourceFiles({ dir: SRC }).flatMap((file) => lowercaseCopy({ file }));
    expect(offenders).toEqual([]);
  });
});
