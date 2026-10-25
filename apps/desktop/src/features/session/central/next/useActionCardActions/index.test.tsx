// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { brandId, type IsoDateTime } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../store/storyHarness';
import {
  FIXTURE_ROOT,
  FIXTURE_SESSION,
  aDelegation,
  aView,
} from '../../../../auto/testing/autoViewFixtures';
import type { SessionSuggestion } from '../../../../suggestions/types';
import type { NeedsYouOwner } from '../../../timeline/needsYou';
import { actionCardsOf, type AutoActionTarget } from '../actionCardsOf';

const { runs } = vi.hoisted(() => ({
  runs: new Map<string, () => Promise<void>>(),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock({
    listNudgeEvents: vi.fn(async () => []),
  }),
);
vi.mock('../../../../suggestions/useNextStepOutcomes', () => ({
  recordNextStepOutcome: vi.fn(async () => 'event'),
  revertNextStepOutcome: vi.fn(async () => undefined),
}));
vi.mock('../../../../suggestions/useSuggestionActions', () => ({
  useSuggestionActions:
    () =>
    ({ suggestion }: { readonly suggestion: SessionSuggestion }) => ({
      primary: {
        label: 'Rebase',
        isDisabled: false,
        failureTitle: "Couldn't rebase",
        run: () => runs.get(suggestion.id)?.() ?? Promise.resolve(),
      },
      onDismiss: null,
    }),
}));

import { useActionCardActions } from './index';

const SESSION = aSession({ id: FIXTURE_SESSION });

const CHILD = aDelegation({ key: 'fixer', role: 'fixer', state: 'accepted' });
const ROOT_AGENT = anAgent({ id: FIXTURE_ROOT, kind: 'auto', status: 'running' });
const QUEUED_CHILD = anAgent({
  id: CHILD.childAgentId,
  kind: 'ci-fixer',
  status: 'pending',
  parentAgentId: FIXTURE_ROOT,
});

const TARGET: AutoActionTarget = {
  agentId: CHILD.childAgentId,
  rootAgentId: FIXTURE_ROOT,
  role: 'Fixer',
  kind: 'neverStarted',
  noun: 'Fixer',
  reason: 'Auto created it at 10:21, no first message reached it.',
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: true,
};

const REBASE: SessionSuggestion = {
  id: 'rebase-project:ledger-core',
  kind: 'rebase-project',
  priority: 40,
  band: 2,
  title: 'Rebase ledger-core on main',
  sessionId: FIXTURE_SESSION,
  fingerprint: 'rebase-project:ledger-core',
  targetKey: null,
  payload: { targets: [] },
};

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

const autoCard = () => {
  const [card] = actionCardsOf({ owners: [], suggestions: [], autoTargets: [TARGET] });
  if (card === undefined) {
    throw new Error('Expected the Auto card');
  }
  return card;
};

const suggestionCard = () => {
  const [card] = actionCardsOf({ owners: [], suggestions: [REBASE], autoTargets: [] });
  if (card === undefined) {
    throw new Error('Expected the suggestion card');
  }
  return card;
};

let useAppStore: StoryStore;
const continueStoppedAgent = vi.fn(async () => undefined);
const loadAutoTrees = vi.fn(async () => undefined);

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  runs.clear();
  continueStoppedAgent.mockReset();
  continueStoppedAgent.mockResolvedValue(undefined);
  loadAutoTrees.mockReset();
  loadAutoTrees.mockResolvedValue(undefined);
  useAppStore.setState({
    sessions: [SESSION],
    sessionPhaseRuns: { [FIXTURE_SESSION]: [ROOT_AGENT, QUEUED_CHILD] },
    autoTreeViews: { [FIXTURE_SESSION]: [aView({ phase: 'answering', delegations: [CHILD] })] },
    continueStoppedAgent,
    loadAutoTrees,
  });
});

afterEach(() => {
  cleanup();
});

