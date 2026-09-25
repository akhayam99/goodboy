import { describe, expect, it } from 'vitest';
import { extractPreviewLine } from './extractPreviewLine';

describe('extractPreviewLine', () => {
  it('skips the shebang and the shell preamble to the first line that runs something', () => {
    const body = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'set -o pipefail',
      'cd "$(dirname "$0")/.."',
      'pnpm --filter @goodboy/desktop test',
    ].join('\n');

    expect(extractPreviewLine({ body })).toBe('pnpm --filter @goodboy/desktop test');
  });

  it('skips comments, which describe the script rather than run it', () => {
    const body = ['# replay the settlement batch', '', 'node scripts/replay.mjs'].join('\n');

    expect(extractPreviewLine({ body })).toBe('node scripts/replay.mjs');
  });

  it('says the script is empty when nothing in it runs', () => {
    const body = ['#!/bin/sh', 'set -e', '# nothing here yet', ''].join('\n');

    expect(extractPreviewLine({ body })).toBe('empty script');
  });

  it('keeps a first line that only looks like a preamble', () => {
    expect(extractPreviewLine({ body: 'settings --set -x' })).toBe('settings --set -x');
    expect(extractPreviewLine({ body: 'cd packages/ui' })).toBe('cd packages/ui');
  });
});
