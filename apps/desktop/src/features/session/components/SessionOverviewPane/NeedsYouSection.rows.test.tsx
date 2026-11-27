// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { actionCardsOf, type AutoActionTarget } from '../../central/next/actionCardsOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import type { NeedsYouOwner } from '../../timeline/needsYou';
import { NeedsYouSection } from './NeedsYouSection';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const targetOf = (kind: AutoActionTarget['kind']): AutoActionTarget => ({
  agentId: brandId<AgentId>({ value: `agent-${kind}` }),
  rootAgentId: brandId<AgentId>({ value: 'agent-lead' }),
  role: 'Planner',
  kind,
  noun: 'Planner',
  reason: 'The provider refused.',
  reasonCode: null,
  mountId: null,
  plan: null,
  canRetry: true,
});

const ownerOf = (kind: NeedsYouOwner['kind']): NeedsYouOwner => ({
  id: `owner-${kind}`,
  kind,
  text: `Owner ${kind} waits`,
  where: 'payments-api',
  at: null,
  item: null,
  question: null,
  questionIds: [],
  prNumber: null,
  owed: null,
  mountId: null,
});

const actionsFor: ActionCardActions['actionsFor'] = () => ({
  main: {
    label: 'Retry',
    run: () => undefined,
    isBusy: false,
    isDisabled: false,
    picker: null,
    ariaLabel: undefined,
    confirmRole: null,
    confirm: null,
  },
  second: {
    label: 'Open the Lead',
    run: () => undefined,
    isBusy: false,
    isDisabled: false,
    picker: null,
    ariaLabel: undefined,
    confirmRole: null,
    confirm: null,
  },
  failure: null,
  isBusy: false,
  agentKind: null,
  menu: null,
  foldedTarget: null,
});

const KINDS = [
  'neverStarted',
  'failed',
  'timedOut',
  'approve',
  'blocked',
] as const satisfies ReadonlyArray<AutoActionTarget['kind']>;

const OWNERS = ['question', 'agent', 'run', 'fixRun', 'rebase'] as const;

const show = () => {
  const cards = actionCardsOf({
    owners: OWNERS.map((kind) => ownerOf(kind)),
    suggestions: [],
    autoTargets: KINDS.map((kind) => targetOf(kind)),
  });
  render(
    <NeedsYouSection
      sessionId={SESSION_ID}
      cards={cards}
      questions={[]}
      permission={null}
      actionsFor={actionsFor}
      kickerById={new Map()}
    />,
  );
  return cards;
};

describe('NeedsYouSection', () => {
  it('is a section head like Next and Projects with a tone dot and no side bar', () => {
    show();

    const section = screen.getByRole('region', { name: 'Needs you' });
    const head = screen.getByRole('heading', { level: 2, name: 'Needs you' });
    expect(section.firstElementChild?.contains(head)).toBe(true);
    expect(screen.queryByTestId('tone-bar')).toBeNull();
    expect(section.querySelector('[data-needs-you-rows]')).not.toBeNull();
  });

  it('draws one row per attention kind inside one block', () => {
    const cards = show();

    expect(cards).toHaveLength(KINDS.length + OWNERS.length);
    const block = document.querySelector('[data-needs-you-rows]');
    expect(block).not.toBeNull();
    const rows = block?.querySelectorAll('[data-move]') ?? [];
    expect(rows).toHaveLength(cards.length);
    for (const card of cards) {
      expect(block?.querySelector(`[data-move="${card.id}"]`)).not.toBeNull();
    }
  });

  it('puts the reason first and who and where on one quiet line', () => {
    show();

    const row = document.querySelector<HTMLElement>('[data-move="auto:agent-failed:failed"]');
    if (row === null) {
      throw new Error('no row');
    }
    expect(within(row).getByText('The planner failed. The provider refused.').tagName).toBe('SPAN');
    expect(within(row).getByText('Lead').textContent).toBe('Lead');
    expect(within(row).queryByText('Lead needs you')).toBeNull();
  });

  it('keeps one filled verb and gives every other verb a quiet look', () => {
    show();

    const filled = document.querySelectorAll('[data-variant="primary"]');
    expect(filled).toHaveLength(1);
    expect(filled[0]?.closest('[data-move-primary]')).not.toBeNull();
    const quiet = document.querySelectorAll('[data-variant="quiet"]');
    expect(quiet.length).toBeGreaterThan(1);
  });
});
