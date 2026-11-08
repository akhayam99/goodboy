// @vitest-environment node
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const TAURI = join(__dirname, '..', '..', '..', 'src-tauri');
const CAPABILITIES = join(TAURI, 'capabilities');

const BROWSER_LABELS = ['browse-', 'browse-0f1e', 'browse-6c1d2f3a-0b4e-4c2d-8f00-1a2b3c4d5e6f'];

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

const globMatches = ({ pattern, label }: GlobParams): boolean => {
  const reachable = Array.from({ length: label.length + 1 }, () => false);
  reachable[0] = true;
  for (const token of pattern) {
    if (token === '*') {
      for (let index = 1; index <= label.length; index += 1) {
        reachable[index] = reachable[index] === true || reachable[index - 1] === true;
      }
      continue;
    }
    for (let index = label.length; index >= 1; index -= 1) {
      const isSame = token === '?' || token === label[index - 1];
      reachable[index] = reachable[index - 1] === true && isSame;
    }
    reachable[0] = false;
  }
  return reachable[label.length] === true;
};

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

  it('names no label a browser tab can carry in any capability file', () => {
    const matched = readCapabilities().flatMap((capability) =>
      labelPatterns(capability)
        .filter((pattern) => BROWSER_LABELS.some((label) => globMatches({ pattern, label })))
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
