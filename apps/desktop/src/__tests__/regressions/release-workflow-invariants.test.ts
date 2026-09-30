// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP_SRC = join(__dirname, '..', '..');
const REPO_ROOT = join(DESKTOP_SRC, '..', '..', '..');
const RELEASE_WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'release.yml');
const RELEASE_CACHE_WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'release-cache.yml');

const TAURI_ACTION_SHA = '1deb371b0cd8bd54025b384f1cd735e725c4060f';

const stripComments = (block: string): string =>
  block
    .split('\n')
    .map((line) => line.replace(/(^|\s)#.*$/, '$1'))
    .join('\n');

const splitAtJobs = (content: string): { header: string; jobs: string } => {
  const lines = stripComments(content).split('\n');
  const index = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (index === -1) {
    throw new Error('workflow has no top-level "jobs:" key anymore. Update this guard.');
  }
  return {
    header: lines.slice(0, index).join('\n'),
    jobs: lines.slice(index + 1).join('\n'),
  };
};

const extractJobBlocks = (jobs: string): Map<string, string> => {
  const lines = jobs.split('\n');
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

const jobBlock = (blocks: Map<string, string>, name: string): string => {
  const block = blocks.get(name);
  if (block == null) {
    throw new Error(`release.yml has no top-level "${name}:" job anymore. Update this guard.`);
  }
  return block;
};

const contentsPermission = (block: string): string | null => {
  const lines = block.split('\n');
  const inline = lines.map((line) => /^\s*permissions:\s*(\S.*)$/.exec(line)?.[1]).find(Boolean);
  if (inline != null) {
    return inline.trim();
  }
  const start = lines.findIndex((line) => /^\s*permissions:\s*$/.test(line));
  if (start === -1) {
    return null;
  }
  const indent = /^\s*/.exec(lines[start] ?? '')?.[0].length ?? 0;
  for (const line of lines.slice(start + 1)) {
    const lead = /^\s*/.exec(line)?.[0].length ?? 0;
    if (line.trim() !== '' && lead <= indent) {
      return 'none';
    }
    const match = /^\s*contents:\s*(\S+)\s*$/.exec(line);
    if (match?.[1] != null) {
      return match[1];
    }
  }
  return 'none';
};

const canWrite = (permission: string): boolean =>
  permission === 'write' || permission === 'write-all';

const parseNeeds = (block: string): string[] => {
  const lines = block.split('\n');
  const index = lines.findIndex((line) => /^\s*needs:/.test(line));
  if (index === -1) {
    return [];
  }
  const rest = (lines[index] ?? '').replace(/^\s*needs:\s*/, '').trim();
  if (rest.startsWith('[')) {
    return rest
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .sort();
  }
  if (rest !== '') {
    return [rest];
  }
  const items: string[] = [];
  for (const line of lines.slice(index + 1)) {
    const match = /^\s+-\s*(\S+)\s*$/.exec(line);
    if (match?.[1] == null) {
      break;
    }
    items.push(match[1]);
  }
  return items.sort();
};

const countMatches = (text: string, pattern: RegExp): number =>
  text.match(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`))?.length ?? 0;

describe('release workflow guardrails', () => {
  const content = readFileSync(RELEASE_WORKFLOW, 'utf8');
  const { header, jobs } = splitAtJobs(content);
  const blocks = extractJobBlocks(jobs);
  const macos = jobBlock(blocks, 'macos');
  const linux = jobBlock(blocks, 'linux');
  const attach = jobBlock(blocks, 'attach');
  const workflow = stripComments(content);

  const effectiveContents = (block: string): string =>
    contentsPermission(block) ?? contentsPermission(header) ?? 'write';

  it('has exactly the macos, linux and attach jobs', () => {
    expect([...blocks.keys()].sort()).toEqual(['attach', 'linux', 'macos']);
  });

  it('never publishes a release, only drafts', () => {
    const drafts = [...workflow.matchAll(/releaseDraft:\s*(\S+)/g)].map((match) => match[1]);
    expect(drafts.length, 'the tauri-action step must set releaseDraft').toBeGreaterThan(0);
    expect(
      drafts.every((value) => value === 'true'),
      'every releaseDraft must be true',
    ).toBe(true);
    expect(/releaseDraft:\s*true/.test(macos), 'macos job must set releaseDraft: true').toBe(true);
    expect(/--draft(=|\s+)false/.test(workflow), 'no gh call may un-draft a release').toBe(false);
    expect(/gh release (edit|create|delete)/.test(workflow), 'no gh call may publish').toBe(false);
    expect(/--latest/.test(workflow), 'no gh call may mark a release latest').toBe(false);
  });

  it('lets only the macos job create the release and write latest.json and signatures', () => {
    expect(countMatches(workflow, /uses:\s*tauri-apps\/tauri-action@/)).toBe(1);
    expect(/uses:\s*tauri-apps\/tauri-action@/.test(macos)).toBe(true);
    expect(/uploadUpdaterJson:\s*false/.test(macos), 'macos must keep latest.json on').toBe(false);
    expect(/uploadUpdaterSignatures:\s*false/.test(macos), 'macos must keep signatures on').toBe(
      false,
    );
    expect(
      /TAURI_SIGNING_PRIVATE_KEY:\s*\$\{\{\s*secrets\.TAURI_SIGNING_PRIVATE_KEY\s*\}\}/.test(macos),
    ).toBe(true);
    for (const [name, block] of [
      ['linux', linux],
      ['attach', attach],
    ] as const) {
      expect(/TAURI_SIGNING/.test(block), `${name} must not hold updater signing keys`).toBe(false);
      expect(/APPLE_/.test(block), `${name} must not hold apple signing secrets`).toBe(false);
    }
    expect(/latest\.json/.test(linux), 'linux must not touch latest.json').toBe(false);
  });

  it('lets attach upload only the three linux bundles and nothing else', () => {
    expect(countMatches(workflow, /gh release upload/), 'exactly one gh release upload').toBe(1);
    expect(/gh release upload/.test(attach), 'the upload must live in attach').toBe(true);
    expect(/-print0\s*\\\n\s*\|\s*xargs -0 gh release upload/.test(attach)).toBe(true);
    const find = /find linux-bundles -type f \\\(([^\n]*?)\\\) -print0/.exec(attach);
    expect(find, 'the upload must be fed by find over linux-bundles').not.toBeNull();
    const names = [...(find?.[1] ?? '').matchAll(/-name '([^']+)'/g)].map((match) => match[1]);
    expect(names.sort()).toEqual(['*.AppImage', '*.deb', '*.rpm']);
  });

  it('makes attach refuse a missing, duplicate or already published release', () => {
    expect(/select\(\.tag_name == env\.TAG\)/.test(attach)).toBe(true);
    expect(
      /\[ "\$count" != "1" \]; then\s*\n\s*echo "expected exactly one release for \$TAG/.test(
        attach,
      ),
      'attach must require exactly one release',
    ).toBe(true);
    expect(
      /\[ "\$\{found#\* \}" != "true" \]/.test(attach),
      'attach must require the release to be a draft',
    ).toBe(true);
  });

  it('never signs linux bundles and never runs tauri-action in linux', () => {
    expect(/tauri-apps\/tauri-action/.test(linux)).toBe(false);
    expect(
      /tauri build --bundles appimage,deb,rpm --no-sign\s*$/m.test(linux),
      'linux job must build appimage,deb,rpm with --no-sign',
    ).toBe(true);
    expect(/secrets\./.test(linux), 'linux job must not read any secret').toBe(false);
  });

  it('builds linux in parallel with macos and hands its bundles to attach by artifact', () => {
    expect(parseNeeds(macos)).toEqual([]);
    expect(parseNeeds(linux)).toEqual([]);
    expect(/^\s*name:\s*goodboy-linux-bundles\s*$/m.test(linux)).toBe(true);
    expect(/if-no-files-found:\s*error/.test(linux)).toBe(true);
    expect(/^\s*name:\s*goodboy-linux-bundles\s*$/m.test(attach)).toBe(true);
  });

  it('makes attach wait for both platform jobs', () => {
    expect(parseNeeds(attach)).toEqual(['linux', 'macos']);
  });

  it('gives contents: write only to macos and attach, and keeps linux read-only', () => {
    const writers = [...blocks.entries()]
      .filter(([, block]) => canWrite(effectiveContents(block)))
      .map(([name]) => name)
      .sort();
    expect(writers).toEqual(['attach', 'macos']);
    expect(contentsPermission(attach)).toBe('write');
    expect(contentsPermission(linux)).toBe('read');
    expect(/:\s*write/.test(linux), 'linux must not request any write scope').toBe(false);
  });

  it('exposes attach to the github token only', () => {
    const secrets = [...attach.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((match) => match[1]);
    expect(secrets.length).toBeGreaterThan(0);
    expect(secrets.every((secret) => secret === 'GITHUB_TOKEN')).toBe(true);
  });

  it('pins tauri-action to the reviewed sha in the macos job', () => {
    const pin = new RegExp(`tauri-apps/tauri-action@${TAURI_ACTION_SHA}(\\s|$)`);
    expect(pin.test(macos), 'macos job must pin tauri-action to the reviewed sha').toBe(true);
    const uses = [...workflow.matchAll(/uses:\s*tauri-apps\/tauri-action@(\S+)/g)].map(
      (match) => match[1],
    );
    expect(uses).toEqual([TAURI_ACTION_SHA]);
  });
});

describe('release cache workflow guardrails', () => {
  const content = readFileSync(RELEASE_CACHE_WORKFLOW, 'utf8');
  const workflow = stripComments(content);
  const { header, jobs } = splitAtJobs(content);

  it('never triggers on tags or pull requests', () => {
    expect(/^on:/m.test(header)).toBe(true);
    expect(/\btags(-ignore)?:/.test(header), 'no tag trigger').toBe(false);
    expect(/\bpull_request/.test(header), 'no pull_request trigger').toBe(false);
    expect(/\bworkflow_run\b/.test(header), 'no workflow_run trigger').toBe(false);
    expect(/^ {2}push:\s*$/m.test(header)).toBe(true);
    expect(/^ {4}branches:\s*\[\s*main\s*\]\s*$/m.test(header)).toBe(true);
  });

  it('uses no secrets and no write scope', () => {
    expect(/\bsecrets\b/.test(workflow), 'release-cache must not reference secrets').toBe(false);
    expect(contentsPermission(header)).toBe('read');
    expect(/:\s*write/.test(workflow), 'release-cache must not request any write scope').toBe(
      false,
    );
    expect(/tauri-apps\/tauri-action/.test(jobs)).toBe(false);
    expect(/gh release/.test(jobs)).toBe(false);
  });
});
