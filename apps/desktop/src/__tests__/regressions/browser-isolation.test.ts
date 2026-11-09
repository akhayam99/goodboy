// @vitest-environment node
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const TAURI = join(__dirname, '..', '..', '..', 'src-tauri');
const CAPABILITIES = join(TAURI, 'capabilities');

const HEX = '0123456789abcdef';
const BROWSER_LABEL_SLOTS: readonly string[] = [
  ...'browse-',
  ...Array.from({ length: 8 }, () => HEX),
  '-',
  ...Array.from({ length: 4 }, () => HEX),
  '-',
  '4',
  ...Array.from({ length: 3 }, () => HEX),
  '-',
  ...Array.from({ length: 4 }, () => HEX),
  '-',
  ...Array.from({ length: 12 }, () => HEX),
];

type Capability = {
  readonly file: string;
  readonly windows?: readonly string[];
  readonly webviews?: readonly string[];
  readonly remote?: unknown;
};

type TauriConfig = {
  readonly app: {
    readonly security: { readonly capabilities?: readonly unknown[] };
  };
};

type GlobOverlapParams = {
  readonly pattern: string;
  readonly slots: readonly string[];
};

type GlobParams = {
  readonly pattern: string;
  readonly label: string;
};

const readCapabilities = (): readonly Capability[] =>
  readdirSync(CAPABILITIES)
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({ ...JSON.parse(readFileSync(join(CAPABILITIES, file), 'utf8')), file }));

const readConfig = (): TauriConfig =>
  JSON.parse(readFileSync(join(TAURI, 'tauri.conf.json'), 'utf8'));

const globOverlaps = ({ pattern, slots }: GlobOverlapParams): boolean => {
  const reachable = Array.from({ length: slots.length + 1 }, () => false);
  reachable[0] = true;
  for (const token of pattern) {
    if (token === '*') {
      for (let index = 1; index <= slots.length; index += 1) {
        reachable[index] = reachable[index] === true || reachable[index - 1] === true;
      }
      continue;
    }
    for (let index = slots.length; index >= 1; index -= 1) {
      const isSame = token === '?' || slots[index - 1]?.includes(token) === true;
      reachable[index] = reachable[index - 1] === true && isSame;
    }
    reachable[0] = false;
  }
  return reachable[slots.length] === true;
};

const globMatches = ({ pattern, label }: GlobParams): boolean =>
  globOverlaps({ pattern, slots: [...label] });

const labelPatterns = (capability: Capability): readonly string[] => [
  ...(capability.windows ?? []),
  ...(capability.webviews ?? []),
];

describe('the browser webviews get no capability', () => {
  it('matches the glob the way tauri does for the labels it checks', () => {
    expect(globMatches({ pattern: 'win-*', label: 'win-2' })).toBe(true);
    expect(globMatches({ pattern: 'win-*', label: 'browse-0f1e' })).toBe(false);
    expect(globMatches({ pattern: '*', label: 'browse-0f1e' })).toBe(true);
    expect(globMatches({ pattern: 'b?owse-*', label: 'browse-0f1e' })).toBe(true);
    expect(globMatches({ pattern: 'main', label: 'main' })).toBe(true);
    expect(globMatches({ pattern: 'main', label: 'browse-main' })).toBe(false);
  });

  it('finds a pattern that reaches any label shaped like a real tab label', () => {
    const reaches = (pattern: string) => globOverlaps({ pattern, slots: BROWSER_LABEL_SLOTS });
    expect(reaches('browse-a*')).toBe(true);
    expect(reaches('browse-*')).toBe(true);
    expect(reaches('b*')).toBe(true);
    expect(reaches('*')).toBe(true);
    expect(reaches('browse-????????-????-4???-????-????????????')).toBe(true);
    expect(reaches('browse-6c1d2f3a-0b4e-4c2d-8f00-1a2b3c4d5e6f')).toBe(true);
    expect(reaches('browse-g*')).toBe(false);
    expect(reaches('browse-0f1e')).toBe(false);
    expect(reaches('win-*')).toBe(false);
    expect(reaches('main')).toBe(false);
  });

  it('names no label a browser tab can carry in any capability file', () => {
    const matched = readCapabilities().flatMap((capability) =>
      labelPatterns(capability)
        .filter((pattern) => globOverlaps({ pattern, slots: BROWSER_LABEL_SLOTS }))
        .map((pattern) => `${capability.file}: ${pattern}`),
    );
    expect(matched).toEqual([]);
  });

  it('writes every label as a plain name or a star glob, so this test can read it', () => {
    const unreadable = readCapabilities().flatMap((capability) =>
      labelPatterns(capability).filter((pattern) => /[[\]{}!\\]/.test(pattern)),
    );
    expect(unreadable).toEqual([]);
  });

  it('grants by webview label and never by window, so a tab inside a window gets nothing', () => {
    const byWindow = readCapabilities()
      .filter((capability) => (capability.windows ?? []).length > 0)
      .map((capability) => capability.file);
    expect(byWindow).toEqual([]);
  });

  it('grants no remote address in any capability file', () => {
    const remote = readCapabilities()
      .filter((capability) => capability.remote !== undefined)
      .map((capability) => capability.file);
    expect(remote).toEqual([]);
  });

  it('keeps capabilities out of tauri.conf.json, where this test would not see them', () => {
    expect(readConfig().app.security.capabilities ?? []).toEqual([]);
  });
});
