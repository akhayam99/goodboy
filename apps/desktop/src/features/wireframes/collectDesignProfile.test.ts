import { describe, expect, it, vi } from 'vitest';
import {
  collectDesignProfile,
  type DesignProfileEntry,
  type DesignProfileReadResult,
} from './collectDesignProfile';
import { describeDesignProfile } from './describeDesignProfile';

const ROOT = '/tmp/mount';

const files: Record<string, string> = {
  'tailwind.config.ts': "export default { theme: { extend: { colors: { brand: '#3355ff' } } } };",
  'packages/ui/src/styles.css':
    ':root {\n  --background: #0b0b0f;\n  --foreground: #f5f5f7;\n  --accent: #3355ff;\n}',
  'packages/ui/src/components/Button.tsx':
    "const styles = cva('base', {\n  variants: {\n    variant: {},\n    size: {},\n  },\n});",
  'packages/ui/src/components/Divider.tsx': 'export const Divider = () => <hr />;',
  'apps/desktop/src/App.tsx': 'export const App = () => <main>app shell</main>;',
};

const directories: Record<string, ReadonlyArray<DesignProfileEntry>> = {
  'packages/ui/src/components': [
    { name: 'Button.tsx', relPath: 'packages/ui/src/components/Button.tsx', isDir: false },
    { name: 'Divider.tsx', relPath: 'packages/ui/src/components/Divider.tsx', isDir: false },
    { name: 'nested', relPath: 'packages/ui/src/components/nested', isDir: true },
  ],
};

const read = vi.fn(
  async ({ relPath }: { readonly relPath: string }): Promise<DesignProfileReadResult> => {
    const text = files[relPath];
    if (text === undefined) {
      throw new Error(`not found: ${relPath}`);
    }
    return { type: 'text', text, truncated: false };
  },
);

const list = vi.fn(
  async ({ relPath }: { readonly relPath: string }): Promise<ReadonlyArray<DesignProfileEntry>> =>
    directories[relPath] ?? [],
);

describe('collectDesignProfile', () => {
  it('collects tailwind, tokens, variants and a layout example with file refs', async () => {
    const profile = await collectDesignProfile({
      rootPath: ROOT,
      commitSha: 'abc1234',
      projectName: 'goodboy',
      list,
      read,
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

  it('labels the theme generic when no evidence is found', async () => {
    const empty = vi.fn(async () => {
      throw new Error('missing');
    });
    const profile = await collectDesignProfile({
      rootPath: ROOT,
      commitSha: null,
      projectName: 'goodboy',
      list: vi.fn(async () => []),
      read: empty as never,
    });
    expect(profile.themeName).toBe('generic');
    expect(profile.notes).toContain('no tailwind config was found at the known paths');
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
    const binary = vi.fn(async () => ({ type: 'dataUrl', url: 'data:image/png;base64,AAAA' }));
    const profile = await collectDesignProfile({
      rootPath: ROOT,
      commitSha: 'abc1234',
      projectName: 'goodboy',
      list: vi.fn(async () => []),
      read: binary as never,
    });
    expect(profile.tailwind).toBeNull();
    expect(profile.tokens).toEqual([]);
    expect(profile.layoutExamples).toEqual([]);
  });
});

describe('describeDesignProfile', () => {
  it('renders a compact prompt block with refs and missing evidence', async () => {
    const profile = await collectDesignProfile({
      rootPath: ROOT,
      commitSha: 'abc1234',
      projectName: 'goodboy',
      list,
      read,
    });
    const described = describeDesignProfile({ profile });
    expect(described).toContain('theme name: goodboy');
    expect(described).toContain('commit: abc1234');
    expect(described).toContain('--accent: #3355ff');
    expect(described).toContain('Button: variant, size');
    expect(described).toContain('packages/ui/src/components/Button.tsx');
  });
});
