import { describe, expect, it, vi } from 'vitest';
import {
  collectDesignProfile,
  DESIGN_PROFILE_LIMITS,
  type DesignProfileEntry,
  type DesignProfileReadResult,
} from './collectDesignProfile';
import { describeDesignProfile } from './describeDesignProfile';

const ROOT = '/tmp/mount';

const GOODBOY_FILES: Record<string, string> = {
  'package.json': '{ "name": "goodboy" }',
  'tailwind.config.ts': "export default { theme: { extend: { colors: { brand: '#3355ff' } } } };",
  'packages/ui/src/styles.css':
    ':root {\n  --background: #0b0b0f;\n  --foreground: #f5f5f7;\n  --accent: #3355ff;\n}',
  'packages/ui/src/components/Button.tsx':
    "const styles = cva('base', {\n  variants: {\n    variant: {},\n    size: {},\n  },\n});",
  'packages/ui/src/components/Divider.tsx': 'export const Divider = () => <hr />;',
  'apps/desktop/src/App.tsx': 'export const App = () => <main>app shell</main>;',
};

const WEB_FILES: Record<string, string> = {
  'apps/web/tailwind.config.ts': "export default { theme: { colors: { ink: '#101014' } } };",
  'apps/web/src/styles/globals.css': ':root {\n  --ink: #101014;\n  --paper: #fbfbfd;\n}',
  'apps/web/src/domains/inbox/components/Card.tsx':
    "const card = cva('card', {\n  variants: {\n    tone: {},\n    density: {},\n  },\n});",
  'apps/web/src/app/page.tsx': 'export default function Page() { return <main>inbox</main>; }',
  'node_modules/lib/tailwind.config.ts': 'export default { theme: {} };',
  'node_modules/lib/theme.css': ':root {\n  --vendor-red: #ff0000;\n}',
  'dist/assets/index.css': ':root {\n  --built: #000000;\n}',
};

const repoFrom = ({ files }: { readonly files: Readonly<Record<string, string>> }) => {
  const list = vi.fn(
    async ({
      relPath,
    }: {
      readonly relPath: string;
    }): Promise<ReadonlyArray<DesignProfileEntry>> => {
      const prefix = relPath.length === 0 ? '' : `${relPath}/`;
      const names = new Map<string, boolean>();
      for (const path of Object.keys(files)) {
        if (!path.startsWith(prefix)) {
          continue;
        }
        const rest = path.slice(prefix.length);
        const head = rest.split('/')[0] ?? '';
        if (head.length === 0) {
          continue;
        }
        names.set(head, rest.includes('/'));
      }
      return [...names.entries()].map(([name, isDir]) => ({
        name,
        relPath: `${prefix}${name}`,
        isDir,
      }));
    },
  );
  const read = vi.fn(
    async ({ relPath }: { readonly relPath: string }): Promise<DesignProfileReadResult> => {
      const text = files[relPath];
      if (text === undefined) {
        throw new Error(`not found: ${relPath}`);
      }
      return { type: 'text', text, truncated: false };
    },
  );
  return { list, read };
};

