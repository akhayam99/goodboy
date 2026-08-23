// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PANE_RHYTHM } from '@goodboy/ui';
import type { Session } from '@goodboy/types';

const writeText = vi.fn(async () => undefined);

type StoreSlot = { key: string; value: string; enabled: boolean };
type LoadingFlags = {
  agents: boolean;
  transcript: boolean;
  telemetry: boolean;
  slots: boolean;
  plans: boolean;
  summary: boolean;
};
type SummarizerStatus = {
  status: string;
  lastUpdate: null;
  error: null;
  lastUsage: null;
  lastAttempt: null;
};
type HistoryEntry = { id: string; key: string; value: string; author: string; createdAt: string };
type OpenQuestion = {
  id: string;
  sessionId: string;
  text: string;
  status: string;
  userAnswer: string | null;
  suggestedAnswers: string[];
  createdAt: string;
};

const { store } = vi.hoisted(() => {
  return {
    store: {
      sessionProjectMounts: {} as Record<
        string,
        ReadonlyArray<{
          projectId: string;
          mountName: string;
          worktreePath: string;
          repoRoot: string;
          branch: string;
        }>
      >,
      projects: [] as ReadonlyArray<{ id: string; kind: 'repo' | 'folder' }>,
      sessionActiveProject: {} as Record<string, string>,
      workspaces: [] as ReadonlyArray<{ id: string; profile?: { bio: string | null } }>,
      sessionSlots: {
        'session-1': [
          { key: 'goal', value: 'ship the feature', enabled: true },
          { key: 'decisions', value: 'use tailwind', enabled: true },
          { key: 'last_output_summary', value: '**Status**: done', enabled: true },
        ],
      } as Record<string, StoreSlot[]>,
      sessionLoading: {
        'session-1': {
          agents: false,
          transcript: false,
          telemetry: false,
          slots: false,
          plans: false,
          summary: false,
        },
      } as Record<string, LoadingFlags>,
      summarizerStatus: {
        'session-1': {
          status: 'idle',
          lastUpdate: null,
          error: null,
          lastUsage: null,
          lastAttempt: null,
        },
      } as Record<string, SummarizerStatus>,
      slotHistory: {
        'session-1': {
          goal: [
            {
              id: 'h1',
              key: 'goal',
              value: 'old goal text',
              author: 'user',
              createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
            },
            {
              id: 'h2',
              key: 'goal',
              value: 'agent wrote this',
              author: 'summarizer',
              createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
            },
          ],
          last_output_summary: [
            {
              id: 'sh1',
              key: 'last_output_summary',
              value: 'previous summary',
              author: 'summarizer',
              createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
            },
          ],
        },
      } as Record<string, Record<string, HistoryEntry[]>>,
      sessionOpenQuestions: {
        'session-1': [
          {
            id: 'q1',
            sessionId: 'session-1',
            text: 'what is the deadline?',
            status: 'open',
            userAnswer: null,
            suggestedAnswers: [],
            createdAt: new Date().toISOString(),
          },
          {
            id: 'q2',
            sessionId: 'session-1',
            text: 'already answered',
            status: 'answered',
            userAnswer: 'yes',
            suggestedAnswers: [],
            createdAt: new Date().toISOString(),
          },
        ],
      } as Record<string, OpenQuestion[]>,
      sessionSlotsLoad: {} as Record<string, 'loaded' | 'failed' | undefined>,
      upsertSessionSlot: vi.fn(),
      loadSlotHistory: vi.fn().mockResolvedValue(undefined),
      loadSessionOpenQuestions: vi.fn().mockResolvedValue(undefined),
      ensureSessionSlots: vi.fn().mockResolvedValue(undefined),
      loadSessionSlots: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useSessionSlots: (sessionId: string) => store.sessionSlots[sessionId] ?? [],
  useSessionSlotsLoad: (sessionId: string) => store.sessionSlotsLoad[sessionId] ?? null,
  useSessionLoading: (sessionId: string) =>
    store.sessionLoading[sessionId] ?? {
      agents: false,
      transcript: false,
      telemetry: false,
      slots: false,
      plans: false,
      summary: false,
    },
  useSummarizerStatus: (sessionId: string) =>
    store.summarizerStatus[sessionId] ?? {
      status: 'idle',
      lastUpdate: null,
      error: null,
      lastUsage: null,
      lastAttempt: null,
    },
  useSlotHistory: (sessionId: string, key: string) => store.slotHistory[sessionId]?.[key] ?? [],
  useSlotHistoryCount: (sessionId: string, key: string) =>
    store.slotHistory[sessionId]?.[key]?.length ?? 0,
  useSessionOpenQuestions: (sessionId: string) => store.sessionOpenQuestions[sessionId] ?? [],
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    ScrollFade: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Markdown: ({ text }: { text: string }) => <span data-testid="markdown">{text}</span>,
  };
});

vi.mock('../../../../context/components/ContextPanel/strips/GoalAttachmentsStrip', () => ({
  GoalAttachmentsStrip: () => null,
}));

import { SlotPane } from './SlotPane';
import { ContextPane } from './ContextPane';

const SESSION = {
  id: 'session-1',
  workspaceId: 'workspace-1',
  workflowRuns: [],
} as unknown as Session;

beforeEach(() => {
  store.sessionSlots['session-1'] = [
    { key: 'goal', value: 'ship the feature', enabled: true },
    { key: 'decisions', value: 'use tailwind', enabled: true },
    { key: 'last_output_summary', value: '**Status**: done', enabled: true },
  ];
  store.sessionSlotsLoad['session-1'] = 'loaded';
  store.upsertSessionSlot = vi.fn();
  store.loadSlotHistory = vi.fn().mockResolvedValue(undefined);
  store.loadSessionOpenQuestions = vi.fn().mockResolvedValue(undefined);
  store.ensureSessionSlots = vi.fn().mockResolvedValue(undefined);
  store.loadSessionSlots = vi.fn().mockResolvedValue(undefined);
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});

afterEach(cleanup);

describe('ContextPane', () => {
  it('matches the shared pane measure', () => {
    render(<ContextPane session={SESSION} />);

    expect(
      screen
        .getByRole('heading', { level: 1, name: 'Context' })
        .closest(`.${PANE_RHYTHM.measure.pane}`),
    ).not.toBeNull();
  });

  it('renders session summary and decisions as two ordered regions', () => {
    render(<ContextPane session={SESSION} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Context' })).toBeDefined();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Working set', 'Session summary', 'Decisions']);
  });

  it('offers the way into each empty region rather than a placeholder', () => {
    store.sessionSlots['session-1'] = [];
    render(<ContextPane session={SESSION} />);

    expect(screen.getByRole('button', { name: 'Add decision' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add problem' })).toBeDefined();
    expect(screen.queryByText('No decisions yet')).toBeNull();
    expect(screen.queryByText('No session summary yet')).toBeNull();
  });

  it('does not pull slot history on mount, only the counts already in the store', () => {
    render(<ContextPane session={SESSION} />);

    expect(store.loadSlotHistory).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /previous version.*Session summary/ })).toBeDefined();
  });

  it('opens the corresponding history inside the shared surface', () => {
    render(<ContextPane session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: /previous version.*Session summary/ }));

    expect(store.loadSlotHistory).toHaveBeenCalledWith('session-1', 'last_output_summary');
    expect(screen.getByText('History: Session summary')).toBeDefined();
  });
});

