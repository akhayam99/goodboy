// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { FileDiff } from '@goodboy/types';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import { buildChangeTree } from '../../lib/changeTree';
import type { ViewedState } from '../../lib/reviewedFiles';
import { useDiffKeys } from '.';

const fileAt = (path: string): FileDiff => ({
  path,
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [],
});

const PATHS = ['api/a.ts', 'api/b.ts', 'web/c.ts', 'web/d.ts', 'root.ts'];

type Setup = {
  readonly activePath: string | null;
  readonly collapsed?: ReadonlyArray<string>;
  readonly viewedPaths?: ReadonlyArray<string>;
};

const mount = ({ activePath, collapsed = [], viewedPaths = [] }: Setup) => {
  const jumpTo = vi.fn();
  const stepTo = vi.fn();
  const toggleFolder = vi.fn();
  const onToggle = vi.fn();
  const onToggleTree = vi.fn();
  const onFocusTree = vi.fn();
  const onFocusFilter = vi.fn();
  const tree = buildChangeTree({ files: PATHS.map(fileAt) });
  const review = {
    tree,
    activePath,
    collapsed: new Set(collapsed),
    toggleFolder,
    jumpTo,
    stepTo,
    viewed: {
      stateOf: (file: FileDiff): ViewedState =>
        viewedPaths.includes(file.path) ? 'viewed' : 'none',
      onToggle,
    },
  } satisfies Parameters<typeof useDiffKeys>[0]['review'];
  renderHook(() =>
    useDiffKeys({ enabled: true, review, onToggleTree, onFocusTree, onFocusFilter }),
  );
  return { jumpTo, stepTo, toggleFolder, onToggle, onToggleTree, onFocusTree, onFocusFilter };
};

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('useDiffKeys', () => {
  it('moves to the next and previous file in tree order', () => {
    const { stepTo, jumpTo } = mount({ activePath: 'api/b.ts' });
    pressShortcut({ id: 'diff.fileDown' });
    pressShortcut({ id: 'diff.fileUp' });
    expect(stepTo.mock.calls.map(([path]) => path)).toEqual(['web/c.ts', 'api/a.ts']);
    expect(jumpTo).not.toHaveBeenCalled();
  });

  it('keeps the bracket keys as aliases of j and k', () => {
    const { stepTo } = mount({ activePath: 'api/b.ts' });
    pressShortcut({ id: 'diff.nextFile' });
    pressShortcut({ id: 'diff.previousFile' });
    expect(stepTo.mock.calls.map(([path]) => path)).toEqual(['web/c.ts', 'api/a.ts']);
  });

  it('visits the files of a closed folder, going down and going up', () => {
    const down = mount({ activePath: 'api/b.ts', collapsed: ['dir:web'] });
    pressShortcut({ id: 'diff.fileDown' });
    expect(down.stepTo).toHaveBeenCalledWith('web/c.ts');
    cleanup();

    const up = mount({ activePath: 'root.ts', collapsed: ['dir:web'] });
    pressShortcut({ id: 'diff.fileUp' });
    expect(up.stepTo).toHaveBeenCalledWith('web/d.ts');
  });

  it('starts at the first file when none is in view', () => {
    const { stepTo } = mount({ activePath: null });
    pressShortcut({ id: 'diff.fileDown' });
    expect(stepTo).toHaveBeenCalledWith('api/a.ts');
  });

  it('stays put at the last file', () => {
    const { stepTo } = mount({ activePath: 'root.ts' });
    pressShortcut({ id: 'diff.fileDown' });
    expect(stepTo).not.toHaveBeenCalled();
  });

  it('marks the file viewed and goes to the next unviewed one', () => {
    const { jumpTo, onToggle } = mount({ activePath: 'api/a.ts', viewedPaths: ['api/b.ts'] });
    pressShortcut({ id: 'diff.markViewed' });
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ path: 'api/a.ts' }), true);
    expect(jumpTo).toHaveBeenCalledWith('web/c.ts');
  });

  it('wraps to the first unviewed file after the last', () => {
    const { jumpTo } = mount({ activePath: 'root.ts', viewedPaths: ['api/a.ts'] });
    pressShortcut({ id: 'diff.nextUnviewed' });
    expect(jumpTo).toHaveBeenCalledWith('api/b.ts');
  });

  it('does nothing when every other file is viewed', () => {
    const { jumpTo } = mount({
      activePath: 'root.ts',
      viewedPaths: ['api/a.ts', 'api/b.ts', 'web/c.ts', 'web/d.ts'],
    });
    pressShortcut({ id: 'diff.nextUnviewed' });
    expect(jumpTo).not.toHaveBeenCalled();
  });

  it('closes the folder of the file in view', () => {
    const { toggleFolder } = mount({ activePath: 'web/c.ts' });
    pressShortcut({ id: 'diff.closeFolder' });
    expect(toggleFolder).toHaveBeenCalledWith('dir:web');
  });

  it('opens the folder of the file in view', () => {
    const { toggleFolder } = mount({ activePath: 'web/c.ts', collapsed: ['dir:web'] });
    pressShortcut({ id: 'diff.openFolder' });
    expect(toggleFolder).toHaveBeenCalledWith('dir:web');
  });

  it('leaves a root file without a folder to close', () => {
    const { toggleFolder } = mount({ activePath: 'root.ts' });
    pressShortcut({ id: 'diff.closeFolder' });
    expect(toggleFolder).not.toHaveBeenCalled();
  });

  it('asks for the tree focus, the filter focus and the tree toggle', () => {
    const { onFocusTree, onFocusFilter, onToggleTree } = mount({ activePath: null });
    pressShortcut({ id: 'diff.focusTree' });
    pressShortcut({ id: 'diff.focusFilter' });
    pressShortcut({ id: 'diff.focusFilterAlias' });
    pressShortcut({ id: 'diff.toggleTree' });
    expect(onFocusTree).toHaveBeenCalledTimes(1);
    expect(onFocusFilter).toHaveBeenCalledTimes(2);
    expect(onToggleTree).toHaveBeenCalledTimes(1);
  });

  it('ignores the keys while typing in a field', () => {
    const { jumpTo, stepTo, onToggle, onFocusTree } = mount({ activePath: 'api/a.ts' });
    const field = document.createElement('input');
    document.body.appendChild(field);
    field.focus();
    for (const id of ['diff.fileDown', 'diff.markViewed', 'diff.focusTree'] as const) {
      pressShortcut({ id, target: field });
    }
    expect(jumpTo).not.toHaveBeenCalled();
    expect(stepTo).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
    expect(onFocusTree).not.toHaveBeenCalled();
  });
});
