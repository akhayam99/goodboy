// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const ORIGIN = 'http://localhost:5173';
const SCRIPT = readFileSync(
  resolve(__dirname, '../../../src-tauri/src/browser/page_runtime/pick.js'),
  'utf8',
);

type SourceParams = {
  readonly map: Readonly<Record<string, unknown>>;
  readonly base: string;
};

const sourceOf = ({ map, base }: SourceParams): unknown =>
  runInNewContext(
    `${SCRIPT}
    const found = originalLineOf(map, 1, 1);
    JSON.stringify(
      found === null ? null : { path: originalPathOf(map, found.index, base), line: found.line },
    );`,
    {
      READ_EVENT: 'read',
      Url: URL,
      here: { origin: ORIGIN },
      window: { addEventListener: () => undefined },
      map,
      base,
    },
  );

const answerOf = (params: SourceParams): unknown => JSON.parse(String(sourceOf(params)));

describe('the file and line of a picked element', () => {
  it('names the original source of the mapping, not the module that was served', () => {
    expect(
      answerOf({
        map: {
          mappings: 'ACyCA',
          sources: ['../src/cart.ts', '../src/checkout/PayButton.tsx'],
        },
        base: `${ORIGIN}/assets/app.js.map`,
      }),
    ).toEqual({ path: '/src/checkout/PayButton.tsx', line: 42 });
  });

  it('puts the source root in front of the source', () => {
    expect(
      answerOf({
        map: { mappings: 'AAAA', sourceRoot: '/src', sources: ['PayButton.tsx'] },
        base: `${ORIGIN}/assets/app.js`,
      }),
    ).toEqual({ path: '/src/PayButton.tsx', line: 1 });
  });

  it('names no file for a source it cannot place under the served page', () => {
    const base = `${ORIGIN}/assets/app.js.map`;
    for (const sources of [
      ['webpack://acme/./src/PayButton.tsx'],
      ['../../src/PayButton.tsx'],
      [],
    ]) {
      expect(answerOf({ map: { mappings: 'AAAA', sources }, base })).toEqual({
        path: null,
        line: 1,
      });
    }
  });
});