describe('collectDesignProfile', () => {
  it('collects tailwind, tokens, variants and a layout example with file refs', async () => {
    const repo = repoFrom({ files: GOODBOY_FILES });
    const profile = await collectDesignProfile({
      rootPath: ROOT,
      commitSha: 'abc1234',
      projectName: 'goodboy',
      list: repo.list,
      read: repo.read,
    });
    expect(profile.themeName).toBe('goodboy');
    expect(profile.commitSha).toBe('abc1234');
    expect(profile.tailwind?.path).toBe('tailwind.config.ts');
    expect(profile.tokens.map((token) => token.name)).toEqual([
      'background',
      'foreground',
      'accent',
    ]);
    expect(profile.tokens[0]?.path).toBe('packages/ui/src/styles.css');
    expect(profile.variants).toEqual([
      {
        path: 'packages/ui/src/components/Button.tsx',
        component: 'Button',
        variants: ['variant', 'size'],
      },
    ]);
    expect(profile.layoutExamples[0]?.path).toBe('apps/desktop/src/App.tsx');
    expect(profile.notes).toEqual([]);
  });

  it('finds the design files of a repository that keeps them under apps/web', async () => {
    const repo = repoFrom({ files: WEB_FILES });
    const profile = await collectDesignProfile({
      rootPath: ROOT,
      commitSha: 'def5678',
      projectName: 'harborline',
      list: repo.list,
      read: repo.read,
    });
    expect(profile.themeName).toBe('harborline');
    expect(profile.tailwind?.path).toBe('apps/web/tailwind.config.ts');
    expect(profile.tokens.map((token) => token.name)).toEqual(['ink', 'paper']);
    expect(profile.tokens[0]?.path).toBe('apps/web/src/styles/globals.css');
    expect(profile.variants).toEqual([
      {
        path: 'apps/web/src/domains/inbox/components/Card.tsx',
        component: 'Card',
        variants: ['tone', 'density'],
      },
    ]);
    expect(profile.layoutExamples[0]?.path).toBe('apps/web/src/app/page.tsx');
    expect(profile.notes).toEqual([]);
  });

  it('never walks into node_modules, dist or a dot directory', async () => {
    const repo = repoFrom({
      files: { ...WEB_FILES, '.git/config.css': ':root {\n  --git: #111111;\n}' },
    });
    const profile = await collectDesignProfile({
      rootPath: ROOT,
      commitSha: 'def5678',
      projectName: 'harborline',
      list: repo.list,
      read: repo.read,
    });
    const listed = repo.list.mock.calls.map((call) => String(call[0]?.relPath));
    expect(listed.some((relPath) => relPath.startsWith('node_modules'))).toBe(false);
    expect(listed.some((relPath) => relPath.startsWith('dist'))).toBe(false);
    expect(listed.some((relPath) => relPath.startsWith('.git'))).toBe(false);
    expect(profile.tokens.map((token) => token.name)).toEqual(['ink', 'paper']);
  });

  it('stops at the depth cap and says so in its notes', async () => {
    const deep = 'a/b/c/d/e/f/g/styles.css';
    const repo = repoFrom({ files: { [deep]: ':root {\n  --deep: #123456;\n}' } });
    const profile = await collectDesignProfile({
      rootPath: ROOT,
      commitSha: 'def5678',
      projectName: 'harborline',
      list: repo.list,
      read: repo.read,
    });
    expect(profile.tokens).toEqual([]);
    expect(profile.notes).toContain(
      `the walk stopped at ${DESIGN_PROFILE_LIMITS.maxDirectoryDepth} folders deep, so deeper folders were not read`,
    );
  });

  it('never reads more files than the scan cap allows', async () => {
    const files: Record<string, string> = {};
    for (let index = 0; index < 200; index += 1) {
      files[`src/components/Comp${index}.tsx`] = 'export const Comp = () => null;';
      files[`src/styles/theme${index}.css`] = `:root {\n  --c${index}: #0000ff;\n}`;
    }
    const repo = repoFrom({ files });
    await collectDesignProfile({
      rootPath: ROOT,
      commitSha: 'def5678',
      projectName: 'harborline',
      list: repo.list,
      read: repo.read,
    });
    expect(repo.read.mock.calls.length).toBeLessThanOrEqual(DESIGN_PROFILE_LIMITS.maxScannedFiles);
  });

  it('labels the theme generic and names what the walk missed in an empty repository', async () => {
    const repo = repoFrom({ files: { 'README.md': 'nothing to style here' } });
    const profile = await collectDesignProfile({
      rootPath: ROOT,
      commitSha: null,
      projectName: 'goodboy',
      list: repo.list,
      read: repo.read,
    });
    expect(profile.themeName).toBe('generic');
    expect(profile.tokens).toEqual([]);
    expect(profile.variants).toEqual([]);
    expect(profile.notes).toContain('the walk found no tailwind config in this repository');
    expect(profile.notes).toContain('the walk found no css custom properties in this repository');
    expect(profile.notes).toContain(
      'the mount head commit was not resolved, so the refs are not pinned',
    );
  });

  it('returns a generic profile without reading when no mount is attached', async () => {
    const readSpy = vi.fn();
    const profile = await collectDesignProfile({
      rootPath: '',
      commitSha: null,
      projectName: null,
      list: vi.fn(),
      read: readSpy as never,
    });
    expect(readSpy).not.toHaveBeenCalled();
    expect(profile.themeName).toBe('generic');
    expect(profile.notes).toEqual(['no mount is attached, so no design evidence was read']);
  });

  it('never returns a binary asset as evidence', async () => {
    const repo = repoFrom({ files: GOODBOY_FILES });
    const binary = vi.fn(async () => ({ type: 'dataUrl', url: 'data:image/png;base64,AAAA' }));
    const profile = await collectDesignProfile({
      rootPath: ROOT,
      commitSha: 'abc1234',
      projectName: 'goodboy',
      list: repo.list,
      read: binary as never,
    });
    expect(profile.tailwind).toBeNull();
    expect(profile.tokens).toEqual([]);
    expect(profile.layoutExamples).toEqual([]);
  });
});

describe('describeDesignProfile', () => {
  it('renders a compact prompt block with refs and missing evidence', async () => {
    const repo = repoFrom({ files: GOODBOY_FILES });
    const profile = await collectDesignProfile({
      rootPath: ROOT,
      commitSha: 'abc1234',
      projectName: 'goodboy',
      list: repo.list,
      read: repo.read,
    });
    const described = describeDesignProfile({ profile });
    expect(described).toContain('theme name: goodboy');
    expect(described).toContain('commit: abc1234');
    expect(described).toContain('--accent: #3355ff');
    expect(described).toContain('Button: variant, size');
    expect(described).toContain('packages/ui/src/components/Button.tsx');
  });
});