describe('SlotPane', () => {
  it.each([
    ['goal', 'Add the session goal'],
    ['decisions', 'Log a decision'],
    ['last_output_summary', 'Write a session summary'],
  ] as const)('explains how an empty %s is populated', (slotKey, title) => {
    store.sessionSlots['session-1'] = [];

    render(<SlotPane session={SESSION} slotKey={slotKey} />);

    expect(screen.getByText(title)).toBeDefined();
    expect(
      screen.getByText(
        'The summarizer fills this at the end of a turn. Create an agent or a workflow to begin.',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/manual/i)).toBeNull();
  });

  describe('history panel', () => {
    it('opens history panel (not a dialog) when history button clicked', () => {
      render(<SlotPane session={SESSION} slotKey="goal" />);

      expect(screen.queryByRole('dialog')).toBeNull();

      const historyBtn = screen.getByRole('button', { name: /view history for goal/i });
      fireEvent.click(historyBtn);

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText('History: Goal')).toBeDefined();
    });

    it('lists history entries with author labels and relative timestamps', () => {
      render(<SlotPane session={SESSION} slotKey="goal" />);

      fireEvent.click(screen.getByRole('button', { name: /view history for goal/i }));

      expect(screen.getByText('you')).toBeDefined();
      expect(screen.getByText('agent')).toBeDefined();
      expect(screen.getByText('5m ago')).toBeDefined();
      expect(screen.getByText('1h ago')).toBeDefined();
    });

    it('closes history panel when close button clicked', () => {
      render(<SlotPane session={SESSION} slotKey="goal" />);

      fireEvent.click(screen.getByRole('button', { name: /view history for goal/i }));
      expect(screen.getByText('History: Goal')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: /close history panel/i }));
      expect(screen.queryByText('History: Goal')).toBeNull();
    });

    it('calls loadSlotHistory on open', () => {
      render(<SlotPane session={SESSION} slotKey="goal" />);

      fireEvent.click(screen.getByRole('button', { name: /view history for goal/i }));

      expect(store.loadSlotHistory).toHaveBeenCalledWith('session-1', 'goal');
    });
  });

  describe('restore', () => {
    it('calls upsertSessionSlot and closes panel on restore', () => {
      render(<SlotPane session={SESSION} slotKey="goal" />);

      fireEvent.click(screen.getByRole('button', { name: /view history for goal/i }));

      const restoreButtons = screen.getAllByRole('button', { name: /^restore this version$/i });
      const first = restoreButtons[0];
      if (first != null) {
        fireEvent.click(first);
      }

      expect(store.upsertSessionSlot).toHaveBeenCalledWith('session-1', 'goal', 'old goal text');
      expect(screen.queryByText('History: Goal')).toBeNull();
    });
  });

  describe('copy button', () => {
    it('copies slot value to clipboard for non-summary panes', async () => {
      render(<SlotPane session={SESSION} slotKey="goal" />);

      const copyBtn = screen.getByRole('button', { name: /^copy$/i });
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith('ship the feature');
      });
    });

    it('copies per-entry value from history entry copy button', async () => {
      render(<SlotPane session={SESSION} slotKey="goal" />);

      fireEvent.click(screen.getByRole('button', { name: /view history for goal/i }));

      const entryButtons = screen.getAllByRole('button', { name: /copy this version/i });
      const first = entryButtons[0];
      if (first != null) {
        fireEvent.click(first);
      }

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith('old goal text');
      });
    });

    it('composes shareable document for last_output_summary including goal, summary, decisions, open questions', async () => {
      render(<SlotPane session={SESSION} slotKey="last_output_summary" />);

      const copyBtn = screen.getByRole('button', { name: /copy shareable summary/i });
      fireEvent.click(copyBtn);

      await waitFor(() => {
        expect(writeText).toHaveBeenCalled();
      });

      const written = (writeText.mock.calls as unknown as [string[]][])[0]?.[0] ?? '';
      expect(written).toContain('## Goal');
      expect(written).toContain('ship the feature');
      expect(written).toContain('## Session summary');
      expect(written).toContain('**Status**: done');
      expect(written).toContain('## Decisions');
      expect(written).toContain('use tailwind');
      expect(written).toContain('## Open questions');
      expect(written).toContain('what is the deadline?');
      expect(written).not.toContain('already answered');
    });

    it('loads open questions for the summary pane so the shareable document is complete', () => {
      render(<SlotPane session={SESSION} slotKey="last_output_summary" />);

      expect(store.loadSessionOpenQuestions).toHaveBeenCalledWith('session-1');
    });

    it('does not load open questions for non-summary panes', () => {
      render(<SlotPane session={SESSION} slotKey="goal" />);

      expect(store.loadSessionOpenQuestions).not.toHaveBeenCalled();
    });
  });

  describe('expand/collapse entry', () => {
    it('expands entry on click and collapses on second click', () => {
      render(<SlotPane session={SESSION} slotKey="goal" />);

      fireEvent.click(screen.getByRole('button', { name: /view history for goal/i }));

      const expandButtons = screen.getAllByRole('button', { name: /expand entry/i });
      expect(expandButtons.length).toBeGreaterThan(0);
      const first = expandButtons[0];
      if (first != null) {
        fireEvent.click(first);
      }

      expect(screen.getByRole('button', { name: /collapse entry/i })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: /collapse entry/i }));
      expect(screen.getAllByRole('button', { name: /expand entry/i }).length).toBeGreaterThan(0);
    });

    it('collapses the expanded entry when another entry is expanded', () => {
      render(<SlotPane session={SESSION} slotKey="goal" />);

      fireEvent.click(screen.getByRole('button', { name: /view history for goal/i }));

      const expandButtons = screen.getAllByRole('button', { name: /expand entry/i });
      expect(expandButtons.length).toBe(2);
      const [first, second] = expandButtons;
      if (first != null && second != null) {
        fireEvent.click(first);
        expect(screen.getAllByRole('button', { name: /collapse entry/i }).length).toBe(1);
        fireEvent.click(second);
      }

      expect(screen.getAllByRole('button', { name: /collapse entry/i }).length).toBe(1);
      expect(screen.getAllByRole('button', { name: /expand entry/i }).length).toBe(1);
    });
  });

  describe('history toggle', () => {
    it('closes the panel when the history button is clicked again', () => {
      render(<SlotPane session={SESSION} slotKey="goal" />);

      const historyBtn = screen.getByRole('button', { name: /view history for goal/i });
      fireEvent.click(historyBtn);
      expect(screen.getByText('History: Goal')).toBeDefined();

      fireEvent.click(historyBtn);
      expect(screen.queryByText('History: Goal')).toBeNull();
    });
  });
});
