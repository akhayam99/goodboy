// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { brandId } from '@goodboy/types';
import type { IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';

const seen: Array<Record<string, unknown>> = [];

vi.mock('./BoardRow', () => ({
  BoardRow: (props: Record<string, unknown>) => {
    seen.push(props);
    return null;
  },
}));

vi.mock('./BoardMergeInOrder', () => ({ BoardMergeInOrder: () => null }));
vi.mock('./BoardRemoveButton', () => ({ BoardRemoveButton: () => null }));

import { BoardContext, type BoardContextValue } from './BoardContext';
import { BoardGroup } from './BoardGroup';

const DATE = brandId<IsoDateTime>({ value: '2026-08-04T00:00:00.000Z' });

const session: Session = {
  id: brandId<SessionId>({ value: 'session-1' }),
  workspaceId: brandId<WorkspaceId>({ value: 'workspace-1' }),
  goal: 'Ship the ledger export',
  state: { kind: 'idle', lastActivityAt: DATE },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: DATE,
  updatedAt: DATE,
};

const context: BoardContextValue = {
  session,
  now: 0,
  isNarrow: false,
  rowById: new Map(),
  entryByRowId: new Map(),
  runningByRowId: new Map(),
  mergedAtByMountId: new Map(),
  newRowIds: new Set(),
  diffStatByPath: new Map(),
  cardsByRowId: new Map(),
  mergeCard: null,
  actionsFor: () => ({
    main: null,
    second: null,
    failure: null,
    isBusy: false,
    agentKind: null,
    menu: null,
    foldedTarget: null,
  }),
  openFor: () => null,
  removal: {
    targets: [],
    failures: [],
    isBusy: false,
    sizeLabel: null,
    run: async () => undefined,
  },
  openIds: new Set(['a']),
  onToggleRow: () => undefined,
};

describe('the props of a board row', () => {
  it('are primitives, so a row re-renders only when its own facts change', () => {
    render(
      <BoardContext.Provider value={context}>
        <BoardGroup
          group={{
            id: 'needs-you',
            label: 'Needs you',
            rowIds: ['a', 'b'],
            hiddenCount: 0,
            isFoldable: false,
          }}
          isFirstOpenGroup
          onShowMore={() => undefined}
        />
      </BoardContext.Provider>,
    );

    expect(seen.length).toBeGreaterThan(0);
    for (const props of seen) {
      for (const value of Object.values(props)) {
        expect(['string', 'boolean', 'number']).toContain(typeof value);
      }
    }
  });
});
