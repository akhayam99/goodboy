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

const headerOf = (): HTMLElement => {
  const header = document.querySelector<HTMLElement>('[data-slot="diff-file-header"]');
  if (header === null) {
    throw new Error('no file header');
  }
  return header;
};

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
  it('draws no overflow button: the header itself carries the menu', () => {
    renderHeader({ onOpenInEditor: vi.fn(), onShowWhole: vi.fn() });

    expect(screen.queryByRole('button', { name: 'More for ledger-core.ts' })).toBeNull();
  });

  it('opens Copy path and the file verbs from a right click on the header', () => {
    const onOpenInEditor = vi.fn();
    renderHeader({ onOpenInEditor, onShowWhole: null });

    fireEvent.contextMenu(headerOf());
    screen.getByRole('menuitem', { name: 'Copy path' });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open in editor' }));
    expect(onOpenInEditor).toHaveBeenCalledTimes(1);
  });
});
