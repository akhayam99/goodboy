// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { renderHook } from '@testing-library/react';
import type { MenuEntry } from '@goodboy/ui';
import { Pencil } from '@goodboy/ui/icons';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { bindTarget } from '../../features/actions/registry';
import { resolveActions } from '../../features/actions/resolveActions';
import { toMenuEntries } from '../../features/actions/toMenuEntries';
import { visibleActionsOf } from '../../features/actions/components/ObjectOverflowMenu/visibleActionsOf';
import { ARTIFACT_KIND } from '../../features/actions/kinds/artifact';
import { COMMIT_KIND } from '../../features/actions/kinds/commit';
import { MOUNT_KIND } from '../../features/actions/kinds/mount';
import { PORT_KIND } from '../../features/actions/kinds/port';
import { WORKTREE_KIND } from '../../features/actions/kinds/worktree';
import type {
  ActionEnv,
  ActionListOf,
  ActionViewing,
  ObjectTarget,
  ResolvedAction,
} from '../../features/actions/types';
import { MAX_OVERFLOW_ROWS } from '../../features/actions/overflowCutOf';
import { portRowMenuOf } from '../../features/actions/portRowMenuOf';
import { sessionMenuOf } from '../../app/components/SessionActions/sessionMenuOf';
import { agentHeaderOmitOf } from '../../features/session/components/AgentDetailPane/agentHeaderOmitOf';
import { AGENT_HEADER_MENU_IDS } from '../../features/session/components/agentHeaderMenuIds';
import { runPageOmitOf } from '../../features/session/components/PresetRun/runPageOmitOf';
import { runHeaderPrimaryOf } from '../../features/session/components/PresetRun/runHeaderPrimaryOf';
import { useRunView } from '../../features/session/components/AgentTree/useRunView';
import { artifactHeaderOmitOf } from '../../features/artifacts/components/ArtifactShell/artifactHeaderOmitOf';
import { mountRowMenuOf } from '../../features/session/mountRowMenuOf';
import { HISTORY_ROW_MENU_IDS } from '../../features/history/components/CommitsHistory/historyRowMenuIds';
import { WORKTREE_ROW_MENU_IDS } from '../../features/storage/components/StoragePage/worktreeRowMenuIds';
import { AGENT, RUN, SESSION, seedActionState, type ActionSeed } from '../helpers/actionFixtures';
import { AGENT_STATES } from '../helpers/agentMenuStates';
import { ARTIFACT_STATES } from '../helpers/artifactMenuStates';
import {
  COMMIT_ROW_STATES,
  MOUNT_ROW_STATES,
  PORT_ROW_STATES,
  WORKTREE_ROW_STATES,
} from '../helpers/rowMenuStates';
import { RUN_STATES } from '../helpers/runMenuStates';
import { SESSION_STATES } from '../helpers/sessionMenuStates';

const BASELINE_PATH = join(__dirname, 'menu-shape.baseline.json');
const isUpdatingBaseline = process.env.GOODBOY_UPDATE_BASELINE === '1';

type Ledger = Readonly<Record<string, Readonly<Record<string, number>>>>;

type Shape = {
  readonly rows: number;
  readonly overBudget: number;
  readonly repairRows: number;
  readonly hasMixedIcons: boolean;
  readonly isOutOfOrder: boolean;
};

type ShapeParams = {
  readonly entries: ReadonlyArray<MenuEntry>;
};

type LabelParams = {
  readonly label: string;
};

type DrawnParams = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly omit?: ReadonlyArray<string>;
  readonly only?: ReadonlyArray<string> | null;
  readonly onlyOf?: ActionListOf;
};

type TargetParams = {
  readonly target: ObjectTarget;
  readonly viewing?: ActionViewing | null;
  readonly omit?: ReadonlyArray<string>;
  readonly only?: ReadonlyArray<string> | null;
};

type RecordParams = {
  readonly surface: string;
  readonly state: string;
  readonly entries: ReadonlyArray<MenuEntry>;
};

const REPAIR_VERB = /^(?:Refresh|Resync|Reload)\b/;
const OPEN_VERB = /^(?:Open|Go to|Show)\b/;
const COPY_VERB = /^Copy\b/;
const END_VERB = /^(?:Stop(?! keeping)|Archive|Delete|Remove|Discard|Close|Drop)\b/;

const rankOf = ({ label }: LabelParams): number => {
  if (OPEN_VERB.test(label)) {
    return 0;
  }
  if (END_VERB.test(label)) {
    return 3;
  }
  if (COPY_VERB.test(label)) {
    return 2;
  }
  return 1;
};

