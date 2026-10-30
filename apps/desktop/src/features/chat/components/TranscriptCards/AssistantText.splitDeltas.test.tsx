// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { parseAutoBlock, parseOutcomeLine, parseStreamJsonLine } from '@goodboy/core';
import type { ProviderRunId, TurnEvent } from '@goodboy/types';
import { TEST_NOW, nextProviderRunId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  importStore,
  openStorySqlite,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { flushTurnEvents } from '../../../../store/slices/transcripts/buffer';
import { seedStoredTurns, type SeededTurns } from '../../../../test/seedStoredTurns';
import { reduceTranscript } from '../../utils/transcript-items';
import { AssistantText } from './AssistantText';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../turn', async () =>
  (await import('../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../providers/providers', async () =>
  (await import('../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../providers/routing', async () =>
  (await import('../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../budget/budget', async () =>
  (await import('../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../skills/skills', async () =>
  (await import('../../../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../../../workflows/workflows', async () =>
  (await import('../../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../worktree/worktree', async () =>
  (await import('../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../../plans/plans', async () =>
  (await import('../../../../store/storyHarness')).plansModuleMock(),
);
vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  CopyButton: () => <button type="button">copy</button>,
  Markdown: ({ text }: { text: string }) => <div data-testid="markdown">{text}</div>,
}));
vi.mock('../HandoffChip', () => ({ HandoffChip: () => null }));
vi.mock('../PlanChip', () => ({ PlanChip: () => null }));
vi.mock('../ResolverThreadsCard', () => ({
  ResolverThreadsCard: () => null,
}));
vi.mock('../ScribeTextCard', () => ({ ScribeTextCard: () => null }));

const AT = TEST_NOW;
const STATUS = { type: 'system', subtype: 'status', status: 'requesting' };
const HOOK = { type: 'system', subtype: 'hook_response', hook_name: 'SessionStart' };

const streamLine = (text: string) => ({
  type: 'stream_event',
  event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  parent_tool_use_id: null,
});

const BLOCK_START = {
  type: 'stream_event',
  event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  parent_tool_use_id: null,
};
const MESSAGE_START = {
  type: 'stream_event',
  event: { type: 'message_start', message: { id: 'msg_1' } },
  parent_tool_use_id: null,
};
const BLOCK_STOP = {
  type: 'stream_event',
  event: { type: 'content_block_stop', index: 0 },
  parent_tool_use_id: null,
};

type PiecesParams = {
  readonly pieces: ReadonlyArray<string>;
};

const providerLines = ({ pieces }: PiecesParams): ReadonlyArray<unknown> => {
  const lines: unknown[] = [MESSAGE_START, BLOCK_START];
  pieces.forEach((piece, index) => {
    lines.push(streamLine(piece));
    lines.push(index % 2 === 0 ? STATUS : HOOK);
  });
  lines.push(BLOCK_STOP);
  lines.push({
    type: 'assistant',
    message: { id: 'msg_1', content: [{ type: 'text', text: pieces.join('') }] },
  });
  lines.push({ type: 'result', subtype: 'success', usage: {} });
  return lines;
};

type StreamParams = {
  readonly pieces: ReadonlyArray<string>;
  readonly runId: ProviderRunId;
};

const eventsOf = ({ pieces, runId }: StreamParams): ReadonlyArray<TurnEvent> => {
  const ctx = { runId, now: () => AT };
  return providerLines({ pieces }).flatMap((line) =>
    parseStreamJsonLine(JSON.stringify(line), ctx),
  );
};

let useAppStore: StoryStore;
let seeded: SeededTurns;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  seeded = await seedStoredTurns({ rowCount: 0 });
  useAppStore.setState({
    sessions: [
      buildStorySession({
        id: seeded.sessionId,
        workspaceId: seeded.workspaceId,
        goal: 'Look into the ledger export',
      }),
    ],
    sessionPhaseRuns: {
      [seeded.sessionId]: [
        {
          id: seeded.agentId,
          sessionId: seeded.sessionId,
          ordinal: 1,
          name: 'Agent 1',
          status: 'running',
        },
      ],
    },
    selectedAgentId: {},
    transcripts: {},
  });
});

afterEach(() => {
  cleanup();
});

const streamLive = ({ pieces }: PiecesParams): ReadonlyArray<TurnEvent> => {
  const events = eventsOf({ pieces, runId: nextProviderRunId() });
  for (const event of events) {
    useAppStore.getState().appendTurnEvent(seeded.agentId, seeded.sessionId, event);
  }
  flushTurnEvents();
  return events;
};

const textOfAgent = (): string =>
  reduceTranscript(useAppStore.getState().transcripts[seeded.agentId] ?? [])
    .flatMap((item) => (item.kind === 'assistant_text' ? [item.text] : []))
    .join('');

const reopenFromStore = async (): Promise<void> => {
  await vi.waitFor(async () => {
    useAppStore.setState({ transcripts: {}, selectedAgentId: {} });
    await useAppStore.getState().selectAgent(seeded.sessionId, seeded.agentId);
    const kinds = (useAppStore.getState().transcripts[seeded.agentId] ?? []).map(
      (event) => event.kind,
    );
    expect(kinds).toContain('done');
  });
};

const WORD = ['questa volta senza com', 'andi shell.'];
const WORD_TEXT = 'questa volta senza comandi shell.';

const BLOCK_JSON =
  '{"action":"delegate","requestId":"r4","children":[{"role":"planner","task":"Plan the ledger-core export.","reason":"A plan before the change."}]}';
const MARKER_TEXT = `Handing the plan over.\n\n<<auto>>${BLOCK_JSON}<</auto>>`;

type SplitParams = {
  readonly at: number;
};

const splitAt = ({ at }: SplitParams): ReadonlyArray<string> => [
  MARKER_TEXT.slice(0, at),
  MARKER_TEXT.slice(at),
];

const OPEN_AT = MARKER_TEXT.indexOf('<<auto>>');

describe('a word split across streamed deltas', () => {
  it('stays one word live and when the agent is opened again from the stored events', async () => {
    streamLive({ pieces: WORD });

    expect(textOfAgent()).toBe(WORD_TEXT);
    render(<AssistantText text={textOfAgent()} sessionId={null} />);
    screen.getByText(WORD_TEXT);
    cleanup();

    await reopenFromStore();

    expect(textOfAgent()).toBe(WORD_TEXT);
    render(<AssistantText text={textOfAgent()} sessionId={null} />);
    screen.getByText(WORD_TEXT);
  });

  it('never opens a paragraph in the middle of the word', async () => {
    streamLive({ pieces: WORD });

    const deltas = (useAppStore.getState().transcripts[seeded.agentId] ?? []).flatMap((event) =>
      event.kind === 'assistant_text' ? [event.delta] : [],
    );
    expect(deltas.join('')).not.toContain('\n');
    expect(deltas.join('')).toBe(WORD_TEXT);
  });
});

describe('an Auto marker split across streamed deltas', () => {
  const CASES: ReadonlyArray<readonly [string, number]> = [
    ['inside the opening tag', OPEN_AT + 4],
    ['right after the first angle bracket', OPEN_AT + 1],
    ['inside the action field', MARKER_TEXT.indexOf('"delegate"') + 4],
    ['inside a child of the JSON', MARKER_TEXT.indexOf('"planner"') + 3],
    ['inside the closing tag', MARKER_TEXT.indexOf('<</auto>>') + 4],
  ];

  it.each(CASES)('is read and hidden %s, live and from the stored events', async (_name, at) => {
    streamLive({ pieces: splitAt({ at }) });

    const check = () => {
      const text = textOfAgent();
      expect(text).toBe(MARKER_TEXT);
      expect(parseAutoBlock({ text })).toMatchObject({
        kind: 'block',
        block: { action: 'delegate', requestId: 'r4' },
      });
      cleanup();
      render(<AssistantText text={text} sessionId={null} />);
      screen.getByText('Handing the plan over.');
      expect(screen.queryByText(/auto>>/)).toBeNull();
      expect(screen.queryByText(/delegate/)).toBeNull();
      expect(screen.queryByText(/requestId/)).toBeNull();
      expect(document.body.textContent).not.toContain('<<');
    };
    check();

    await reopenFromStore();
    check();
  });

  it('hides the opening tag while only its first half has arrived', () => {
    const live = MARKER_TEXT.slice(0, OPEN_AT + 4);
    render(<AssistantText text={live} sessionId={null} />);

    screen.getByText('Handing the plan over.');
    expect(document.body.textContent).not.toContain('<<');
  });

  it('reads an outcome line split inside its tag', async () => {
    const full = '<<outcome>>Changes needed: 1 blocker.<</outcome>>\n\nThe export drifts.';
    streamLive({ pieces: [full.slice(0, 6), full.slice(6)] });

    expect(parseOutcomeLine({ text: textOfAgent() })).toBe('Changes needed: 1 blocker.');
    await reopenFromStore();
    expect(parseOutcomeLine({ text: textOfAgent() })).toBe('Changes needed: 1 blocker.');
  });
});
