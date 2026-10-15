// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  SESSION,
  checkChangesSuggestion,
  pushSuggestion,
  rebaseSuggestion,
} from '../../../__tests__/helpers/actionFixtures';
import { bindTarget, runObjectActionWithOutcome } from '../registry';
import { isSameFacts } from '../isSameFacts';
import type { ActionEnv, SuggestionActionTarget } from '../types';
import type { SessionSuggestion } from '../../suggestions/types';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const spawnAgent = vi.fn(async () => brandId<AgentId>({ value: 'agent-new' }));
const openRewriteHistory = vi.fn();
const openDrawer = vi.fn();
const setNewDrawerAutoGoal = vi.fn();

beforeEach(async () => {
  await resetStoryStore();
  spawnAgent.mockClear();
  openRewriteHistory.mockClear();
  openDrawer.mockClear();
  setNewDrawerAutoGoal.mockClear();
  useAppStore.setState({ spawnAgent, openRewriteHistory, openDrawer, setNewDrawerAutoGoal });
});

const env = (): ActionEnv => ({
  getState: () => useAppStore.getState(),
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'overflow',
  anchorKey: null,
  viewing: null,
});

type TargetParams = {
  readonly suggestion: SessionSuggestion;
  readonly startsRole?: SuggestionActionTarget['startsRole'];
  readonly isAutoOn?: boolean;
};

const targetOf = ({
  suggestion,
  startsRole = null,
  isAutoOn = false,
}: TargetParams): SuggestionActionTarget => ({
  kind: 'suggestion',
  sessionId: SESSION,
  suggestion,
  startsRole,
  isAutoOn,
});

type RunParams = {
  readonly target: SuggestionActionTarget;
  readonly actionId: string;
};

const run = ({ target, actionId }: RunParams) =>
  runObjectActionWithOutcome({ target, actionId, env: env(), choice: null });

describe('suggestion actions', () => {
  it('starts a tester or an implementer on the session without taking focus', async () => {
    const target = targetOf({ suggestion: checkChangesSuggestion(), startsRole: 'reviewer' });

    await run({ target, actionId: 'suggestion.startTester' });
    await run({ target, actionId: 'suggestion.startImplementer' });

    expect(spawnAgent.mock.calls).toEqual([
      [SESSION, { kindOverride: 'tester', focus: 'none' }],
      [SESSION, { kindOverride: 'implementer', focus: 'none' }],
    ]);
  });

  it('opens the rewrite history of the target that was picked', async () => {
    const target = targetOf({ suggestion: rebaseSuggestion({ count: 3 }) });

    await run({ target, actionId: 'suggestion.rebase.mount:notify-relay' });

    expect(openRewriteHistory).toHaveBeenCalledTimes(1);
    expect(openRewriteHistory).toHaveBeenCalledWith(SESSION, '/w/notify-relay');
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('opens the Agent tab with the card as context from the talk, and starts nothing', async () => {
    const target = targetOf({
      suggestion: checkChangesSuggestion(),
      startsRole: 'reviewer',
      isAutoOn: true,
    });

    await run({ target, actionId: 'suggestion.talkWithAuto' });

    expect(setNewDrawerAutoGoal).toHaveBeenCalledWith({
      sessionId: SESSION,
      goal: expect.stringContaining(
        'Check the changes before you push\nMaya finished the payout export',
      ),
    });
    expect(openDrawer).toHaveBeenCalledWith({
      kind: 'new',
      sessionId: SESSION,
      payload: { tab: 'agent' },
    });
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('never runs the talk while the experiment is off or when the card starts no role', async () => {
    const off = targetOf({ suggestion: checkChangesSuggestion(), startsRole: 'reviewer' });
    const noRole = targetOf({ suggestion: pushSuggestion(), isAutoOn: true });

    expect(await run({ target: off, actionId: 'suggestion.talkWithAuto' })).toBe('unchanged');
    expect(await run({ target: noRole, actionId: 'suggestion.talkWithAuto' })).toBe('unchanged');
    expect(openDrawer).not.toHaveBeenCalled();
  });

  it('never starts a role or a rebase on a card that does not offer it', async () => {
    const target = targetOf({ suggestion: pushSuggestion() });

    expect(await run({ target, actionId: 'suggestion.startTester' })).toBe('unchanged');
    expect(await run({ target, actionId: 'suggestion.rebase.mount:ledger-core' })).toBe(
      'unchanged',
    );
    expect(spawnAgent).not.toHaveBeenCalled();
    expect(openRewriteHistory).not.toHaveBeenCalled();
  });

  it('keeps one project card without a menu: a single rebase target is the primary', () => {
    const bound = bindTarget({
      state: useAppStore.getState(),
      target: targetOf({ suggestion: rebaseSuggestion({ count: 1 }) }),
    });

    expect(bound?.resolve()).toEqual([]);
  });

  it('gives the same facts for the same target, so a menu does not rebind in a loop', () => {
    const target = targetOf({ suggestion: checkChangesSuggestion(), startsRole: 'reviewer' });
    const first = bindTarget({ state: useAppStore.getState(), target });
    const second = bindTarget({ state: useAppStore.getState(), target });

    expect(isSameFacts({ previous: first?.facts ?? null, next: second?.facts ?? null })).toBe(true);
  });
});
