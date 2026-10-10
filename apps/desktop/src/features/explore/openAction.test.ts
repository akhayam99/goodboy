import { describe, expect, it } from 'vitest';
import type { DetectedEditor } from '../../shared/lib/editor';
import { fileKindOf } from './fileKindOf';
import { openActionOf } from './openAction';
import { resolveExploreEditor } from './resolveExploreEditor';

const CODE: DetectedEditor = { binary: 'code', label: 'VS Code' };
const CURSOR: DetectedEditor = { binary: 'cursor', label: 'Cursor' };

describe('openActionOf', () => {
  it.each([
    {
      situation: 'repository, code file, editor found',
      projectKind: 'repo' as const,
      hasGit: true,
      name: 'page.tsx',
      editor: CODE,
      label: 'Open in editor',
      tooltip: 'Open in VS Code',
      opensWith: CODE,
    },
    {
      situation: 'repository, image',
      projectKind: 'repo' as const,
      hasGit: true,
      name: 'logo.png',
      editor: CODE,
      label: 'Open',
      tooltip: 'Open with the default app',
      opensWith: null,
    },
    {
      situation: 'repository, PDF',
      projectKind: 'repo' as const,
      hasGit: true,
      name: 'spec.pdf',
      editor: CODE,
      label: 'Open',
      tooltip: 'Open with the default app',
      opensWith: null,
    },
    {
      situation: 'repository, binary',
      projectKind: 'repo' as const,
      hasGit: true,
      name: 'budget.xlsx',
      editor: CODE,
      label: 'Open',
      tooltip: 'Open with the default app',
      opensWith: null,
    },
    {
      situation: 'repository, no editor found',
      projectKind: 'repo' as const,
      hasGit: true,
      name: 'page.tsx',
      editor: null,
      label: 'Open',
      tooltip: 'Open with the default app',
      opensWith: null,
    },
    {
      situation: 'folder project, code file',
      projectKind: 'folder' as const,
      hasGit: false,
      name: 'page.tsx',
      editor: CODE,
      label: 'Open',
      tooltip: 'Open with the default app',
      opensWith: null,
    },
    {
      situation: 'repository without a branch, code file',
      projectKind: 'repo' as const,
      hasGit: false,
      name: 'page.tsx',
      editor: CODE,
      label: 'Open',
      tooltip: 'Open with the default app',
      opensWith: null,
    },
  ])('$situation', ({ projectKind, hasGit, name, editor, label, tooltip, opensWith }) => {
    expect(openActionOf({ projectKind, hasGit, fileKind: fileKindOf({ name }), editor })).toEqual({
      label,
      tooltip,
      editor: opensWith,
    });
  });

  it('opens in Cursor when the configured editor is not installed but Cursor is', () => {
    const editor = resolveExploreEditor({ configured: 'code', detected: [CURSOR] });

    expect(openActionOf({ projectKind: 'repo', hasGit: true, fileKind: 'text', editor })).toEqual({
      label: 'Open in editor',
      tooltip: 'Open in Cursor',
      editor: CURSOR,
    });
  });

  it('keeps the configured editor when it is installed among others', () => {
    const editor = resolveExploreEditor({ configured: 'cursor', detected: [CODE, CURSOR] });

    expect(editor).toEqual(CURSOR);
  });

  it('finds no editor when none is installed', () => {
    expect(resolveExploreEditor({ configured: 'code', detected: [] })).toBeNull();
  });
});

describe('fileKindOf', () => {
  it.each([
    ['page.tsx', 'text'],
    ['Makefile', 'text'],
    ['notes', 'text'],
    ['LOGO.PNG', 'image'],
    ['spec.pdf', 'pdf'],
    ['budget.xlsx', 'binary'],
    ['archive.tar.gz', 'binary'],
    ['.env', 'text'],
  ])('%s is %s', (name, kind) => {
    expect(fileKindOf({ name })).toBe(kind);
  });
});