const shapeOf = ({ entries }: ShapeParams): Shape => {
  const items = entries.flatMap((entry) => (entry.kind === 'item' ? [entry] : []));
  const iconRows = items.filter((item) => item.icon !== undefined).length;
  const ranks = items.map((item) => rankOf({ label: item.label }));
  return {
    rows: items.length,
    overBudget: Math.max(0, items.length - MAX_OVERFLOW_ROWS),
    repairRows: items.filter((item) => REPAIR_VERB.test(item.label)).length,
    hasMixedIcons: iconRows > 0 && iconRows < items.length,
    isOutOfOrder: ranks.some((rank, index) => index > 0 && rank < (ranks[index - 1] ?? 0)),
  };
};

const offRuleCountOf = ({ entries }: ShapeParams): number => {
  const shape = shapeOf({ entries });
  return (
    shape.overBudget +
    shape.repairRows +
    (shape.hasMixedIcons ? 1 : 0) +
    (shape.isOutOfOrder ? 1 : 0)
  );
};

let useAppStore: StoryStore;
const measured: Record<string, Record<string, number>> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const env: ActionEnv = {
  getState: () => useAppStore.getState(),
  showToast: () => undefined,
  copyText: async () => undefined,
  origin: 'overflow',
  anchorKey: null,
  viewing: null,
};

const seed = (value: ActionSeed): void => seedActionState({ useAppStore, seed: value });

const entriesDrawn = ({
  actions,
  omit = [],
  only = null,
  onlyOf,
}: DrawnParams): ReadonlyArray<MenuEntry> =>
  toMenuEntries({
    actions: visibleActionsOf({ actions, omit, only, relabel: null, onlyOf }),
    env,
    run: async () => undefined,
  });

const entriesOfTarget = ({
  target,
  viewing = null,
  omit,
  only,
}: TargetParams): ReadonlyArray<MenuEntry> =>
  entriesDrawn({
    actions: bindTarget({ state: useAppStore.getState(), target })?.resolve({ viewing }) ?? [],
    omit,
    only,
  });

const record = ({ surface, state, entries }: RecordParams): void => {
  const count = offRuleCountOf({ entries });
  if (count === 0) {
    return;
  }
  measured[surface] = { ...measured[surface], [state]: count };
};

const isCounts = (value: unknown): value is Readonly<Record<string, number>> =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((count) => typeof count === 'number');

const isLedger = (value: unknown): value is Ledger =>
  typeof value === 'object' && value !== null && Object.values(value).every(isCounts);

