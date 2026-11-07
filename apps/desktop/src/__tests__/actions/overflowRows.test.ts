// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);

import { readFileSync } from 'fs';
import { join } from 'path';
import { Link } from 'lucide-react';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
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
  FoldedVerb,
  ObjectKindDefinition,
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
import {
  AGENT,
  RUN,
  SESSION,
  checkChangesSuggestion,
  planReadySuggestion,
  pushSuggestion,
  rebaseSuggestion,
  seedActionState,
  type ActionSeed,
} from '../helpers/actionFixtures';
import { DESKTOP_SRC, desktopSources, isTestSource } from '../helpers/sourceImports';
import { SUGGESTION_KIND, type SuggestionFacts } from '../../features/actions/kinds/suggestion';
import {
  NOTIFICATION_KIND,
  type NotificationFacts,
} from '../../features/actions/kinds/notification';
import { ACTION_CARD_KIND } from '../../features/actions/kinds/actionCard';
import {
  REVIEW_COMMENT_KIND,
  type ReviewCommentFacts,
} from '../../features/actions/kinds/reviewComment';
import { drawerMenuOmitOf } from '../../features/resolve/components/ReviewCommentDrawer/drawerMenuOmitOf';
import { reviewBarPlanOf } from '../../features/resolve/components/ReviewFlow/reviewBarPlan';
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

const MEASURED_KINDS = new Set<ObjectTarget['kind']>();

type WithinFiveParams = {
  readonly kinds: ReadonlyArray<ObjectTarget['kind']>;
  readonly rows: ReadonlyArray<string>;
};

