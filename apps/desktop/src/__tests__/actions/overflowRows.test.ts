// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { Link } from 'lucide-react';
import { brandId, type AgentId } from '@goodboy/types';
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
import type {
  ActionEnv,
  ActionViewing,
  ObjectTarget,
  ResolvedAction,
} from '../../features/actions/types';
import { sessionMenuOf } from '../../app/components/SessionRail/SessionLevel/sessionMenuOf';
import { agentHeaderOmitOf } from '../../features/session/components/AgentDetailPane/agentHeaderOmitOf';
import { AGENT_HEADER_MENU_IDS } from '../../features/session/components/agentHeaderMenuIds';
import { runPageOmitOf } from '../../features/session/components/PresetRun/runPageOmitOf';
import { artifactHeaderOmitOf } from '../../features/artifacts/components/ArtifactShell/artifactHeaderOmitOf';
import type { RecordVerb } from '../../shared/components/StudioDetail/RecordActions/types';
import { RECORD_HEADER_CUTS } from '../../shared/components/StudioDetail/RecordHeader/recordHeaderCuts';
import { COMMIT_KIND } from '../../features/actions/kinds/commit';
import { MOUNT_KIND } from '../../features/actions/kinds/mount';
import { PORT_KIND } from '../../features/actions/kinds/port';
import { WORKTREE_KIND } from '../../features/actions/kinds/worktree';
import { portRowMenuOf } from '../../features/actions/portRowMenuOf';
import { MOUNT_ROW_CUTS } from '../../app/components/SessionRail/SessionLevel/mountRowCuts';
import { HISTORY_ROW_CUTS } from '../../features/history/components/CommitsHistory/historyRowCuts';
import { WORKTREE_ROW_CUTS } from '../../features/storage/components/StoragePage/worktreeRowCuts';
import { MAX_OVERFLOW_ROWS } from '../../features/actions/overflowCutOf';
import { branchMenuRowsOf } from '../../features/branch/branchPrimary';
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

let useAppStore: StoryStore;

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

type RowsParams = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly omit?: ReadonlyArray<string>;
  readonly only?: ReadonlyArray<string> | null;
  readonly cuts?: ReadonlyArray<string>;
};

const rowsDrawn = ({
  actions,
  omit = [],
  only = null,
  cuts = [],
}: RowsParams): ReadonlyArray<string> =>
  toMenuEntries({
    actions: visibleActionsOf({ actions, omit, only, relabel: null, cuts }),
    env,
    run: async () => undefined,
  }).flatMap((entry) => (entry.kind === 'item' ? [entry.label] : []));

type BoundRowsParams = {
  readonly target: ObjectTarget;
  readonly viewing?: ActionViewing | null;
  readonly omit?: ReadonlyArray<string>;
  readonly only?: ReadonlyArray<string> | null;
};

const rowsOfTarget = ({
  target,
  viewing = null,
  omit,
  only,
}: BoundRowsParams): ReadonlyArray<string> =>
  rowsDrawn({
    actions: bindTarget({ state: useAppStore.getState(), target })?.resolve({ viewing }) ?? [],
    omit,
    only,
  });

const expectWithinFive = (rows: ReadonlyArray<string>): void => {
  expect(rows.length, rows.join(' | ')).toBeLessThanOrEqual(MAX_OVERFLOW_ROWS);
};

const seed = (value: ActionSeed): void => seedActionState({ useAppStore, seed: value });

const SESSION_TARGET: ObjectTarget = { kind: 'session', sessionId: SESSION };
const AGENT_TARGET: ObjectTarget = { kind: 'agent', sessionId: SESSION, agentId: AGENT };
const AGENT_VIEWING: ActionViewing = { kind: 'agent', id: AGENT };
const RUN_VIEWING: ActionViewing = { kind: 'workflowRun', id: RUN };

