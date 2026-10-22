// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import type { SessionSuggestion } from '../../../suggestions/types';
import { actionCardsOf, type AutoActionTarget } from './actionCardsOf';
import { NextStackView } from './NextStackView';
import type { CardActions } from './useActionCardActions';

const HARBORLINE = brandId<SessionId>({ value: 'session-harborline' });
const NORTHWIND = brandId<SessionId>({ value: 'session-northwind' });
const HOME = brandId<MountId>({ value: 'mount-home' });

const STUCK: AutoActionTarget = {
  agentId: brandId<AgentId>({ value: 'agent-home' }),
  rootAgentId: brandId<AgentId>({ value: 'agent-auto' }),
  role: 'Build the hero',
  noun: 'Implementer',
  kind: 'childBlocked',
  reason: null,
  reasonCode: null,
  mountId: HOME,
  plan: null,
  canRetry: true,
};

const PUSH: SessionSuggestion = {
  id: 'push-branch:faq',
  kind: 'push-branch',
  priority: 41,
  band: 2,
  title: 'Push hl/feat-center-faq-page',
  sessionId: HARBORLINE,
  fingerprint: 'push-branch:faq',
  targetKey: 'branch:mount-faq',
  payload: {
    mountId: brandId<MountId>({ value: 'mount-faq' }),
    projectId: brandId({ value: 'project-harbor' }),
    projectName: 'harbor-portal',
    branch: 'hl/feat-center-faq-page',
    worktreePath: '/work/faq',
    state: 'not-pushed',
    ahead: 4,
    behind: 0,
  },
};

const CARDS = actionCardsOf({ owners: [], suggestions: [PUSH], autoTargets: [STUCK] });

const actionsFor = (): CardActions => ({
  main: {
    label: 'Go',
    ariaLabel: undefined,
    isDisabled: false,
    isBusy: false,
    confirmRole: null,
    hasPicker: false,
    run: () => undefined,
  },
  second: null,
  failure: null,
  isBusy: false,
  agentKind: null,
  menu: null,
  foldedTarget: null,
});

type ShowParams = {
  readonly sessionId: SessionId;
};

const show = ({ sessionId }: ShowParams) =>
  render(
    <ToastProvider>
      <NextStackView
        sessionId={sessionId}
        cards={CARDS}
        actionsFor={actionsFor}
        nameFor={({ card }) => (card.kind === 'push-branch' ? 'faq' : null)}
      />
    </ToastProvider>,
  );

type GroupParams = {
  readonly name: string;
};

const groupButton = ({ name }: GroupParams) =>
  within(screen.getByRole('region', { name })).getAllByRole('button')[0];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('NextStackView', () => {
  it('opens the first group, folds the rest with a count and a hint, and fills one button', () => {
    show({ sessionId: HARBORLINE });

    expect(groupButton({ name: 'Fix' })?.getAttribute('aria-expanded')).toBe('true');
    expect(groupButton({ name: 'Ship' })?.getAttribute('aria-expanded')).toBe('false');
    expect(groupButton({ name: 'Ship' })?.textContent).toBe('Ship1faq');
    expect(screen.getByRole('heading', { level: 2 }).parentElement?.textContent).toBe('Next2');

    const shipButton = groupButton({ name: 'Ship' });
    if (shipButton !== undefined) {
      fireEvent.click(shipButton);
    }

    expect(screen.getAllByRole('button', { name: 'Go' }).map((b) => b.dataset.variant)).toEqual([
      'primary',
      'secondary',
    ]);
  });

  it('keeps the open state per session', () => {
    const { unmount } = show({ sessionId: HARBORLINE });
    const fix = groupButton({ name: 'Fix' });
    if (fix !== undefined) {
      fireEvent.click(fix);
    }
    unmount();

    show({ sessionId: NORTHWIND });
    expect(groupButton({ name: 'Fix' })?.getAttribute('aria-expanded')).toBe('true');
    cleanup();

    show({ sessionId: HARBORLINE });
    expect(groupButton({ name: 'Fix' })?.getAttribute('aria-expanded')).toBe('false');
    expect(useAppStore.getState().nextGroupChoice[HARBORLINE]).toEqual({ fix: false });
  });
});