const expectWithinFive = ({ kinds, rows }: WithinFiveParams): void => {
  kinds.forEach((kind) => MEASURED_KINDS.add(kind));
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
      expectWithinFive({
        kinds: ['session'],
        rows: rowsOfTarget({ target: SESSION_TARGET, only }),
      });
    });
  });

  describe('agent page header', () => {
    it.each(AGENT_STATES)('%s', (_state, value) => {
      seed(value);
      [false, true].forEach((isAutoRoot) => {
        expectWithinFive({
          kinds: ['agent'],
          rows: rowsOfTarget({
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
            expectWithinFive({
              kinds: ['workflowRun'],
              rows: rowsOfTarget({
                target,
                viewing: RUN_VIEWING,
                omit: runPageOmitOf({ isEnded, isLive }),
              }),
            });
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
      expectWithinFive({
        kinds: ['record'],
        rows: rowsDrawn({ actions, cuts: RECORD_HEADER_CUTS }),
      });
    });
  });

  describe('artifact page header', () => {
    it.each(ARTIFACT_STATES.map((state) => [state.name, state.facts] as const))(
      '%s',
      (_name, facts) => {
        const definitions = ARTIFACT_KIND.actions;
        const viewing: ActionViewing = { kind: 'artifact', id: 'artifact-payout' };
        const actions = resolveActions({ definitions, facts, viewing });
        expectWithinFive({
          kinds: ['artifact'],
          rows: rowsDrawn({ actions, omit: artifactHeaderOmitOf({ actions }) }),
        });
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
      const drawn = Array.from(branchMenuRowsOf({ ids: everything }));
      expectWithinFive({ kinds: ['pullRequest', 'diff'], rows: drawn });
      expect(drawn.length).toBe(MAX_OVERFLOW_ROWS);
    });
  });

  describe('rail branch row', () => {
    it.each(MOUNT_ROW_STATES)('%s', (_state, facts) => {
      const actions = resolveActions({ definitions: MOUNT_KIND.actions, facts });
      expectWithinFive({ kinds: ['mount'], rows: rowsDrawn({ actions, cuts: MOUNT_ROW_CUTS }) });
    });
  });

  describe('commit row', () => {
    it.each(COMMIT_ROW_STATES)('%s', (_state, facts) => {
      const actions = resolveActions({ definitions: COMMIT_KIND.actions, facts });
      expectWithinFive({ kinds: ['commit'], rows: rowsDrawn({ actions, cuts: HISTORY_ROW_CUTS }) });
    });
  });

  describe('storage worktree row', () => {
    it.each(WORKTREE_ROW_STATES)('%s', (_state, facts) => {
      const actions = resolveActions({ definitions: WORKTREE_KIND.actions, facts });
      expectWithinFive({
        kinds: ['worktree'],
        rows: rowsDrawn({ actions, cuts: WORKTREE_ROW_CUTS }),
      });
    });
  });

  describe('port row', () => {
    it.each(PORT_ROW_STATES)('%s, with a stop control', (_state, facts) => {
      const actions = resolveActions({ definitions: PORT_KIND.actions, facts });
      const { omit, cuts } = portRowMenuOf({ hasStop: true });
      const rows = rowsDrawn({ actions, omit, cuts });
      expectWithinFive({ kinds: ['port'], rows });
      expect(rows).not.toContain('Stop');
      expect(rows).not.toContain('Force stop');
    });

    it.each(PORT_ROW_STATES)('%s, nested without a stop control', (_state, facts) => {
      const actions = resolveActions({ definitions: PORT_KIND.actions, facts });
      const { omit, cuts } = portRowMenuOf({ hasStop: false });
      const rows = rowsDrawn({ actions, omit, cuts });
      expectWithinFive({ kinds: ['port'], rows });
      const offered = actions.map((action) => action.label);
      expect(rows.includes('Force stop')).toBe(offered.includes('Force stop'));
    });
  });
});

type DynamicRowsParams<T, F extends object> = {
  readonly definition: ObjectKindDefinition<T, F>;
  readonly facts: F;
};

const dynamicRowsOf = <T, F extends object>({
  definition,
  facts,
}: DynamicRowsParams<T, F>): ReadonlyArray<string> =>
  rowsDrawn({
    actions: resolveActions({
      definitions: [...(definition.adapted?.({ facts }) ?? []), ...definition.actions],
      facts,
    }),
  });

const FOLDED_VERB_COUNTS: ReadonlyArray<number> = [1, 2, 5, 6, 9];

type FoldedCountParams = {
  readonly count: number;
};

const foldedVerbsOf = ({ count }: FoldedCountParams): ReadonlyArray<FoldedVerb> =>
  Array.from({ length: count }, (_unused, index) => ({
    id: `verb-${index}`,
    label: `Folded verb ${index}`,
    run: () => undefined,
  }));

type SuggestionFactsParams = Pick<SuggestionFacts, 'suggestion' | 'foldedVerbs'>;

const suggestionFactsOf = ({
  suggestion,
  foldedVerbs,
}: SuggestionFactsParams): SuggestionFacts => ({
  sessionId: SESSION,
  suggestion,
  startsRole: 'implementer',
  isAutoOn: true,
  onNotNow: () => undefined,
  foldedVerbs,
});

describe('a suggestion ⋯ with dynamic rows holds at most five rows', () => {
  const suggestions = [
    ['check changes', checkChangesSuggestion()],
    ['plan ready', planReadySuggestion()],
    ['push', pushSuggestion()],
    ['rebase, two folders', rebaseSuggestion({ count: 2 })],
    ['rebase, three folders', rebaseSuggestion({ count: 3 })],
    ['rebase, seven folders', rebaseSuggestion({ count: 7 })],
  ] as const;
  it.each(suggestions)('%s, whatever the folded verbs', (_name, suggestion) => {
    FOLDED_VERB_COUNTS.forEach((count) => {
      expectWithinFive({
        kinds: ['suggestion'],
        rows: dynamicRowsOf({
          definition: SUGGESTION_KIND,
          facts: suggestionFactsOf({ suggestion, foldedVerbs: foldedVerbsOf({ count }) }),
        }),
      });
    });
  });
});

describe('an action card ⋯ holds at most five folded verbs', () => {
  it.each(FOLDED_VERB_COUNTS)('%s folded verbs', (count) => {
    expectWithinFive({
      kinds: ['actionCard'],
      rows: dynamicRowsOf({
        definition: ACTION_CARD_KIND,
        facts: { verbs: foldedVerbsOf({ count }) },
      }),
    });
  });
});

type ReplyOnlyParams = {
  readonly state: 'ready' | 'edited';
};

const replyOnlyFactsOf = ({ state }: ReplyOnlyParams): ReviewCommentFacts => ({
  sessionId: brandId<SessionId>({ value: 'session-harborline' }),
  threadId: 'thread-retry-constant',
  itemId: 'item-retry-constant',
  revision: 1,
  state,
  isNote: false,
  hasPr: true,
  provider: 'GitHub',
  host: 'github',
  canResolve: true,
  agentId: null,
  path: 'src/webhooks/retryPolicy.ts',
  url: 'https://github.com/harborline/payments-api/pull/231#discussion_r1',
  reply: 'The constant is already capped one layer up.',
  approval: 'none',
  remote: null,
  elsewhereSha: null,
  prUrl: 'https://github.com/harborline/payments-api/pull/231',
  verdict: null,
  isChecking: false,
  isPushedMissing: false,
  remoteReply: null,
  isReplyOnly: true,
  isReplyFailure: false,
  hasFixOnBranch: false,
  laneAcceptCount: 1,
  laneAcceptNotes: 0,
});

describe('a review comment drawer ⋯ for a reply-only draft', () => {
  it.each(['ready', 'edited'] as const)('holds at most five rows when the draft is %s', (state) => {
    const actions = resolveActions({
      definitions: REVIEW_COMMENT_KIND.actions,
      facts: replyOnlyFactsOf({ state }),
    });
    const shown = reviewBarPlanOf({
      word: 'to_review',
      state,
      hasRemote: false,
      actions: actions.map((candidate) => ({ id: candidate.id, slot: candidate.slot })),
    }).flatMap((item) => (item.kind === 'action' ? [item.id] : []));
    const rare = actions.filter((candidate) => !shown.includes(candidate.id));
    const rows = rowsDrawn({ actions, omit: drawerMenuOmitOf({ shown, rare }) });
    expect(rows.length).toBeGreaterThan(0);
    expectWithinFive({ kinds: ['reviewComment'], rows });
  });
});

describe('a notification row ⋯ holds at most five rows', () => {
  const states = [true, false].flatMap((hasOpen) =>
    [true, false].flatMap((isUnread) =>
      (['info', 'warning', 'error'] as const).map((severity) => ({ hasOpen, isUnread, severity })),
    ),
  );
  it.each(states)(
    'open $hasOpen, unread $isUnread, $severity',
    ({ hasOpen, isUnread, severity }) => {
      const facts: NotificationFacts = {
        ids: ['n-1'],
        unreadIds: isUnread ? ['n-1'] : [],
        title: 'Webhook redelivery failed',
        body: 'payments-api returned 502',
        severity,
        open: hasOpen ? { label: 'Retry', run: () => undefined } : null,
      };
      const actions = resolveActions({ definitions: NOTIFICATION_KIND.actions, facts });
      expectWithinFive({ kinds: ['notification'], rows: rowsDrawn({ actions }) });
    },
  );
});

const CALLER_KINDS: Readonly<Record<string, ReadonlyArray<ObjectTarget['kind']>>> = {
  'app/components/MockScene/scenes/u30/edges/PopoversStage.tsx': ['agent'],
  'app/components/SessionRail/SessionLevel/SessionLevelActions.tsx': ['session'],
  'app/components/SessionRail/SessionLevel/WorktreeRow.tsx': ['mount'],
  'features/actions/ActionCardOverflowMenu.tsx': ['actionCard'],
  'features/actions/ExploreFileMenu.tsx': ['exploreFile'],
  'features/actions/IntegrationMenu.tsx': ['integration'],
  'features/actions/NewFormMenuList.tsx': ['newForm'],
  'features/actions/PortRowMenu.tsx': ['port'],
  'features/actions/ProviderMenu.tsx': ['provider'],
  'features/actions/SuggestionOverflowMenu.tsx': ['suggestion'],
  'features/actions/TaskListMenu.tsx': ['taskList'],
  'features/actions/TerminalTabMenu.tsx': ['terminalTab'],
  'features/actions/WorkflowListMenu.tsx': ['workflowList'],
  'features/artifacts/components/ArtifactShell/ArtifactOverflowMenu.tsx': ['artifact'],
  'features/auto/chat/AutoDockPlanComments.tsx': ['planComments'],
  'features/branch/components/BranchHeader/BranchOverflow.tsx': ['pullRequest', 'diff'],
  'features/history/components/CommitsHistory/HistoryRowActions.tsx': ['commit'],
  'features/notifications/components/NotificationRow/NotificationRowActions.tsx': ['notification'],
  'features/notifications/components/NotificationsStudio/NotificationsHeaderActions.tsx': [
    'notifications',
  ],
  'features/resolve/components/ReviewFlow/ThreadOverflowMenu.tsx': ['reviewComment'],
  'features/review/components/WriteReview/index.tsx': ['writeReview'],
  'features/session/components/AgentHeaderActions.tsx': ['agent'],
  'features/session/components/AgentTree/RunOverflowMenu.tsx': ['workflowRun'],
  'features/session/components/ContextDrawer/SlotSourceActions.tsx': ['contextSlot'],
  'features/session/components/PresetRun/RunStepActions.tsx': ['workflowRun'],
  'features/storage/components/StoragePage/WorktreeRowActions.tsx': ['worktree'],
  'features/workspace/components/StageBoard/StageColumn/DoneLaneMenu/index.tsx': ['doneLane'],
  'shared/components/StudioDetail/RecordHeader/index.tsx': ['record'],
};

const CALLER_MARKERS: ReadonlyArray<string> = [
  '<ObjectOverflowMenu',
  '<ObjectOverflowList',
  'branchMenuRowsOf(',
];

const IMPLEMENTATION_PREFIXES: ReadonlyArray<string> = [
  'features/actions/ObjectOverflowMenu.tsx',
  'features/actions/components/',
  'features/branch/branchPrimary.ts',
];

type SourceParams = {
  readonly path: string;
};

const readSource = ({ path }: SourceParams): string =>
  readFileSync(join(DESKTOP_SRC, path), 'utf8');

const callerFiles = desktopSources().filter(
  (path) =>
    !isTestSource(path) &&
    !IMPLEMENTATION_PREFIXES.some((prefix) => path.startsWith(prefix)) &&
    CALLER_MARKERS.some((marker) => readSource({ path }).includes(marker)),
);

const registryKinds: ReadonlyArray<{ readonly kind: string; readonly definition: string }> =
  Array.from(
    readSource({ path: 'features/actions/registry.ts' }).matchAll(
      /case '(\w+)':\s*return bind\(\{ definition: (\w+)/g,
    ),
  ).map((match) => ({ kind: match[1] ?? '', definition: match[2] ?? '' }));

const kindModules = import.meta.glob<Record<string, unknown>>(
  ['../../features/actions/kinds/*.ts', '!../../features/actions/kinds/*.test.ts'],
  { eager: true },
);

type KindShape = {
  readonly actions: ReadonlyArray<unknown>;
  readonly adapted?: unknown;
};

type DefinitionParams = {
  readonly name: string;
};

const isKindDefinition = (value: unknown): value is KindShape =>
  typeof value === 'object' && value !== null && 'actions' in value && 'facts' in value;

const definitionOf = ({ name }: DefinitionParams): KindShape => {
  const found = Object.values(kindModules)
    .map((module) => module[name])
    .find(isKindDefinition);
  if (found === undefined) {
    throw new Error(`registry names ${name} but no kind module exports it`);
  }
  return found;
};

describe('the overflow inventory is derived from the source', () => {
  it('reads every registry kind and every menu caller', () => {
    expect(registryKinds.length).toBeGreaterThan(40);
    expect(callerFiles.length).toBeGreaterThan(20);
  });

  it('lists exactly the menu callers the source holds', () => {
    expect(callerFiles.filter((path) => CALLER_KINDS[path] === undefined)).toEqual([]);
    expect(Object.keys(CALLER_KINDS).filter((path) => !callerFiles.includes(path))).toEqual([]);
  });

  it('names registry kinds, and every kind a caller writes out', () => {
    const known = new Set(registryKinds.map(({ kind }) => kind));
    Object.entries(CALLER_KINDS).forEach(([path, kinds]) => {
      kinds.forEach((kind) => expect(known.has(kind), `${path}: ${kind}`).toBe(true));
      const written = registryKinds
        .filter(({ kind }) => readSource({ path }).includes(`kind: '${kind}'`))
        .map(({ kind }) => kind);
      written.forEach((kind) => expect(kinds, `${path} writes ${kind}`).toContain(kind));
    });
  });

  it('measures every drawn kind that can exceed five rows, dynamic rows included', () => {
    const drawn = new Set<string>(Object.values(CALLER_KINDS).flat());
    const unmeasured = registryKinds
      .filter(({ kind }) => drawn.has(kind))
      .filter(({ definition }) => {
        const found = definitionOf({ name: definition });
        return found.adapted !== undefined || found.actions.length > MAX_OVERFLOW_ROWS;
      })
      .map(({ kind }) => kind)
      .filter((kind) => !Array.from(MEASURED_KINDS).some((measured) => measured === kind));
    expect(unmeasured, `no state measures ${unmeasured.join(', ')}`).toEqual([]);
  });
});
