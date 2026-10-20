// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../../store/storyHarness';
import { formatClock } from '../../../../../../shared/utils/time/formatClock';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { AgentModels } from '../../../../timeline/ranModels';
import { RowModelsCard } from './RowModelsCard';

const agent = anAgent({
  id: 'agent-3' as AgentId,
  sessionId: 'session-webhooks' as SessionId,
  name: 'Add the key column',
  status: 'completed',
});

const entry: TimelineAgentEntry = {
  kind: 'agent',
  id: 'agent:3',
  at: null,
  ordinal: 3,
  agent,
  agentKind: 'implementer',
  isMissingArtifact: false,
  stepLabel: '3',
  openQuestions: [],
  terminalQuestions: [],
  children: [],
  answers: [],
  hasDuration: true,
  chain: null,
};

const KIMI_ENDED = Date.parse('2026-10-04T16:26:00Z');
const SONNET_ENDED = Date.parse('2026-10-04T16:29:00Z');

const FALLBACK: AgentModels = {
  isPlanned: false,
  models: [
    {
      key: 'moonshot:Kimi K3',
      provider: 'moonshot',
      name: 'Kimi K3',
      effort: 'High',
      endReason: 'failed',
      endedAtMs: KIMI_ENDED,
    },
    {
      key: 'anthropic:Sonnet 5.5',
      provider: 'anthropic',
      name: 'Sonnet 5.5',
      effort: 'High',
      endReason: 'succeeded',
      endedAtMs: SONNET_ENDED,
    },
  ],
};

const [KIMI, SONNET] = FALLBACK.models;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const renderCard = ({ models }: { readonly models: AgentModels }) =>
  render(
    <RowModelsCard entry={entry} ordinal="3" kindWord="Implementer" models={models} isOpen>
      <button type="button">models</button>
    </RowModelsCard>,
  );

const shownCard = () => within(screen.getByTestId('fact-card'));

const termsOf = (): ReadonlyArray<HTMLElement> =>
  Array.from(screen.getByTestId('fact-card').querySelectorAll<HTMLElement>('dt'));

describe('RowModelsCard', () => {
  it('lists the models in the order they ran, each with the reason it ended', () => {
    renderCard({ models: FALLBACK });
    const labels = termsOf();

    expect(labels.map((label) => label.textContent)).toEqual(['Kimi K3 High', 'Sonnet 5.5 High']);
    expect(labels[0]?.nextElementSibling?.textContent).toBe(
      `Stopped, failed at ${formatClock({ at: KIMI_ENDED })}`,
    );
    expect(labels[1]?.nextElementSibling?.textContent).toBe(
      `Finished ${formatClock({ at: SONNET_ENDED })}`,
    );
  });

  it('names the role in the header', () => {
    renderCard({ models: FALLBACK });

    expect(shownCard().getByText('Implementer')).toBeDefined();
  });

  it('tells apart a model that ran twice with the same effort', () => {
    if (SONNET === undefined) {
      throw new Error('no model');
    }
    renderCard({ models: { isPlanned: false, models: [SONNET, SONNET] } });

    expect(termsOf().map((label) => label.textContent)).toEqual([
      'Sonnet 5.5 High',
      'Sonnet 5.5 High (2)',
    ]);
  });

  it('keeps five models and says how many more ran when the card would overflow', () => {
    if (SONNET === undefined) {
      throw new Error('no model');
    }
    const many = [1, 2, 3, 4, 5, 6, 7].map((index) => ({ ...SONNET, name: `Model ${index}` }));
    renderCard({ models: { isPlanned: false, models: many } });

    expect(termsOf()).toHaveLength(5);
    expect(shownCard().getByText('and 2 more')).toBeDefined();
  });

  it('says a model still runs, and that a planned one has not started', () => {
    if (SONNET === undefined) {
      throw new Error('no model');
    }
    renderCard({
      models: { isPlanned: false, models: [{ ...SONNET, endReason: null, endedAtMs: null }] },
    });
    expect(shownCard().getByText('Running')).toBeDefined();
    cleanup();

    renderCard({
      models: { isPlanned: true, models: [{ ...SONNET, endReason: null, endedAtMs: null }] },
    });
    expect(shownCard().getByText('Planned, not started')).toBeDefined();
  });

  it('says a turn that was cancelled or needs the user in plain words', () => {
    if (KIMI === undefined || SONNET === undefined) {
      throw new Error('no models');
    }
    renderCard({
      models: {
        isPlanned: false,
        models: [
          { ...KIMI, endReason: 'cancelled' },
          { ...SONNET, endReason: 'awaiting_user' },
        ],
      },
    });

    expect(shownCard().getByText(`Stopped at ${formatClock({ at: KIMI_ENDED })}`)).toBeDefined();
    expect(
      shownCard().getByText(`Needs you since ${formatClock({ at: SONNET_ENDED })}`),
    ).toBeDefined();
  });
});