describe('Auto retry on a never started child', () => {
  it('reloads the Auto trees, then retries once with the child id', async () => {
    const { result } = renderHook(() => useActionCardActions({ session: SESSION }), { wrapper });
    const card = autoCard();
    const main = result.current.actionsFor({ card }).main;

    await act(async () => {
      main?.run();
      main?.run();
    });

    expect(main?.label).toBe('Retry');
    expect(main?.ariaLabel).toBe('Retry "Fixer"');
    expect(loadAutoTrees).toHaveBeenCalledWith({ sessionId: FIXTURE_SESSION });
    expect(continueStoppedAgent).toHaveBeenCalledTimes(1);
    expect(continueStoppedAgent).toHaveBeenCalledWith({
      sessionId: FIXTURE_SESSION,
      agentId: CHILD.childAgentId,
    });
  });

  it('sends nothing and drops the card when a fresh load says the child started', async () => {
    loadAutoTrees.mockImplementation(async () => {
      useAppStore.setState({
        sessionPhaseRuns: {
          [FIXTURE_SESSION]: [
            ROOT_AGENT,
            {
              ...QUEUED_CHILD,
              startedAt: brandId<IsoDateTime>({ value: '2026-10-18T10:22:00.000Z' }),
            },
          ],
        },
      });
    });
    const { result } = renderHook(() => useActionCardActions({ session: SESSION }), { wrapper });
    const card = autoCard();

    await act(async () => {
      result.current.actionsFor({ card }).main?.run();
    });

    expect(continueStoppedAgent).not.toHaveBeenCalled();
    expect(result.current.isHidden({ card })).toBe(true);
  });

  it('keeps the card on a failure, shows the cause and relabels the verb Retry', async () => {
    continueStoppedAgent.mockRejectedValueOnce(new Error('Auto is not running'));
    const { result } = renderHook(() => useActionCardActions({ session: SESSION }), { wrapper });
    const card = autoCard();

    await act(async () => {
      result.current.actionsFor({ card }).main?.run();
    });

    const after = result.current.actionsFor({ card });
    expect(after.failure).toBe('Auto is not running');
    expect(after.main?.label).toBe('Retry');
    expect(after.main?.ariaLabel).toBe('Retry "Fixer"');
    expect(result.current.isHidden({ card })).toBe(false);
  });

  it('offers Open Auto as the second verb and folds it when the column is narrow', () => {
    const { result } = renderHook(() => useActionCardActions({ session: SESSION }), { wrapper });
    const card = autoCard();

    const wide = result.current.actionsFor({ card });
    const narrow = result.current.actionsFor({ card, isNarrow: true });

    expect(wide.second?.label).toBe('Open Auto');
    expect(narrow.second).toBeNull();
    expect(narrow.foldedTarget?.verbs.map((verb) => verb.label)).toEqual(['Open Auto']);
  });
});

describe('Auto retry on a child that left the session after the card drew', () => {
  const GONE = 'This agent is no longer in this session. It was deleted or moved.';

  it('sends nothing and says why when a fresh load no longer holds the child', async () => {
    loadAutoTrees.mockImplementation(async () => {
      useAppStore.setState({
        autoTreeViews: { [FIXTURE_SESSION]: [aView({ phase: 'answering', delegations: [] })] },
      });
    });
    const { result } = renderHook(() => useActionCardActions({ session: SESSION }), { wrapper });
    const card = autoCard();

    await act(async () => {
      result.current.actionsFor({ card }).main?.run();
    });

    expect(continueStoppedAgent).not.toHaveBeenCalled();
    expect(result.current.actionsFor({ card }).failure).toBe(GONE);
    expect(result.current.isHidden({ card })).toBe(false);
  });

  it('still retries a failed child that never got an agent row', async () => {
    useAppStore.setState({
      sessionPhaseRuns: { [FIXTURE_SESSION]: [ROOT_AGENT] },
      autoTreeViews: {
        [FIXTURE_SESSION]: [
          aView({
            phase: 'answering',
            delegations: [{ ...CHILD, state: 'settled', outcome: 'failed' }],
          }),
        ],
      },
    });
    const [card] = actionCardsOf({
      owners: [],
      suggestions: [],
      autoTargets: [{ ...TARGET, kind: 'failed' }],
    });
    if (card === undefined) {
      throw new Error('Expected the Auto card');
    }
    const { result } = renderHook(() => useActionCardActions({ session: SESSION }), { wrapper });

    await act(async () => {
      result.current.actionsFor({ card }).main?.run();
    });

    expect(continueStoppedAgent).toHaveBeenCalledWith({
      sessionId: FIXTURE_SESSION,
      agentId: CHILD.childAgentId,
    });
    expect(result.current.actionsFor({ card }).failure).toBeNull();
  });
});

