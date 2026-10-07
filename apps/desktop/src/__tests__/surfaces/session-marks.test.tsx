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

const fixture = vi.hoisted(() => ({ info: null as SessionStageInfo | null }));

vi.mock('../../store/slices/session-view/stageInfoOf', () => ({
  stageInfoOf: () =>
    fixture.info ?? {
      stage: 'building',
      reason: '',
      addsFact: false,
      attention: null,
      prState: null,
    },
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import { tintClasses } from '@goodboy/ui';
import type { SessionAttentionReason, SessionStageInfo } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { seedColumn, sessionOf } from '../../features/workspace/testing/sessionColumn';
import { ATTENTION_REASON_META, attentionWordsOf } from '../../features/session/session-stage';
import { sessionTone } from '../../features/session/components/sessionCardShell';
import { needsYouEntries } from '../../features/palette/sources/needsYouEntries';
import { SessionActivityItem } from '../../features/workspace/components/SessionActivityBar/SessionActivityItem';
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
});

afterEach(() => {
  cleanup();
  fixture.info = null;
});

const REASONS = Object.keys(ATTENTION_REASON_META) as ReadonlyArray<SessionAttentionReason>;

const COUNTS = { openQuestionCount: 2, fixNeedsYouCount: 3, fixCouldntFixCount: 2 };

const infoFor = ({ reason }: { readonly reason: SessionAttentionReason }): SessionStageInfo => ({
  stage: 'attention',
  reason: 'a reason string the surfaces must not show',
  addsFact: true,
  attention: reason,
  prState: null,
  isRunning: false,
  otherReasons: [],
  ...COUNTS,
});

const session = sessionOf({ goal: 'Retry failed webhook deliveries' });

const noop = () => undefined;

const seed = () => {
  seedColumn({ store: useAppStore, sessions: [session] });
};

const withoutUnseen = (label: string | null): string | null =>
  label === null ? null : label.replace(/, unseen$/, '');

const nodeOf = (container: HTMLElement) => ({
  tone: container.querySelector('[data-node-tone]')?.getAttribute('data-node-tone') ?? null,
  words: withoutUnseen(container.querySelector('[role="img"]')?.getAttribute('aria-label') ?? null),
});

describe.each(REASONS)('every surface says %s the same way', (reason) => {
  const tone = ATTENTION_REASON_META[reason].tone;
  const words = attentionWordsOf({ reason, counts: COUNTS });

  beforeEach(() => {
    seed();
    fixture.info = infoFor({ reason });
  });

  it('draws the sidebar row with the tone and words of the table', () => {
    const { container } = render(
      <SessionActivityItem
        session={session}
        isActive={false}
        getSelectedIds={() => []}
        onClearSelection={noop}
        onModifierClick={noop}
        onToggleSelect={noop}
        onSelect={noop}
        onRowEnter={noop}
        onRowLeave={noop}
        onPagesToggle={noop}
      />,
    );

    expect(nodeOf(container)).toEqual({ tone, words });
    expect(container.querySelector('.sr-only')?.textContent).toContain(
      words.charAt(0).toLowerCase() + words.slice(1),
    );
  });

  it('draws the switcher row with the same node', () => {
    const { container } = render(
      <SwitcherRow session={session} isSelected={false} onChoose={noop} />,
    );

    expect(nodeOf(container)).toEqual({ tone, words });
  });

  it('draws the hover card with the same node and says the words once', () => {
    const { container } = render(
      <SessionHoverCardBody session={session} isArchived={false} onOpenAttention={noop} />,
    );

    expect(nodeOf(container)).toEqual({ tone, words });
    expect(within(container).getAllByText(words)).toHaveLength(1);
  });

  it('tones the Board card with the same tone', () => {
    expect(sessionTone({ stage: 'attention', attention: reason }).tone).toBe(tone);
  });

  it('draws the Now chip row with the same tone and words', () => {
    const { container } = render(
      <ul>
        <NeedsYouSessionRow session={session} onSelect={noop} />
      </ul>,
    );

    expect(
      container.querySelector('[data-attention-tone]')?.getAttribute('data-attention-tone'),
    ).toBe(tone);
    expect(within(container).getByText(words)).toBeDefined();
  });

  it('draws the palette entry with the same tone and words', () => {
    const [entry] = needsYouEntries({
      items: [{ session, info: infoFor({ reason }) }],
      open: noop,
    });

    expect(entry?.detail).toBe(words);
    expect(entry?.accent).toBe(tintClasses(tone).dot);
  });
});
