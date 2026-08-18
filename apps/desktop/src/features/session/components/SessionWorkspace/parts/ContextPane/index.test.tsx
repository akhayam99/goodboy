// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { tintClasses } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';

type StoreSlot = { key: string; value: string; enabled: boolean };

const SUMMARY = [
  '#### Problem',
  'the two regions read as one column.',
  '',
  '#### Learned',
  '- the concept map owns icon and tone.',
  '',
  '#### State',
  '- blocks render separately.',
  '',
  '#### Next',
  '- ship it.',
].join('\n');

const DECISIONS = [
  '- use tailwind',
  '',
  '- keep the refresh token in memory',
  '',
  '- soft delete',
].join('\n');

const { store } = vi.hoisted(() => ({
  store: {
    sessionSlots: {} as Record<string, Array<{ key: string; value: string; enabled: boolean }>>,
    sessionLoading: {
      'session-1': {
        agents: false,
        transcript: false,
        telemetry: false,
        slots: false,
        plans: false,
        summary: false,
      },
    },
    summarizerStatus: {
      'session-1': {
        status: 'idle',
        lastUpdate: null,
        error: null,
        lastUsage: null,
        lastAttempt: null,
      },
    } as Record<string, { status: string }>,
    slotHistory: {} as Record<string, Record<string, ReadonlyArray<unknown>>>,
    sessionOpenQuestions: {} as Record<string, ReadonlyArray<unknown>>,
    upsertSessionSlot: vi.fn(),
    loadSlotHistory: vi.fn().mockResolvedValue(undefined),
    loadSessionOpenQuestions: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
  useSessionSlots: (sessionId: string) => store.sessionSlots[sessionId] ?? [],
  useSessionLoading: () => ({
    agents: false,
    transcript: false,
    telemetry: false,
    slots: false,
    plans: false,
    summary: false,
  }),
  useSummarizerStatus: (sessionId: string) =>
    store.summarizerStatus[sessionId] ?? { status: 'idle' },
  useSlotHistory: () => [],
  useSlotHistoryCount: () => 0,
  useSessionOpenQuestions: () => [],
}));

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    ScrollFade: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Markdown: ({ text }: { text: string }) => <span data-testid="markdown">{text}</span>,
  };
});

import { ContextPane } from './index';

const SESSION = {
  id: 'session-1',
  workspaceId: 'workspace-1',
  workflowRuns: [],
} as unknown as Session;

const slots = (overrides: Partial<Record<string, string>> = {}): StoreSlot[] =>
  [
    { key: 'goal', value: overrides.goal ?? 'ship the feature', enabled: true },
    { key: 'decisions', value: overrides.decisions ?? DECISIONS, enabled: true },
    {
      key: 'last_output_summary',
      value: overrides.last_output_summary ?? SUMMARY,
      enabled: true,
    },
  ] satisfies StoreSlot[];

const writtenValue = (key: string): string => {
  const call = store.upsertSessionSlot.mock.calls.find(
    (candidate) => (candidate as ReadonlyArray<unknown>)[1] === key,
  ) as [string, string, string] | undefined;
  return call?.[2] ?? '';
};

const sectionFor = (name: string): HTMLElement => {
  const section = screen.getByRole('region', { name });
  return section;
};

beforeEach(() => {
  store.sessionSlots['session-1'] = slots();
  store.summarizerStatus['session-1'] = { status: 'idle' };
  store.upsertSessionSlot = vi.fn();
});

afterEach(cleanup);

describe('Context regions', () => {
  it('gives each region the icon and the tone its concept owns in the shared map', () => {
    render(<ContextPane session={SESSION} />);

    const summaryIcon = sectionFor('Session summary').querySelector('svg');
    const decisionsIcon = sectionFor('Decisions').querySelector('svg');

    expect(summaryIcon?.getAttribute('class')).toContain(
      tintClasses(CONCEPT_TONE.sessionSummary).icon,
    );
    expect(decisionsIcon?.getAttribute('class')).toContain(
      tintClasses(CONCEPT_TONE.decisions).icon,
    );
  });

  it('keeps both regions on one page rather than behind a segmented control', () => {
    render(<ContextPane session={SESSION} />);

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Session summary', 'Decisions']);
    expect(screen.queryByRole('tablist')).toBeNull();
  });
});

