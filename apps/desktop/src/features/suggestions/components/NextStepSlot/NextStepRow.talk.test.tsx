// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);

vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId, type PlanId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { SETTING_AUTO_EXPERIMENT } from '../../../settings/settings';
import { AutoReleaseContext } from '../../../auto/autoReleaseContext';
import type { SessionSuggestion } from '../../types';
import type { SuggestionActions } from '../../useSuggestionActions';
import { NextStepRow } from './NextStepRow';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });

const SHARED = {
  priority: 40,
  band: 2,
  title: 'Implement the retry guard',
  detail: 'The plan is approved',
  sessionId: SESSION_ID,
  targetKey: null,
} as const;

const CHECK_CHANGES: SessionSuggestion = {
  ...SHARED,
  id: 'check-changes:agent-1',
  kind: 'check-changes',
  fingerprint: 'check-changes:agent-1',
  payload: { agentId: brandId<AgentId>({ value: 'agent-1' }) },
};

const PLAN_READY: SessionSuggestion = {
  ...SHARED,
  id: 'plan-ready:plan-1',
  kind: 'plan-ready',
  fingerprint: 'plan-ready:plan-1',
  payload: { planId: brandId<PlanId>({ value: 'plan-1' }) },
};

type RenderParams = {
  readonly suggestion: SessionSuggestion;
  readonly actions: SuggestionActions;
  readonly isAutoOn?: boolean;
};

const renderRow = ({ suggestion, actions, isAutoOn = true }: RenderParams) => {
  useAppStore.setState({ settings: { [SETTING_AUTO_EXPERIMENT]: isAutoOn ? 'true' : 'false' } });
  return render(
    <ToastProvider>
      <AutoReleaseContext.Provider value>
        <NextStepRow
          suggestion={suggestion}
          actions={actions}
          compact={false}
          isPending={false}
          onNotNow={vi.fn()}
        />
      </AutoReleaseContext.Provider>
    </ToastProvider>,
  );
};

const primaryOf = (overrides: Partial<NonNullable<SuggestionActions['primary']>> = {}) => ({
  label: 'Start Implementer',
  shortLabel: 'Start',
  isDisabled: false,
  failureTitle: 'Failed',
  agentKind: 'implementer' as const,
  run: vi.fn(async () => undefined),
  ...overrides,
});

describe('Talk it through with Auto in the more menu of a Next card', () => {
  it('is the last entry after the other roles, and opens the talk with the card as context', () => {
    const openDrawer = vi.fn();
    const setNewDrawerAutoGoal = vi.fn();
    useAppStore.setState({ openDrawer, setNewDrawerAutoGoal });
    renderRow({
      suggestion: CHECK_CHANGES,
      actions: { primary: primaryOf({ agentKind: 'reviewer' }), onDismiss: null },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'More options for Implement the retry guard' }),
    );
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');

    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Start tester instead'),
      expect.stringContaining('Start implementer instead'),
      expect.stringContaining('Talk it through with Auto'),
    ]);
    fireEvent.click(items[2]!);
    expect(setNewDrawerAutoGoal).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      goal: expect.stringContaining('Implement the retry guard\nThe plan is approved'),
    });
    expect(openDrawer).toHaveBeenCalledWith({
      kind: 'new',
      sessionId: SESSION_ID,
      payload: { form: 'auto' },
    });
  });

  it('draws no menu for a role card with nothing else to offer, as an overflow needs two', () => {
    renderRow({ suggestion: PLAN_READY, actions: { primary: primaryOf(), onDismiss: null } });

    expect(screen.queryByRole('button', { name: /More options/ })).toBeNull();
  });

  it('leaves a card that starts no agent without the entry', () => {
    renderRow({
      suggestion: CHECK_CHANGES,
      actions: {
        primary: primaryOf({ agentKind: undefined, label: 'Push', shortLabel: 'Push' }),
        onDismiss: null,
      },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'More options for Implement the retry guard' }),
    );

    expect(screen.queryByRole('menuitem', { name: /Talk it through/ })).toBeNull();
  });

  it('is hidden while the experiment is off, and the menu keeps its other roles', () => {
    renderRow({
      suggestion: CHECK_CHANGES,
      actions: { primary: primaryOf({ agentKind: 'reviewer' }), onDismiss: null },
      isAutoOn: false,
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'More options for Implement the retry guard' }),
    );

    expect(screen.queryByRole('menuitem', { name: /Talk it through/ })).toBeNull();
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem')).toHaveLength(2);
  });
});
