// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { providerFlags } from '@goodboy/core';
import { PROVIDER_IDS } from '@goodboy/types';
import { describe, expect, it } from 'vitest';

const RUST_SPEC = readFileSync(
  join(__dirname, '..', '..', '..', 'src-tauri', 'src', 'providers', 'spec.rs'),
  'utf8',
);

type Row = {
  readonly id: string;
  readonly binary: string;
  readonly hasChatShape: boolean;
};

const ROW =
  /ProviderSpec \{\s*id: "([a-z]+)",\s*cli: Cli::[A-Za-z]+,\s*binary: "([a-z-]+)",\s*chat_shape: (None|Some\("[a-z]+"\)),/g;

const rustRows = (): ReadonlyArray<Row> =>
  [...RUST_SPEC.matchAll(ROW)].map((match) => ({
    id: match[1] ?? '',
    binary: match[2] ?? '',
    hasChatShape: match[3] !== 'None',
  }));

describe('provider spec parity between Rust and TypeScript', () => {
  it('reads one Rust row per provider id, in the same order', () => {
    expect(rustRows().map((row) => row.id)).toEqual([...PROVIDER_IDS]);
  });

  it('runs every provider on the binary the TypeScript flags name', () => {
    for (const id of PROVIDER_IDS) {
      const row = rustRows().find((candidate) => candidate.id === id);
      expect(row?.binary, id).toBe(providerFlags({ id }).binary);
    }
  });

  it('keeps the read-only chat shape to the two providers whose CLI supports it', () => {
    expect(rustRows().flatMap((row) => (row.hasChatShape ? [row.id] : []))).toEqual([
      'anthropic',
      'codex',
    ]);
  });
});
