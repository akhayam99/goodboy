import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand';
import type { WorkspaceId } from '@goodboy/types';
import { createNewSessionDraftsSlice } from './index';
import type {
  ClearNewSessionDraftParams,
  NewSessionDraft,
  SetFn,
  SetNewSessionDraftParams,
} from './types';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const OTHER_WORKSPACE_ID = 'workspace-2' as WorkspaceId;

type TestState = {
  newSessionDrafts: Record<WorkspaceId, NewSessionDraft | undefined>;
  setNewSessionDraft: (params: SetNewSessionDraftParams) => void;
  clearNewSessionDraft: (params: ClearNewSessionDraftParams) => void;
};

describe('newSessionDrafts slice', () => {
  it('stores, updates, isolates, and clears drafts by workspace', () => {
    const store = createStore<TestState>((set) => ({
      newSessionDrafts: {},
      ...createNewSessionDraftsSlice({ set: set as SetFn }),
    }));
    store.getState().setNewSessionDraft({
      workspaceId: WORKSPACE_ID,
      draft: {
        goal: 'Fix the checkout flow',
        branchSlug: 'fix-checkout-flow',
        slugTouched: true,
        branchMode: 'existing',
        existingBranch: 'checkout-work',
        issue: {
          provider: 'github',
          externalId: '42',
          identifier: '#42',
          title: 'Fix checkout flow',
          url: 'https://example.com/issues/42',
          goal: 'Fix the checkout flow',
          branchSlug: 'fix-checkout-flow',
        },
      },
    });
    store.getState().setNewSessionDraft({
      workspaceId: OTHER_WORKSPACE_ID,
      draft: { goal: 'Keep me' },
    });
    store.getState().setNewSessionDraft({
      workspaceId: WORKSPACE_ID,
      draft: { goal: 'Fix checkout and payment' },
    });

    expect(store.getState().newSessionDrafts[WORKSPACE_ID]).toMatchObject({
      goal: 'Fix checkout and payment',
      branchSlug: 'fix-checkout-flow',
      slugTouched: true,
      branchMode: 'existing',
      existingBranch: 'checkout-work',
      issue: { identifier: '#42' },
    });

    store.getState().clearNewSessionDraft({ workspaceId: WORKSPACE_ID });

    expect(store.getState().newSessionDrafts[WORKSPACE_ID]).toBeUndefined();
    expect(store.getState().newSessionDrafts[OTHER_WORKSPACE_ID]?.goal).toBe('Keep me');
  });
});