describe('a card that holds folded cards', () => {
  it('lists each folded card in its menu and shows a folded failure on the row', async () => {
    continueStoppedAgent.mockRejectedValueOnce(new Error('Auto is not running'));
    const { result } = renderHook(() => useActionCardActions({ session: SESSION }), { wrapper });
    const card = { ...suggestionCard(), folded: [autoCard()] };

    const verbs = result.current.actionsFor({ card }).menu?.target.foldedVerbs ?? [];
    expect(verbs.map((verb) => [verb.id, verb.label])).toEqual([
      [`folded:${autoCard().id}`, 'Auto is stuck'],
    ]);

    await act(async () => {
      verbs[0]?.run();
    });

    expect(result.current.actionsFor({ card }).failure).toBe('Auto is not running');
    expect(continueStoppedAgent).toHaveBeenCalledTimes(1);
  });
});

describe('a card that folds a stopped rebase', () => {
  it('lists the stop by its title with the short detail as the second line', () => {
    const owner: NeedsYouOwner = {
      id: 'event:ev-ledger-stop',
      kind: 'rebase',
      text: 'Rebase of hl/feat-ledger-postings stopped · conflict in apps/web/src/a/SideBarFooter.tsx, apps/web/src/b/PastDue.tsx, c.tsx',
      where: null,
      at: '2026-10-22T10:00:00.000Z',
      item: null,
      question: null,
      questionIds: [],
      prNumber: null,
      owed: null,
      mountId: null,
      stopLines: {
        title: 'Rebase of hl/feat-ledger-postings stopped',
        detail: 'Conflict in SideBarFooter.tsx, PastDue.tsx and 1 more',
      },
    };
    const [stop] = actionCardsOf({ owners: [owner], suggestions: [], autoTargets: [] });
    if (stop === undefined) {
      throw new Error('Expected the stop card');
    }
    const { result } = renderHook(() => useActionCardActions({ session: SESSION }), { wrapper });
    const card = { ...suggestionCard(), folded: [stop] };

    const verbs = result.current.actionsFor({ card }).menu?.target.foldedVerbs ?? [];

    expect(verbs.map((verb) => [verb.label, verb.description])).toEqual([
      [
        'Rebase of hl/feat-ledger-postings stopped',
        'Conflict in SideBarFooter.tsx, PastDue.tsx and 1 more',
      ],
    ]);
  });
});

describe('a late result for a card that is already gone', () => {
  it('does not bring a dismissed card back when its primary resolves afterwards', async () => {
    let finish: () => void = () => undefined;
    runs.set(
      REBASE.id,
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useActionCardActions({ session: SESSION }), { wrapper });
    const card = suggestionCard();

    await act(async () => {
      result.current.actionsFor({ card }).main?.run();
    });
    await act(async () => {
      result.current.actionsFor({ card }).menu?.target.onNotNow?.();
    });
    expect(result.current.isHidden({ card })).toBe(true);
    await act(async () => {
      finish();
    });

    expect(result.current.isHidden({ card })).toBe(true);
  });
});
