// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FileDiff } from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { FileHeader } from './FileHeader';

const FILE: FileDiff = {
  path: 'src/ledger-core.ts',
  status: 'modified',
  additions: 3,
  deletions: 1,
  binary: false,
  hunks: [],
};

type HeaderParams = {
  readonly onOpenInEditor: (() => void) | null;
  readonly onShowWhole: (() => void) | null;
};

const renderHeader = ({ onOpenInEditor, onShowWhole }: HeaderParams) =>
  render(
    <ObjectMenuProvider>
      <FileHeader
        file={FILE}
        isCollapsed={false}
        onToggleCollapsed={() => undefined}
        commentCount={0}
        viewed={null}
        onToggleViewed={null}
        onOpenInEditor={onOpenInEditor}
        onShowWhole={onShowWhole}
        onCommentOnFile={null}
      />
    </ObjectMenuProvider>,
  );

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
});

describe('the file header actions', () => {
  it('draws a lone file action as a quiet button instead of a menu of one', () => {
    renderHeader({ onOpenInEditor: null, onShowWhole: null });

    expect(screen.queryByRole('button', { name: 'More for ledger-core.ts' })).toBeNull();
    screen.getByRole('button', { name: 'Copy path' });
  });

  it('keeps the menu once two actions exist', () => {
    const onOpenInEditor = vi.fn();
    renderHeader({ onOpenInEditor, onShowWhole: null });

    expect(screen.queryByRole('button', { name: 'Copy path' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More for ledger-core.ts' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open in editor' }));
    expect(onOpenInEditor).toHaveBeenCalledTimes(1);
  });
});