describe('Session summary blocks', () => {
  it('renders the four sections as separate blocks, headings not in the body', () => {
    render(<ContextPane session={SESSION} />);
    const summary = sectionFor('Session summary');

    for (const title of ['Problem', 'Learned', 'State', 'Next']) {
      expect(within(summary).getByRole('region', { name: title })).toBeDefined();
    }
    expect(summary.textContent).not.toContain('####');
  });

  it('edits one section without touching the other three', () => {
    render(<ContextPane session={SESSION} />);
    const state = within(sectionFor('Session summary')).getByRole('region', { name: 'State' });

    fireEvent.click(within(state).getByRole('button', { name: 'Edit state' }));
    const editor = within(state).getByRole('textbox', { name: 'State body' });
    fireEvent.change(editor, { target: { value: '- blocks render separately, and commit.\n' } });
    fireEvent.blur(editor);

    const written = writtenValue('last_output_summary');
    expect(written).toBe(
      SUMMARY.replace('- blocks render separately.', '- blocks render separately, and commit.'),
    );
    expect(written).toContain('#### Problem\nthe two regions read as one column.');
    expect(written).toContain('#### Next\n- ship it.');
  });

  it('never offers a way to delete a section', () => {
    render(<ContextPane session={SESSION} />);
    const summary = sectionFor('Session summary');

    expect(within(summary).queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('preserves an unknown heading as an extra block instead of dropping it', () => {
    store.sessionSlots['session-1'] = slots({
      last_output_summary: `${SUMMARY}\n\n#### Risks\n- a heading we do not know.`,
    });
    render(<ContextPane session={SESSION} />);
    const summary = sectionFor('Session summary');

    const risks = within(summary).getByRole('region', { name: 'Risks' });
    expect(risks.textContent).toContain('a heading we do not know.');
  });

  it('preserves prose written before the first heading', () => {
    store.sessionSlots['session-1'] = slots({
      last_output_summary: `**pending:** user confirms the scope.\n\n${SUMMARY}`,
    });
    render(<ContextPane session={SESSION} />);
    const notes = within(sectionFor('Session summary')).getByRole('region', { name: 'Notes' });

    expect(notes.textContent).toContain('**pending:** user confirms the scope.');
  });

  it('shows a legacy summary with no headings as one preserved block', () => {
    const legacy = '**root cause:** a fall-through render.\n\n**tests:** none yet';
    store.sessionSlots['session-1'] = slots({ last_output_summary: legacy });
    render(<ContextPane session={SESSION} />);
    const summary = sectionFor('Session summary');

    expect(within(summary).getByRole('region', { name: 'Notes' }).textContent).toContain(
      'a fall-through render.',
    );
    expect(within(summary).queryByRole('region', { name: 'State' })).toBeNull();
  });

  it('keeps a raw edit of the whole document reachable', () => {
    render(<ContextPane session={SESSION} />);
    const summary = sectionFor('Session summary');

    fireEvent.click(within(summary).getByRole('button', { name: 'Edit source' }));
    const editor = within(summary).getByRole('textbox', { name: 'Session summary source' });

    expect((editor as HTMLTextAreaElement).value).toBe(SUMMARY);
  });

  it('materialises a missing section only once the user writes into it', () => {
    store.sessionSlots['session-1'] = slots({
      last_output_summary: '#### Problem\nsomething broke.',
    });
    render(<ContextPane session={SESSION} />);
    const next = within(sectionFor('Session summary')).getByRole('region', { name: 'Next' });

    expect(next.textContent).toContain('Nothing here yet');
    expect(store.upsertSessionSlot).not.toHaveBeenCalled();

    fireEvent.click(within(next).getByRole('button', { name: 'Add next' }));
    const editor = within(next).getByRole('textbox', { name: 'Next body' });
    fireEvent.change(editor, { target: { value: '- fix it.' } });
    fireEvent.blur(editor);

    expect(writtenValue('last_output_summary')).toBe(
      '#### Problem\nsomething broke.\n\n#### Next\n- fix it.',
    );
  });
});

describe('Decisions rows', () => {
  it('renders one row per decision with no bullet glyph drawn', () => {
    render(<ContextPane session={SESSION} />);
    const decisions = sectionFor('Decisions');

    const rows = within(decisions).getAllByRole('button', { name: /^Edit decision \d+$/ });
    expect(rows.map((row) => row.textContent)).toEqual([
      'use tailwind',
      'keep the refresh token in memory',
      'soft delete',
    ]);
    expect(decisions.querySelector('li')).toBeNull();
    expect(decisions.querySelector('[class*="list-disc"]')).toBeNull();
  });

  it('edits the clicked row in place and leaves the rest byte identical', () => {
    render(<ContextPane session={SESSION} />);
    const decisions = sectionFor('Decisions');

    fireEvent.click(within(decisions).getByRole('button', { name: 'Edit decision 2' }));
    const editor = within(decisions).getByRole('textbox', { name: 'Edit decision 2' });
    expect((editor as HTMLTextAreaElement).value).toBe('keep the refresh token in memory');

    fireEvent.change(editor, { target: { value: 'keep the refresh token in memory only' } });
    fireEvent.blur(editor);

    expect(writtenValue('decisions')).toBe(
      DECISIONS.replace(
        'keep the refresh token in memory',
        'keep the refresh token in memory only',
      ),
    );
  });

  it('puts the delete control on its own row behind a confirmation attached to it', () => {
    render(<ContextPane session={SESSION} />);
    const decisions = sectionFor('Decisions');

    const trigger = within(decisions).getByRole('button', { name: 'Delete decision 2' });
    expect(within(decisions).queryByRole('group', { name: 'Delete this decision?' })).toBeNull();

    fireEvent.click(trigger);
    const confirm = within(decisions).getByRole('group', { name: 'Delete this decision?' });
    expect(trigger.closest('div')?.parentElement?.parentElement).toBe(confirm.parentElement);

    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete decision' }));
    expect(writtenValue('decisions')).toBe('- use tailwind\n\n- soft delete');
  });

  it('offers the add row last, and quietly', () => {
    render(<ContextPane session={SESSION} />);
    const decisions = sectionFor('Decisions');

    const buttons = within(decisions).getAllByRole('button');
    const addRow = within(decisions).getByRole('button', { name: 'Add decision' });
    const lastEdit = buttons.filter((button) => /^Edit decision \d+$/.test(button.ariaLabel ?? ''));

    expect(buttons.indexOf(addRow)).toBeGreaterThan(
      buttons.indexOf(lastEdit[lastEdit.length - 1] as HTMLElement),
    );
    expect(addRow.className).toContain('border-dashed');
    expect(addRow.className).toContain('text-muted-foreground');
    expect(addRow.className).not.toContain('bg-primary');
  });

  it('appends a new decision after the last one', () => {
    render(<ContextPane session={SESSION} />);
    const decisions = sectionFor('Decisions');

    fireEvent.click(within(decisions).getByRole('button', { name: 'Add decision' }));
    const editor = within(decisions).getByRole('textbox', { name: 'New decision' });
    fireEvent.change(editor, { target: { value: 'ship the pane' } });
    fireEvent.blur(editor);

    expect(writtenValue('decisions')).toBe(`${DECISIONS}\n\n- ship the pane`);
  });

  it('keeps a multi-line decision inside a single row', () => {
    store.sessionSlots['session-1'] = slots({
      decisions: '- one thread per comment\n  - the id is injected\n\n- the lens order changed',
    });
    render(<ContextPane session={SESSION} />);
    const decisions = sectionFor('Decisions');

    const rows = within(decisions).getAllByRole('button', { name: /^Edit decision \d+$/ });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toBe('one thread per comment\n  - the id is injected');
  });

  it('leaves rows and the add row alone while the summarizer is writing', () => {
    store.summarizerStatus['session-1'] = { status: 'running' };
    render(<ContextPane session={SESSION} />);
    const decisions = sectionFor('Decisions');

    expect(
      (within(decisions).getByRole('button', { name: 'Add decision' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (within(decisions).getByRole('button', { name: 'Edit decision 1' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
