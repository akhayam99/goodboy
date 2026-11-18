// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import type { Session, SessionAttentionReason, SessionStageInfo } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { stageInfoOf } from '../../store/slices/session-view/stageInfoOf';
import { seedBitbucketMarks } from '../../app/components/MockScene/scenes/u23/bitbucketMarksSeed';
import { ATTENTION_REASON_META, attentionWordsOf } from '../../features/session/session-stage';
import { attentionMarkOf } from '../../features/session/attentionMarkOf';
import { needsYouEntries } from '../../features/palette/sources/needsYouEntries';
import { SessionsRow } from '../../features/workspace/components/SessionsPopover/SessionsRow';
import { SwitcherRow } from '../../features/workspace/components/SessionSwitcher/SwitcherRow';
import { SessionHoverCardBody } from '../../features/workspace/components/SessionHoverCard/SessionHoverCardBody';
import { NeedsYouSessionRow } from '../../app/components/AppTopBar/NowChip/NeedsYouSessionRow';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  seedBitbucketMarks();
});

afterEach(cleanup);

const REASONS: ReadonlyArray<SessionAttentionReason> = [
  'ci-failed',
  'changes-requested',
  'pr-approved',
];

type Waiting = {
  readonly session: Session;
  readonly info: SessionStageInfo;
};

const waitingFor = ({ reason }: { readonly reason: SessionAttentionReason }): Waiting => {
  const state = useAppStore.getState();
  for (const session of state.sessions) {
    const info = stageInfoOf(state, session);
    if (info.stage === 'attention' && info.attention === reason) {
      return { session, info };
    }
  }
  throw new Error(`the Bitbucket seed holds no session waiting for ${reason}`);
};

const noop = () => undefined;

const withoutUnseen = (label: string | null): string | null =>
  label === null ? null : label.replace(/, unseen$/, '');

const wordsOf = (container: HTMLElement): string | null =>
  withoutUnseen(container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? null);

const markOf = (container: HTMLElement) => {
  const box = container.querySelector('[data-status-mark]');
  return {
    kind: box?.getAttribute('data-status-mark') ?? null,
    state: box?.getAttribute('data-status-state') ?? null,
    tone: box?.getAttribute('data-status-tone') ?? null,
  };
};

const tableMarkOf = ({ reason }: { readonly reason: SessionAttentionReason }) => {
  const mark = attentionMarkOf({ reason });
  return {
    kind: mark.kind,
    state: mark.kind === 'state' ? mark.state : null,
    tone: mark.kind === 'dot' || mark.kind === 'count' ? mark.tone : null,
  };
};

describe.each(REASONS)('a Bitbucket session says %s the same way on every surface', (reason) => {
  const tone = ATTENTION_REASON_META[reason].tone;
  const mark = tableMarkOf({ reason });

  it('draws the Sessions row with the mark and words of the table', () => {
    const { session, info } = waitingFor({ reason });
    const { container } = render(
      <SessionsRow
        session={session}
        optionId="sessions-row"
        project=""
        isActive={false}
        isPinned={false}
        onOpen={noop}
        onTogglePin={noop}
      />,
    );

    expect(wordsOf(container)).toBe(attentionWordsOf({ reason, counts: info }));
    expect(markOf(container)).toEqual(mark);
  });

  it('draws the switcher row with the same mark', () => {
    const { session } = waitingFor({ reason });
    const { container } = render(
      <SwitcherRow session={session} isSelected={false} onChoose={noop} />,
    );

    expect(markOf(container)).toEqual(mark);
  });

  it('draws the hover card with the same mark and says the words once', () => {
    const { session, info } = waitingFor({ reason });
    const words = attentionWordsOf({ reason, counts: info });
    const { container } = render(<SessionHoverCardBody session={session} isArchived={false} />);

    expect(markOf(container)).toEqual(mark);
    expect(within(container).getAllByText(words)).toHaveLength(1);
  });

  it('draws the Now chip row with the same tone and words', () => {
    const { session, info } = waitingFor({ reason });
    const { container } = render(
      <ul>
        <NeedsYouSessionRow
          session={session}
          onSelect={noop}
          onHoverEnter={noop}
          onHoverLeave={noop}
        />
      </ul>,
    );

    expect(
      container.querySelector('[data-attention-tone]')?.getAttribute('data-attention-tone'),
    ).toBe(tone);
    expect(within(container).getByText(attentionWordsOf({ reason, counts: info }))).toBeDefined();
  });

  it('draws the palette entry with the same mark and words', () => {
    const { session, info } = waitingFor({ reason });
    const [entry] = needsYouEntries({ items: [{ session, info }], open: noop });

    expect(entry?.detail).toBe(attentionWordsOf({ reason, counts: info }));
    expect(entry?.mark).toEqual(attentionMarkOf({ reason }));
  });
});

describe('a Bitbucket approval next to a failed status', () => {
  it('marks the session by the failure and lists the approval beneath the failure in the hover card', () => {
    const state = useAppStore.getState();
    const session = state.sessions.find(
      (candidate) => candidate.goal === 'Ship the refund webhook',
    );
    if (session === undefined) {
      throw new Error('the Bitbucket seed has no session with an approval and a failed status');
    }
    const info = stageInfoOf(state, session);
    const { container } = render(<SessionHoverCardBody session={session} isArchived={false} />);

    expect(info).toMatchObject({ attention: 'ci-failed', otherReasons: ['pr-approved'] });
    expect(markOf(container)).toEqual(tableMarkOf({ reason: 'ci-failed' }));
    expect(
      Array.from(container.querySelectorAll('[data-attention-line]')).map((line) =>
        line.getAttribute('data-attention-line'),
      ),
    ).toEqual(['pr-approved']);
    expect(within(container).getAllByText('Checks failing')).toHaveLength(1);
  });
});