describe('a header or row ⋯ holds at most five rows in any one state', () => {
  describe('session row in the rail', () => {
    const { only } = sessionMenuOf({ limitUsd: null });
    it.each(SESSION_STATES.filter(([, value]) => value !== null))('%s', (_state, value) => {
      if (value === null) {
        return;
      }
      seed(value);
      expectWithinFive(rowsOfTarget({ target: SESSION_TARGET, only }));
    });
  });

  describe('agent page header', () => {
    it.each(AGENT_STATES)('%s', (_state, value) => {
      seed(value);
      [false, true].forEach((isAutoRoot) => {
        expectWithinFive(
          rowsOfTarget({
            target: AGENT_TARGET,
            viewing: AGENT_VIEWING,
            omit: agentHeaderOmitOf({ isAutoRoot }),
            only: AGENT_HEADER_MENU_IDS,
          }),
        );
      });
    });
  });

  describe('run page header', () => {
    const ENDED_STATES: ReadonlySet<string> = new Set(['done', 'discarded']);
    const LIVE_VERBS: ReadonlySet<string> = new Set(['workflowRun.pause', 'workflowRun.resume']);
    const stepTargets = [
      { kind: 'workflowRun', sessionId: SESSION, runId: RUN, stepAgentId: null },
      {
        kind: 'workflowRun',
        sessionId: SESSION,
        runId: RUN,
        stepAgentId: brandId<AgentId>({ value: 'agent-plan' }),
      },
    ] as const satisfies ReadonlyArray<ObjectTarget>;
    it.each(RUN_STATES)('%s', (state, value) => {
      seed(value);
      const isEnded = ENDED_STATES.has(state);
      stepTargets.forEach((target) => {
        const offered = bindTarget({ state: useAppStore.getState(), target })?.resolve() ?? [];
        const hasLiveVerb = offered.some((action) => LIVE_VERBS.has(action.id));
        [true, false]
          .filter((isLive) => isLive || !hasLiveVerb)
          .forEach((isLive) => {
            expectWithinFive(
              rowsOfTarget({
                target,
                viewing: RUN_VIEWING,
                omit: runPageOmitOf({ isEnded, isLive }),
              }),
            );
          });
      });
    });
  });

  describe('record page header', () => {
    const verb = (key: string): RecordVerb => ({
      key,
      label: key,
      icon: Link,
      isBusy: false,
      blockedReason: null,
      confirm: null,
      onRun: async () => undefined,
    });
    const recordTarget = (parts: {
      readonly verbs: ReadonlyArray<RecordVerb>;
      readonly sessionVerbs: ReadonlyArray<RecordVerb>;
      readonly destructive: ReadonlyArray<RecordVerb>;
    }): ObjectTarget => ({
      kind: 'record',
      facts: {
        identifier: 'HAR-231',
        title: 'Payout export times out for Northwind',
        url: 'https://linear.app/harborline/issue/HAR-231',
        providerLabel: 'Linear',
        sessionId: null,
        isStarred: null,
        onOpen: null,
        launchLabel: null,
        onLaunch: null,
        onToggleStar: null,
        onRefresh: () => undefined,
        ...parts,
      },
    });
    it.each([
      ['an issue with nothing more', { verbs: [], sessionVerbs: [], destructive: [] }],
      [
        'a merge request with a draft and a close verb',
        { verbs: [verb('draft')], sessionVerbs: [], destructive: [verb('close')] },
      ],
      [
        'a linked Sentry issue with an unlink verb',
        { verbs: [], sessionVerbs: [verb('unlink')], destructive: [] },
      ],
      [
        'a merge request linked to a session',
        { verbs: [verb('draft')], sessionVerbs: [verb('unlink')], destructive: [verb('close')] },
      ],
    ])('%s', (_name, parts) => {
      const target = recordTarget(parts);
      const actions = bindTarget({ state: useAppStore.getState(), target })?.resolve() ?? [];
      expectWithinFive(rowsDrawn({ actions, cuts: RECORD_HEADER_CUTS }));
    });
  });

  describe('artifact page header', () => {
    it.each(ARTIFACT_STATES.map((state) => [state.name, state.facts] as const))(
      '%s',
      (_name, facts) => {
        const definitions = ARTIFACT_KIND.actions;
        const viewing: ActionViewing = { kind: 'artifact', id: 'artifact-payout' };
        const actions = resolveActions({ definitions, facts, viewing });
        expectWithinFive(rowsDrawn({ actions, omit: artifactHeaderOmitOf({ actions }) }));
      },
    );
  });

  describe('branch page header', () => {
    it('never draws more than five rows whatever the pull request and the diff offer', () => {
      const everything = [
        'pullRequest.merge',
        'pullRequest.markReady',
        'pullRequest.reopen',
        'pullRequest.editDetails',
        'pullRequest.requestReview',
        'pullRequest.convertToDraft',
        'pullRequest.cancelAutoMerge',
        'pullRequest.close',
        'pullRequest.openOnGithub',
        'pullRequest.copyLink',
        'diff.push',
        'diff.rebase',
        'diff.changeBase',
        'diff.copyPatch',
        'diff.archiveSession',
      ];
      expect(branchMenuRowsOf({ ids: everything }).size).toBe(MAX_OVERFLOW_ROWS);
    });
  });

  describe('rail branch row', () => {
    it.each(MOUNT_ROW_STATES)('%s', (_state, facts) => {
      const actions = resolveActions({ definitions: MOUNT_KIND.actions, facts });
      expectWithinFive(rowsDrawn({ actions, cuts: MOUNT_ROW_CUTS }));
    });
  });

  describe('commit row', () => {
    it.each(COMMIT_ROW_STATES)('%s', (_state, facts) => {
      const actions = resolveActions({ definitions: COMMIT_KIND.actions, facts });
      expectWithinFive(rowsDrawn({ actions, cuts: HISTORY_ROW_CUTS }));
    });
  });

  describe('storage worktree row', () => {
    it.each(WORKTREE_ROW_STATES)('%s', (_state, facts) => {
      const actions = resolveActions({ definitions: WORKTREE_KIND.actions, facts });
      expectWithinFive(rowsDrawn({ actions, cuts: WORKTREE_ROW_CUTS }));
    });
  });

  describe('port row', () => {
    it.each(PORT_ROW_STATES)('%s, with a stop control', (_state, facts) => {
      const actions = resolveActions({ definitions: PORT_KIND.actions, facts });
      const { omit, cuts } = portRowMenuOf({ hasStop: true });
      const rows = rowsDrawn({ actions, omit, cuts });
      expectWithinFive(rows);
      expect(rows).not.toContain('Stop');
      expect(rows).not.toContain('Force stop');
    });

    it.each(PORT_ROW_STATES)('%s, nested without a stop control', (_state, facts) => {
      const actions = resolveActions({ definitions: PORT_KIND.actions, facts });
      const { omit, cuts } = portRowMenuOf({ hasStop: false });
      const rows = rowsDrawn({ actions, omit, cuts });
      expectWithinFive(rows);
      const offered = actions.map((action) => action.label);
      expect(rows.includes('Force stop')).toBe(offered.includes('Force stop'));
    });
  });
});