const readLedger = (): Ledger => {
  if (!existsSync(BASELINE_PATH)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return isLedger(parsed) ? parsed : {};
};

const SESSION_TARGET: ObjectTarget = { kind: 'session', sessionId: SESSION };
const AGENT_TARGET: ObjectTarget = { kind: 'agent', sessionId: SESSION, agentId: AGENT };
const AGENT_VIEWING: ActionViewing = { kind: 'agent', id: AGENT };
const RUN_TARGET: ObjectTarget = {
  kind: 'workflowRun',
  sessionId: SESSION,
  runId: RUN,
  stepAgentId: null,
};
const RUN_VIEWING: ActionViewing = { kind: 'workflowRun', id: RUN };
const ENDED_RUN_STATES: ReadonlySet<string> = new Set(['done', 'discarded']);

const isSeededRunLive = (): boolean => {
  const state = useAppStore.getState();
  const session = state.sessions.find((candidate) => candidate.id === SESSION);
  const run = session?.workflowRuns.find((candidate) => candidate.id === RUN);
  const workflow = state.sessionWorkflows[SESSION]?.find(
    (candidate) => candidate.id === run?.workflowId,
  );
  if (session == null || run == null || workflow == null) {
    throw new Error('The run page needs a seeded session, run and workflow.');
  }
  const { result, unmount } = renderHook(() => useRunView({ session, run, workflow }));
  const header = runHeaderPrimaryOf({ view: result.current });
  unmount();
  return header.kind === 'live';
};

describe('the shape of a menu', () => {
  it('counts every way a menu breaks the rule', () => {
    const item = (label: string): MenuEntry => ({
      kind: 'item',
      key: label,
      label,
      icon: Pencil,
      onSelect: () => undefined,
    });
    expect(
      shapeOf({
        entries: [item('Rename'), { kind: 'item', key: 'bare', label: 'Pin', onSelect: () => {} }],
      }).hasMixedIcons,
    ).toBe(true);
    expect(
      shapeOf({
        entries: [item('Open transcript'), item('Rename'), item('Copy name'), item('Archive')],
      }),
    ).toMatchObject({ rows: 4, overBudget: 0, repairRows: 0, isOutOfOrder: false });
    expect(
      shapeOf({ entries: [item('Archive'), item('Open transcript'), item('Refresh session')] }),
    ).toMatchObject({ repairRows: 1, isOutOfOrder: true });
    expect(
      shapeOf({ entries: Array.from({ length: 7 }, (_, index) => item(`Rename ${index}`)) })
        .overBudget,
    ).toBe(2);
  });

  describe('session menu', () => {
    it.each(SESSION_STATES.filter(([, value]) => value !== null))('%s', (state, value) => {
      if (value === null) {
        return;
      }
      seed(value);
      [false, true].forEach((isArchived) => {
        record({
          surface: 'session',
          state: isArchived ? `${state}, archived menu` : state,
          entries: entriesOfTarget({ target: SESSION_TARGET, only: sessionMenuOf({ isArchived }) }),
        });
      });
    });
  });

  describe('agent page header', () => {
    it.each(AGENT_STATES)('%s', (state, value) => {
      seed(value);
      [false, true].forEach((isAutoRoot) => {
        record({
          surface: 'agent',
          state: isAutoRoot ? `${state}, auto root` : state,
          entries: entriesOfTarget({
            target: AGENT_TARGET,
            viewing: AGENT_VIEWING,
            omit: agentHeaderOmitOf({ isAutoRoot }),
            only: AGENT_HEADER_MENU_IDS,
          }),
        });
      });
    });
  });

  describe('run page header', () => {
    it.each(RUN_STATES)('%s', (state, value) => {
      seed(value);
      record({
        surface: 'workflowRun',
        state,
        entries: entriesOfTarget({
          target: RUN_TARGET,
          viewing: RUN_VIEWING,
          omit: runPageOmitOf({
            isEnded: ENDED_RUN_STATES.has(state),
            isLive: isSeededRunLive(),
          }),
        }),
      });
    });
  });

  describe('artifact page header', () => {
    it.each(ARTIFACT_STATES.map((state) => [state.name, state.facts] as const))(
      '%s',
      (state, facts) => {
        const viewing: ActionViewing = { kind: 'artifact', id: 'artifact-payout' };
        const actions = resolveActions({ definitions: ARTIFACT_KIND.actions, facts, viewing });
        record({
          surface: 'artifact',
          state,
          entries: entriesDrawn({ actions, omit: artifactHeaderOmitOf({ actions }) }),
        });
      },
    );
  });

  describe('rows', () => {
    it.each(MOUNT_ROW_STATES)('branch row: %s', (state, facts) => {
      const actions = resolveActions({ definitions: MOUNT_KIND.actions, facts });
      record({
        surface: 'mount',
        state,
        entries: entriesDrawn({ actions, onlyOf: mountRowMenuOf }),
      });
    });

    it.each(COMMIT_ROW_STATES)('commit row: %s', (state, facts) => {
      const actions = resolveActions({ definitions: COMMIT_KIND.actions, facts });
      record({
        surface: 'commit',
        state,
        entries: entriesDrawn({ actions, only: HISTORY_ROW_MENU_IDS }),
      });
    });

    it.each(WORKTREE_ROW_STATES)('worktree row: %s', (state, facts) => {
      const actions = resolveActions({ definitions: WORKTREE_KIND.actions, facts });
      record({
        surface: 'worktree',
        state,
        entries: entriesDrawn({ actions, only: WORKTREE_ROW_MENU_IDS }),
      });
    });

    it.each(PORT_ROW_STATES)('port row: %s', (state, facts) => {
      const actions = resolveActions({ definitions: PORT_KIND.actions, facts });
      const { omit, onlyOf } = portRowMenuOf({ hasStop: true });
      record({ surface: 'port', state, entries: entriesDrawn({ actions, omit, onlyOf }) });
    });
  });

  it('breaks the rule no more often than the baseline, which only falls', () => {
    if (isUpdatingBaseline) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(measured, null, 2)}\n`);
      return;
    }
    const baseline = readLedger();
    const grown = Object.entries(measured).flatMap(([surface, states]) =>
      Object.entries(states).flatMap(([state, count]) => {
        const allowed = baseline[surface]?.[state] ?? 0;
        return count > allowed ? [`  - ${surface} > ${state}: ${count} (baseline ${allowed})`] : [];
      }),
    );
    expect(
      grown,
      [
        'A menu row is a verb no visible control on the screen already offers, never a repair',
        'verb a key already runs. Open first, then the verbs of the object, then Copy, then',
        'stop, archive and delete. At most five rows, dividers only from five rows up, an icon',
        'on every row or on none (packages/ui/design/controls.md, Menus).',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
