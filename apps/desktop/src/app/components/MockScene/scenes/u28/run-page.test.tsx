// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { C09_RUN_ID, C09_SESSION_ID, C09_TESTER_ID } from '../u25/c09OrchestratedSeed';
import { U28_RUN_PAGE_SCENES } from './run-page';

const SETTLE_MS = 2_000;

type SceneName = keyof typeof U28_RUN_PAGE_SCENES;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 }, turn_quiet: [] });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const mount = async (name: SceneName): Promise<void> => {
  const Scene = U28_RUN_PAGE_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
};

const nodeOf = (selector: string): HTMLElement => {
  const node = document.querySelector<HTMLElement>(selector);
  if (node === null) {
    throw new Error(`no ${selector}`);
  }
  return node;
};

const tail = (): HTMLElement => nodeOf('[data-orchestrated-tail]');

const header = (): HTMLElement => nodeOf('[data-run-header-actions]');

const checklist = (): HTMLElement => nodeOf('section[aria-label="Plan and progress"]');

const fieldValue = (placeholder: string): string => {
  const field = screen.getByPlaceholderText(placeholder);
  return field instanceof HTMLTextAreaElement ? field.value : '';
};

const type = (placeholder: string, value: string): void => {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
};

describe('the u28 run page scenes', () => {
  it('registers every scene in the mock registry', () => {
    for (const name of Object.keys(U28_RUN_PAGE_SCENES)) {
      expect(MOCK_SCENES[name], name).toBeDefined();
    }
  });

  it('u28-run-step-blocked shows the question inline with Answer first and Restart step second', async () => {
    await mount('u28-run-step-blocked');

    expect(tail().getAttribute('data-orchestrated-tail')).toBe('step-failed');
    within(tail()).getByText('Paused on blocked step 3');
    const question = nodeOf('[data-blocked-question]');
    expect(question.textContent).toContain('The step asked');
    expect(question.textContent).toContain(
      'Should I keep the report in the repo or only attach it to the notes?',
    );
    const form = within(tail()).getByRole('form', { name: 'Answer the step' });
    const verbs = within(tail())
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(verbs.indexOf('Restart step')).toBeGreaterThan(-1);
    expect(verbs).toContain('Open agent chat');
    const answer = within(form).getByRole('button', { name: 'Answer' });
    expect(answer.hasAttribute('disabled')).toBe(true);
    within(tail()).getByRole('button', { name: 'Restart step' });
    expect(header().textContent).not.toContain('Restart step');
  });

  it('u28-run-step-blocked sends the answer to the blocked step and clears the field', async () => {
    await mount('u28-run-step-blocked');
    const answerBlockedStep = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ answerBlockedStep });
    });
    type('Answer the step', 'Attach it to the notes only.');
    const form = within(tail()).getByRole('form', { name: 'Answer the step' });

    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Answer' }));
    });

    expect(answerBlockedStep).toHaveBeenCalledWith({
      sessionId: C09_SESSION_ID,
      agentId: C09_TESTER_ID,
      text: 'Attach it to the notes only.',
    });
    expect(fieldValue('Answer the step')).toBe('');
  });

  it('u28-run-needs-answer shows the question inline and sends the answer to the asking step', async () => {
    await mount('u28-run-needs-answer');
    const answerOpenQuestions = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ answerOpenQuestions });
    });

    expect(tail().getAttribute('data-orchestrated-tail')).toBe('needs-answer');
    expect(tail().textContent).toContain('Which export size should the benchmark treat');
    expect(within(tail()).queryByRole('button', { name: 'Restart step' })).toBeNull();
    const form = within(tail()).getByRole('form', { name: 'Answer the question' });
    const answer = within(form).getByRole('button', { name: 'Send answer' });
    expect(answer.hasAttribute('disabled')).toBe(true);

    type('Answer the question', '12,000 rows.');
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Send answer' }));
    });

    expect(answerOpenQuestions).toHaveBeenCalledWith(
      C09_SESSION_ID,
      [
        {
          id: 'mock-c09-question',
          text: 'Which export size should the benchmark treat as the target: 12,000 rows or 50,000?',
          answer: '12,000 rows.',
        },
      ],
      C09_TESTER_ID,
    );
    expect(fieldValue('Answer the question')).toBe('');
  });

  it('u28-run-needs-answer keeps the answer and says why when the send fails', async () => {
    await mount('u28-run-needs-answer');
    act(() => {
      useAppStore.setState({
        answerOpenQuestions: vi.fn(async () => {
          throw new Error('Could not save the answer.');
        }),
      });
    });
    type('Answer the question', '12,000 rows.');
    const form = within(tail()).getByRole('form', { name: 'Answer the question' });

    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Send answer' }));
    });

    expect(within(form).getByRole('alert').textContent).toContain('Could not save the answer.');
    expect(fieldValue('Answer the question')).toBe('12,000 rows.');
  });

  it('u28-run-step-blocked keeps the answer and says why when the send fails', async () => {
    await mount('u28-run-step-blocked');
    const answerBlockedStep = vi.fn(async () => {
      throw new Error('This step is no longer waiting for an answer.');
    });
    act(() => {
      useAppStore.setState({ answerBlockedStep });
    });
    type('Answer the step', 'Attach it to the notes only.');
    const form = within(tail()).getByRole('form', { name: 'Answer the step' });

    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Answer' }));
    });

    expect(within(form).getByRole('alert').textContent).toContain('no longer waiting');
    expect(fieldValue('Answer the step')).toBe('Attach it to the notes only.');
  });

  it('u28-run-step-blocked shows a roleless Left item as a note, not a step, and a repeated step once', async () => {
    await mount('u28-run-step-blocked');

    const planned = [...checklist().querySelectorAll<HTMLElement>('[data-plan-row="left"]')];
    expect(planned.map((row) => row.textContent)).toEqual(['DocsWrite the export notes']);
    expect(within(checklist()).getAllByText('Run the 12k export benchmark')).toHaveLength(1);
    const notes = within(checklist()).getByRole('button', { name: 'Left open (1)' });
    expect(within(checklist()).queryByText('Stream rows to CSV')).toBeNull();
    act(() => {
      notes.click();
    });
    within(nodeOf('[data-orchestrated-notes]')).getByText('Stream rows to CSV');
  });

  it('u28-run-orch-blocked shows the reason as text with Add a hint and continue instead of Retry', async () => {
    await mount('u28-run-orch-blocked');

    expect(tail().getAttribute('data-orchestrated-tail')).toBe('blocked');
    const block = nodeOf('[data-orchestrated-block]');
    expect(block.textContent).toContain('Needs a human call.');
    expect(block.textContent).not.toContain('**');
    expect(block.textContent).not.toContain('`');
    expect(block.querySelector('strong')?.textContent).toBe('Needs a human call.');
    expect(block.querySelectorAll('li')).toHaveLength(2);
    expect(within(header()).queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByPlaceholderText('Hint the orchestrator')).toBeNull();
    screen.getByRole('form', { name: 'Add a hint and continue' });
  });

  it('u28-run-orch-blocked saves the hint then lets the orchestrator decide again', async () => {
    await mount('u28-run-orch-blocked');
    const continueWithHint = vi.fn(async () => undefined);
    act(() => {
      useAppStore.setState({ continueWithHint });
    });
    type('Add a hint and continue', 'Ask the payments-api owners, then ship.');
    const form = screen.getByRole('form', { name: 'Add a hint and continue' });

    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Continue' }));
    });

    expect(continueWithHint).toHaveBeenCalledWith(
      C09_SESSION_ID,
      C09_RUN_ID,
      expect.objectContaining({ text: 'Ask the payments-api owners, then ship.' }),
    );
  });

  it('u28-run-kind-live keeps the kind popover read-only while the run goes', async () => {
    await mount('u28-run-kind-live');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    const popover = screen.getByRole('dialog', { name: 'Kind' });
    expect(popover.textContent).toContain('Why: you picked it');
    expect(popover.textContent).toContain(
      'Fixed while the run is going. Stop it to restart as something else.',
    );
    expect(within(popover).queryAllByRole('button')).toHaveLength(0);
    expect(within(popover).queryByRole('group')).toBeNull();
  });

  it('u28-run-orchestrator-model names the orchestrator in the settings line and opens its picker', async () => {
    await mount('u28-run-orchestrator-model');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    const chip = screen.getByRole('button', { name: /^Orchestrator:/ });
    expect(chip.getAttribute('data-run-model')).toBe('auto');
    const popover = screen.getByRole('dialog', { name: 'Orchestrator model' });
    within(popover).getByRole('button', { name: /^Auto, now / });
    within(popover).getByRole('button', { name: 'Change the default in Settings' });
  });

  it('u28-run-kind-ended offers Restart as on a stopped run', async () => {
    await mount('u28-run-kind-ended');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SETTLE_MS);
    });

    const popover = screen.getByRole('dialog', { name: 'Kind' });
    const restartAs = within(popover).getByRole('group', { name: 'Restart as' });
    expect(
      within(restartAs)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Workflow · Preset Fix flaky tests', 'Agent · Auto agent']);
    expect(popover.textContent).toContain(
      'Ends this run and starts a new one with what it did so far.',
    );
  });
});
