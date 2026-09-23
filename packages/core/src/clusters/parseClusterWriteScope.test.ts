import { describe, expect, it } from 'vitest';
import { hasClusterExecutionContract, parseClusterWriteScope } from './parseClusterWriteScope';

const parse = (value: unknown) => parseClusterWriteScope({ value, label: '"impl"' });

describe('parseClusterWriteScope', () => {
  it('treats a cluster without a write scope as outside the contract', () => {
    expect(parse(undefined)).toEqual({ kind: 'absent' });
  });

  it('keeps exact files and bounded directories in a canonical order', () => {
    expect(
      parse({
        version: 1,
        files: ['src/b.ts', 'src/a.ts', 'src/a.ts'],
        directories: ['docs/guides/', 'apps/web'],
      }),
    ).toEqual({
      kind: 'valid',
      scope: {
        version: 1,
        files: ['src/a.ts', 'src/b.ts'],
        directories: ['apps/web', 'docs/guides'],
      },
    });
  });

  it('accepts an explicitly empty scope', () => {
    expect(parse({ version: 1, files: [], directories: [] })).toEqual({
      kind: 'valid',
      scope: { version: 1, files: [], directories: [] },
    });
    expect(parse({ version: 1 })).toEqual({
      kind: 'valid',
      scope: { version: 1, files: [], directories: [] },
    });
  });

  it('refuses a scope without a supported contract version', () => {
    expect(parse({ files: ['a.ts'] })).toMatchObject({ kind: 'invalid' });
    expect(parse({ version: 2, files: ['a.ts'] })).toMatchObject({ kind: 'invalid' });
    expect(parse({ version: '1', files: ['a.ts'] })).toMatchObject({ kind: 'invalid' });
    expect(parse(['a.ts'])).toMatchObject({ kind: 'invalid' });
    expect(parse(null)).toMatchObject({ kind: 'invalid' });
  });

  it.each([
    ['../outside.ts', 'path alias'],
    ['src/../../etc/passwd', 'path alias'],
    ['./src/a.ts', 'path alias'],
    ['/etc/passwd', 'not relative'],
    ['~/secrets', 'not relative'],
    ['C:/windows', 'not relative'],
    ['src\\a.ts', 'character'],
    ['src//a.ts', 'empty path segment'],
    ['src/*.ts', 'pattern'],
    ['.git/config', 'git metadata'],
    ['packages/.GIT/hooks', 'git metadata'],
    ['.goodboy/worktrees/other/a.ts', 'private checkouts'],
    ['src/dir/', 'directory, not a file'],
  ])('rejects the file path %s', (path, why) => {
    const result = parse({ version: 1, files: [path] });
    expect(result.kind).toBe('invalid');
    expect(result.kind === 'invalid' && result.reason).toContain(why);
    expect(result.kind === 'invalid' && result.reason).toContain('"impl"');
  });

  it.each([['.'], ['/'], ['..'], ['']])('rejects the unbounded directory %j', (path) => {
    expect(parse({ version: 1, directories: [path] }).kind).toBe('invalid');
  });

  it('rejects lists that are not arrays and entries that are not paths', () => {
    expect(parse({ version: 1, files: 'a.ts' }).kind).toBe('invalid');
    expect(parse({ version: 1, directories: { src: true } }).kind).toBe('invalid');
    expect(parse({ version: 1, files: [42] }).kind).toBe('invalid');
  });

  it('reports whether any node carries the execution contract', () => {
    expect(hasClusterExecutionContract({ nodes: [{}, {}] })).toBe(false);
    expect(
      hasClusterExecutionContract({
        nodes: [{}, { writeScope: { version: 1, files: [], directories: [] } }],
      }),
    ).toBe(true);
  });
});
