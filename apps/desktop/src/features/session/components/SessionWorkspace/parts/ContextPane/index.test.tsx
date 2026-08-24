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
    } as Record<string, Record<string, boolean>>,
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
    sessionSlotsLoad: {} as Record<string, 'loaded' | 'failed' | undefined>,
    sessionOpenQuestions: {} as Record<string, ReadonlyArray<unknown>>,
    upsertSessionSlot: vi.fn(),
    loadSlotHistory: vi.fn().mockResolvedValue(undefined),
    loadSessionOpenQuestions: vi.fn().mockResolvedValue(undefined),
    ensureSessionSlots: vi.fn().mockResolvedValue(undefined),
    loadSessionSlots: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../../../../store', () => ({
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
    Markdown: ({ text, className }: { text: string; className?: string }) => (
      <span data-testid="markdown" className={className}>
        {text}
      </span>
    ),
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
  store.sessionSlotsLoad['session-1'] = 'loaded';
  store.sessionLoading['session-1'] = {
    agents: false,
    transcript: false,
    telemetry: false,
    slots: false,
    plans: false,
    summary: false,
  };
  store.summarizerStatus['session-1'] = { status: 'idle' };
  store.upsertSessionSlot = vi.fn();
  store.ensureSessionSlots = vi.fn().mockResolvedValue(undefined);
  store.loadSessionSlots = vi.fn().mockResolvedValue(undefined);
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

  it('puts the variable-width controls before the constant-width copy glyph', () => {
    store.sessionSlots['session-1'] = slots();
    render(<ContextPane session={SESSION} />);
    const decisions = sectionFor('Decisions');
    const actions = within(decisions).getAllByRole('button');
    const editSource = within(decisions).getByRole('button', { name: 'Edit source' });
    const copy = within(decisions).getByRole('button', { name: 'copy decisions' });

    expect(actions.indexOf(copy)).toBeGreaterThan(actions.indexOf(editSource));
  });

  it('states each region once, in its own heading, and not again above them', () => {
    render(<ContextPane session={SESSION} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Context');
    expect(screen.getByText('One row per choice already settled along the way.')).toBeDefined();
    expect(screen.queryByText(/summary and the decisions settled/)).toBeNull();
  });

  it('keeps both regions on one page rather than behind a segmented control', () => {
    render(<ContextPane session={SESSION} />);

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Session summary', 'Decisions']);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('labels a region on the eyebrow grade, not the page grade, while keeping the h2', () => {
    render(<ContextPane session={SESSION} />);

    const heading = screen.getByRole('heading', { level: 2, name: 'Decisions' });

    expect(heading.className).not.toContain('text-base');
    expect(screen.getByText('Decisions').className).toContain('text-2xs');
  });

  it('pairs the region description with its heading grade instead of the reading grade', () => {
    render(<ContextPane session={SESSION} />);

    const hint = screen.getByText('One row per choice already settled along the way.');

    expect(hint.className).toContain('text-2xs');
    expect(hint.className).not.toContain('text-sm');
  });

  it('leaves the summary body on the reading grade, because the document is the artifact', () => {
    render(<ContextPane session={SESSION} />);
    const problem = within(sectionFor('Session summary')).getByRole('region', { name: 'Problem' });

    expect(problem.querySelector('.text-sm')).not.toBeNull();
  });

  it('asks for the context itself, so the pane does not depend on the session switch', () => {
    render(<ContextPane session={SESSION} />);

    expect(store.ensureSessionSlots).toHaveBeenCalledWith('session-1');
  });

  it('says the read failed instead of offering the blank document as the truth', () => {
    store.sessionSlots['session-1'] = [];
    store.sessionSlotsLoad['session-1'] = 'failed';
    render(<ContextPane session={SESSION} />);
    const summary = sectionFor('Session summary');

    expect(within(summary).getByText('Session summary did not load')).toBeDefined();
    expect(within(summary).queryByRole('region', { name: 'Problem' })).toBeNull();
    expect(within(sectionFor('Decisions')).getByText('Decisions did not load')).toBeDefined();
  });

  it('reads the database again from the failed state', () => {
    store.sessionSlots['session-1'] = [];
    store.sessionSlotsLoad['session-1'] = 'failed';
    render(<ContextPane session={SESSION} />);

    fireEvent.click(within(sectionFor('Decisions')).getByRole('button', { name: 'Retry' }));

    expect(store.loadSessionSlots).toHaveBeenCalledWith('session-1');
  });

  it('shows the retry underway rather than the failure it is already replacing', () => {
    store.sessionSlots['session-1'] = [];
    store.sessionSlotsLoad['session-1'] = 'failed';
    store.sessionLoading['session-1'] = {
      agents: false,
      transcript: false,
      telemetry: false,
      slots: true,
      plans: false,
      summary: false,
    };
    render(<ContextPane session={SESSION} />);
    const summary = sectionFor('Session summary');

    expect(within(summary).getByRole('status', { name: 'Loading' })).toBeDefined();
    expect(within(summary).queryByText('Session summary did not load')).toBeNull();
  });

  it('waits rather than claiming a session is empty before the read has answered', () => {
    store.sessionSlots['session-1'] = [];
    store.sessionSlotsLoad['session-1'] = undefined;
    render(<ContextPane session={SESSION} />);
    const summary = sectionFor('Session summary');

    expect(within(summary).getByRole('status', { name: 'Loading' })).toBeDefined();
    expect(within(summary).queryByRole('region', { name: 'Problem' })).toBeNull();
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

  it('leads each canonical block header with a small icon on the eyebrow tone', () => {
    render(<ContextPane session={SESSION} />);
    const summary = sectionFor('Session summary');

    for (const title of ['Problem', 'Learned', 'State', 'Next']) {
      const region = within(summary).getByRole('region', { name: title });
      const icon = region.querySelector('h3 svg');
      expect(icon).not.toBeNull();
      expect(icon?.getAttribute('width')).toBe('12');
    }
  });

  it('keeps the icon off a non-canonical block header', () => {
    store.sessionSlots['session-1'] = slots({
      last_output_summary: `${SUMMARY}\n\n#### Risks\n- a heading we do not know.`,
    });
    render(<ContextPane session={SESSION} />);
    const risks = within(sectionFor('Session summary')).getByRole('region', { name: 'Risks' });

    expect(risks.querySelector('h3 svg')).toBeNull();
  });

  it('labels each block without drawing a box around it', () => {
    render(<ContextPane session={SESSION} />);
    const problem = within(sectionFor('Session summary')).getByRole('region', { name: 'Problem' });

    expect(problem.className).not.toContain('border');
    expect(problem.className).not.toContain('bg-');
    expect(within(problem).getByText('Problem').className).toContain('uppercase');
  });

  it('offers the four blocks on an empty document instead of a bespoke placeholder', () => {
    store.sessionSlots['session-1'] = slots({ last_output_summary: '' });
    render(<ContextPane session={SESSION} />);
    const summary = sectionFor('Session summary');

    for (const title of ['Problem', 'Learned', 'State', 'Next']) {
      expect(within(summary).getByRole('region', { name: title })).toBeDefined();
      expect(
        within(summary).getByRole('button', { name: `Add ${title.toLowerCase()}` }),
      ).toBeDefined();
    }
    expect(summary.textContent).not.toContain('No session summary yet');
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

    expect(next.textContent).toBe('Next');
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

  it('sets a row one step down the type scale, on a whole-pixel line box', () => {
    render(<ContextPane session={SESSION} />);
    const decisions = sectionFor('Decisions');

    const prose = within(decisions).getAllByTestId('markdown')[0] as HTMLElement;

    expect(prose.className).toContain('text-xs');
    expect(prose.className).toContain('[&_p]:leading-5');
    expect(prose.className).not.toContain('text-sm');
  });

  it('tightens the row and keeps the delete control on the text it belongs to', () => {
    render(<ContextPane session={SESSION} />);
    const decisions = sectionFor('Decisions');

    const row = within(decisions).getByRole('button', { name: 'Edit decision 1' })
      .parentElement as HTMLElement;

    expect(row.className).toContain('py-2');
    expect(row.className).not.toContain('p-3');
    expect(row.className).toContain('items-center');
    expect(row.className).not.toContain('border');
  });

  it('leaves the empty section to its add row rather than a placeholder', () => {
    store.sessionSlots['session-1'] = slots({ decisions: '' });
    render(<ContextPane session={SESSION} />);
    const decisions = sectionFor('Decisions');

    expect(decisions.textContent).not.toContain('No decisions yet');
    expect(within(decisions).getByRole('button', { name: 'Add decision' })).toBeDefined();
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

describe('Working set removal', () => {
  it('keeps the working set off the context page', () => {
    render(<ContextPane session={SESSION} />);

    expect(screen.queryByRole('region', { name: 'Working set' })).toBeNull();
    expect(screen.queryByText('Working set')).toBeNull();
  });
});
