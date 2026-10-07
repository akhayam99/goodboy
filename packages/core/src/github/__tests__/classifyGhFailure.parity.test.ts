import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GH_BAD_CREDENTIALS_MARKERS,
  GH_CERTIFICATE_MARKERS,
  GH_EXPIRED_MARKERS,
  GH_MISSING_SCOPE_MARKERS,
  GH_NETWORK_MARKERS,
  GH_RATE_LIMIT_MARKERS,
} from '../classifyGhFailure';

const RUST_FILE = new URL('../../../../../apps/desktop/src-tauri/src/github.rs', import.meta.url);

const MARKER_LIST = /const (\w+_MARKERS): &\[&str\] = &\[([^\]]*)\];/g;
const STRING_LITERAL = /"((?:[^"\\]|\\.)*)"/g;

const TS_LISTS: Readonly<Record<string, ReadonlyArray<string>>> = {
  CERTIFICATE_MARKERS: GH_CERTIFICATE_MARKERS,
  NETWORK_MARKERS: GH_NETWORK_MARKERS,
  RATE_LIMIT_MARKERS: GH_RATE_LIMIT_MARKERS,
  EXPIRED_MARKERS: GH_EXPIRED_MARKERS,
  MISSING_SCOPE_MARKERS: GH_MISSING_SCOPE_MARKERS,
  BAD_CREDENTIALS_MARKERS: GH_BAD_CREDENTIALS_MARKERS,
};

const rustLists = (): Readonly<Record<string, ReadonlyArray<string>>> =>
  Object.fromEntries(
    Array.from(readFileSync(RUST_FILE, 'utf8').matchAll(MARKER_LIST), (match) => [
      match[1] ?? '',
      Array.from((match[2] ?? '').matchAll(STRING_LITERAL), (literal) => literal[1] ?? ''),
    ]),
  );

describe('gh failure markers match src-tauri/src/github.rs', () => {
  const rust = rustLists();

  it('finds every marker list the Rust side declares', () => {
    expect(Object.keys(rust).sort()).toEqual(Object.keys(TS_LISTS).sort());
  });

  it.each(Object.keys(TS_LISTS))('keeps %s equal, in the same order', (name) => {
    expect(rust[name]?.length).toBeGreaterThan(0);
    expect(TS_LISTS[name]).toEqual(rust[name]);
  });
});
