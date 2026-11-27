// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { tintClasses } from '@goodboy/ui';
import { brandId, type AgentId, type SessionId } from '@goodboy/types';
import { agentPlace } from '../../../../../store/slices/navigation/place';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../../../store/storyHarness';
import type { NowModel, NowRow } from '../../../central/now/nowRowsOf';
import { STAGE_TONE } from '../../../session-stage';

let NowSection: typeof import('.').NowSection;
let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
  ({ NowSection } = await import('.'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const SESSION_ID = brandId<SessionId>({ value: 'session-hbl-412' });

type RowParams = {
  readonly agentId: string;
  readonly who: string;
  readonly depth?: 0 | 1;
};

const rowOfAgent = ({ agentId, who, depth = 0 }: RowParams): NowRow => ({
  agentId,
  depth,
  who,
  place: 'payments-api',
  phrase: 'Running pnpm test retry',
  startedAt: null,
});

const ROWS = [
  rowOfAgent({ agentId: 'lead', who: 'Lead' }),
  rowOfAgent({ agentId: 'impl', who: 'Implementer', depth: 1 }),
  rowOfAgent({ agentId: 'test', who: 'Tester', depth: 1 }),
  rowOfAgent({ agentId: 'review', who: 'Reviewer', depth: 1 }),
];

const MODEL: NowModel = {
  rows: ROWS,
  shown: ROWS.slice(0, 3),
  moreCount: 1,
  waits: [
    {
      id: 'writer:test',
      text: 'Tester waits on src/retry/state.ts, held by the Implementer',
      isHot: true,
      since: null,
    },
  ],
};

describe('Now on the Overview', () => {
  it('shows three agent rows with the children under the Lead, then N more', () => {
    render(<NowSection sessionId={SESSION_ID} model={MODEL} />);

    expect(screen.getAllByTestId(/^now-row-/)).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '1 more' }));
    expect(screen.getAllByTestId(/^now-row-/)).toHaveLength(4);
    screen.getByRole('button', { name: 'Show fewer' });
  });

  it('marks live rows with the running tone and a file wait with the attention tone', () => {
    render(<NowSection sessionId={SESSION_ID} model={MODEL} />);

    const row = screen.getByTestId('now-row-lead');
    expect(row.innerHTML).toContain(tintClasses(STAGE_TONE.running).dot);
    expect(row.innerHTML).not.toContain('bg-primary');
    const wait = document.querySelector('[data-now-wait="hot"]');
    expect(wait?.textContent).toContain('Tester waits on src/retry/state.ts');
    expect(wait?.innerHTML).toContain(tintClasses(STAGE_TONE.attention).dot);
  });

  it('opens the agent page of a row', () => {
    const navigate = vi.fn();
    store.setState({ navigate });
    render(<NowSection sessionId={SESSION_ID} model={MODEL} />);

    fireEvent.click(screen.getByTestId('now-row-impl'));

    expect(navigate).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: SESSION_ID, agentId: brandId<AgentId>({ value: 'impl' }) }),
    });
  });

  it('draws nothing when nothing runs', () => {
    const { container } = render(
      <NowSection
        sessionId={SESSION_ID}
        model={{ rows: [], shown: [], moreCount: 0, waits: [] }}
      />,
    );
    expect(container.querySelector('[data-overview-section="now"]')).toBeNull();
  });
});
