import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');
const RELEASE_WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'release.yml');

const TAURI_ACTION_SHA = '1deb371b0cd8bd54025b384f1cd735e725c4060f';

const extractJobBlocks = (content: string): Map<string, string> => {
  const lines = content.split('\n');
  const headers: Array<{ name: string; index: number }> = [];
  lines.forEach((line, index) => {
    const match = /^ {2}([a-zA-Z0-9_-]+):\s*$/.exec(line);
    if (match?.[1] != null) {
      headers.push({ name: match[1], index });
    }
  });
  const blocks = new Map<string, string>();
  headers.forEach((header, i) => {
    const end = headers[i + 1]?.index ?? lines.length;
    blocks.set(header.name, lines.slice(header.index, end).join('\n'));
  });
  return blocks;
};

const jobBlock = (content: string, name: string): string => {
  const block = extractJobBlocks(content).get(name);
  if (block == null) {
    throw new Error(`release.yml has no top-level "${name}:" job anymore. Update this guard.`);
  }
  return block;
};

describe('release workflow guardrails', () => {
  const content = readFileSync(RELEASE_WORKFLOW, 'utf8');
  const macos = jobBlock(content, 'macos');
  const linux = jobBlock(content, 'linux');

  it('pins tauri-action to a known sha in both jobs', () => {
    const pin = new RegExp(`tauri-apps/tauri-action@${TAURI_ACTION_SHA}`);
    expect(pin.test(macos), 'macos job must pin tauri-action to the reviewed sha').toBe(true);
    expect(pin.test(linux), 'linux job must pin tauri-action to the reviewed sha').toBe(true);
  });

  it('drafts the release in both jobs, never publishing straight from CI', () => {
    const releaseDraft = /releaseDraft:\s*true/;
    expect(releaseDraft.test(macos), 'macos job must set releaseDraft: true').toBe(true);
    expect(releaseDraft.test(linux), 'linux job must set releaseDraft: true').toBe(true);
  });

  it('leaves the macOS-authored updater manifest and signatures alone in the linux job', () => {
    expect(
      /uploadUpdaterJson:\s*false/.test(linux),
      'linux job must set uploadUpdaterJson: false so it never overwrites latest.json',
    ).toBe(true);
    expect(
      /uploadUpdaterSignatures:\s*false/.test(linux),
      'linux job must set uploadUpdaterSignatures: false',
    ).toBe(true);
  });

  it('builds unsigned linux bundles only, never claiming updater signing', () => {
    expect(
      /args:\s*--bundles\s+appimage,deb,rpm\s+--no-sign/.test(linux),
      'linux job must build appimage,deb,rpm with --no-sign',
    ).toBe(true);
  });

  it('serializes the linux job behind macos so it never races the release', () => {
    expect(/needs:\s*macos/.test(linux), 'linux job must declare needs: macos').toBe(true);
  });
});
