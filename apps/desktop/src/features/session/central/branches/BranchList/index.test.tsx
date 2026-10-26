// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { aSession, aWorkspace, TEST_NOW } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { BranchList } from '.';
import { branchFactsOf } from '../branchFactsOf';
import { branchEntriesOf } from '../branchStoryOf';
import { aMountRow, aRequest } from '../testing/aMountRow';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

const SESSION = aSession({ workspaceId: aWorkspace({ name: 'Harborline' }).id });
const SESSION_ID: SessionId = SESSION.id;

const entriesOf = () => {
  const rows = [
    aMountRow({
      key: 'fix-duplicate-credit',
      projectName: 'payments-api',
      branch: 'hl/fix-duplicate-credit',
      request: aRequest({ provider: 'github', number: 318, checks: 'success' }),
    }),
  ];
  const facts = branchFactsOf({
    rows,
    fetchedAtByMountId: new Map(),
    behindByMountId: new Map(),
    liveCountByMountId: new Map(),
    now: Date.parse(TEST_NOW),
  });
  return branchEntriesOf({ facts, detailByMountId: new Map() }).live;
};

type StubWidthParams = { readonly width: number };

const stubWidth = ({ width }: StubWidthParams) =>
  vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 0, width, 40));

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the Branches block at a narrow centre pane', () => {
  it('keeps the branch, its request and its state whole when the pane is narrow', () => {
    const observers = installFakeResizeObserver();
    stubWidth({ width: 360 });
    render(<BranchList sessionId={SESSION_ID} entries={entriesOf()} />);

    act(() => observers.resizeAll());

    const list = screen.getByRole('list', { name: 'Branches' });
    expect(list.querySelectorAll('[data-list-grid-cell="track"]')).toHaveLength(0);
    expect(list.querySelectorAll('[data-list-grid-cell="project"]')).toHaveLength(0);
    expect(list.querySelectorAll('[data-list-grid-cell="detail"]')).toHaveLength(0);
    expect(list.style.gridTemplateColumns).toBe('0px minmax(0,1fr) 16px 0px');
    const branchCell = list.querySelector('[data-list-grid-cell="branch"]');
    expect(branchCell?.textContent).toContain('hl/fix-duplicate-credit');
    expect(branchCell?.textContent).toContain('#318');
    expect(branchCell?.querySelector('[data-branch-state]')).not.toBeNull();
  });

  it('keeps every column when the pane is wide', () => {
    const observers = installFakeResizeObserver();
    stubWidth({ width: 900 });
    render(<BranchList sessionId={SESSION_ID} entries={entriesOf()} />);

    act(() => observers.resizeAll());

    const list = screen.getByRole('list', { name: 'Branches' });
    expect(list.querySelectorAll('[data-list-grid-cell="track"]')).toHaveLength(1);
    expect(list.querySelectorAll('[data-list-grid-cell="request"]')).toHaveLength(1);
  });
});
