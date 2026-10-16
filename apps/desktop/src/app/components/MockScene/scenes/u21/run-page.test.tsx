// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { WorkflowRunScene } from '../flow-audit/WorkflowRunScene';
import { PLAN_HOLD_PLAN } from '../flow-audit/planHoldRun';
import { FLOW_SESSION_ID } from '../flow-audit/fixtures';
import { U21_RUN_PAGE_SCENES } from './run-page';

let useAppStore: StoryStore;

const ORIGINAL_SCROLL_INTO_VIEW = Element.prototype.scrollIntoView;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
  Element.prototype.scrollIntoView = ORIGINAL_SCROLL_INTO_VIEW;
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

const SCENE_IDS = [
  'workflow-run-scrolled',
  'workflow-run-plan-review',
  'workflow-run-plan-question',
] as const;

const renderScene = (id: (typeof SCENE_IDS)[number]) => {
  const Scene = U21_RUN_PAGE_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const nodeOf = (selector: string): HTMLElement => {
  const node = document.querySelector<HTMLElement>(selector);
  if (node === null) {
    throw new Error(`nothing matches ${selector}`);
  }
  return node;
};

const tail = (): HTMLElement => nodeOf('[data-orchestrated-tail]');

const runDocument = (): HTMLElement => nodeOf('[data-orchestrated-run]');

const header = (): HTMLElement => nodeOf('[data-slot="pane-header"]');

describe('the u21 run page scenes on the orchestrated document', () => {
  it('registers exactly the three scenes the plan names', () => {
    expect(Object.keys(U21_RUN_PAGE_SCENES).sort()).toEqual([...SCENE_IDS].sort());
  });

  it('reads the run as one document under its title', async () => {
    renderScene('workflow-run-scrolled');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Duplicate credit fix' }),
    ).toBeDefined();
    expect(within(runDocument()).getByTestId('run-tree')).toBeDefined();
  });

  it('keeps the composer docked under the document, after the steps', async () => {
    renderScene('workflow-run-scrolled');

    const steps = await screen.findByTestId('run-tree');
    const composer = await screen.findByTestId('orchestrator-hint-input');

    expect(runDocument().contains(composer)).toBe(false);
    expect(steps.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('lists the two queued hints above the composer, each with Remove', async () => {
    renderScene('workflow-run-scrolled');

    const queued = await screen.findByRole('list', { name: 'Queued hints' });
    expect(within(queued).getAllByRole('button', { name: 'Remove' })).toHaveLength(2);
    expect(screen.queryByText('Queue waits for the next decision.')).toBeNull();
  });

  it('names its two Stops: Stop step on the tail, Stop run in the header', async () => {
    renderScene('workflow-run-scrolled');

    await screen.findByTestId('run-tree');
    expect(within(tail()).getByRole('button', { name: /^Stop step \d+$/ })).toBeDefined();
    expect(within(header()).getByRole('button', { name: 'Stop run' })).toBeDefined();
    fireEvent.click(within(header()).getByRole('button', { name: /run actions$/ }));
    expect(within(screen.getByRole('menu')).queryByText('Stop run')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show run summary' })).toBeNull();
  });

  it('reveals the live row without ever scrolling past the header', async () => {
    const reveal = vi.fn();
    Element.prototype.scrollIntoView = reveal;
    window.history.replaceState(null, '', '/?run=live');
    render(
      <ToastProvider>
        <WorkflowRunScene />
      </ToastProvider>,
    );

    await screen.findByTestId('run-tree');
    for (const call of reveal.mock.calls) {
      expect(call[0]).toEqual({ block: 'nearest' });
    }
  });

  it('shows the held dynamic run with the plan drawer open over the page', async () => {
    renderScene('workflow-run-plan-review');

    await waitFor(() =>
      expect(useAppStore.getState().drawer).toMatchObject({
        kind: 'artifact-document',
        payload: { artifactId: PLAN_HOLD_PLAN.id },
      }),
    );
    expect(tail().getAttribute('data-orchestrated-tail')).toBe('plan-approval');
    expect(within(tail()).getByRole('button', { name: 'Review plan' })).toBeDefined();
    expect(within(header()).queryByRole('button', { name: 'Review plan' })).toBeNull();
    expect(within(header()).queryByRole('button', { name: 'Approve plan' })).toBeNull();
    expect((await screen.findByTestId('plan-primary')).textContent).toBe('Approve');
  });

  it('approves from the drawer on the run page: the hold lifts, the drawer closes, one toast', async () => {
    renderScene('workflow-run-plan-review');

    fireEvent.click(await screen.findByTestId('plan-primary'));

    expect(await screen.findByText('Plan approved')).toBeDefined();
    expect(screen.getByText('The run goes on')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Follow the run' })).toBeNull();
    await waitFor(() => expect(useAppStore.getState().drawer).toBeNull());
    const run = useAppStore.getState().sessions.find((session) => session.id === FLOW_SESSION_ID)
      ?.workflowRuns[0];
    expect(run?.orchestrationStop).toBeUndefined();
    expect(run?.rulesSnapshot?.planApproved).toBe(true);
    expect(screen.queryByText("Couldn't approve the plan")).toBeNull();
  });

  it('adds a comment from the run page drawer and keeps it as a draft in the bar', async () => {
    renderScene('workflow-run-plan-review');

    const body = await screen.findByTestId('plan-body');
    const paragraph = body.querySelector('p, li');
    if (paragraph === null) {
      throw new Error('the plan has no text to comment on');
    }
    fireEvent.mouseOver(paragraph);
    fireEvent.click(await screen.findByRole('button', { name: 'Comment on this text' }));
    fireEvent.change(await screen.findByRole('textbox', { name: /comment/i }), {
      target: { value: 'Keep the window at five minutes.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));

    expect(await screen.findByText('Keep the window at five minutes.')).toBeDefined();
    expect(screen.getByTestId('plan-comment-bar').textContent).toContain('1 comment');
    expect(screen.getByRole('button', { name: 'Send to planner' })).toBeDefined();
  });

  it('says what the planner asked on the tail and offers Answer once, there', async () => {
    renderScene('workflow-run-plan-question');

    await screen.findByTestId('run-tree');
    expect(tail().getAttribute('data-orchestrated-tail')).toBe('plan-question');
    expect(tail().textContent).toContain(
      'The planner asked: Should the plan keep the retry window',
    );
    expect(within(tail()).getByRole('button', { name: 'Answer' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Answer' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
  });

  it('keeps the static plan hold reachable as workflow-run with run=plan-hold', async () => {
    window.history.replaceState(null, '', '/?run=plan-hold');
    render(
      <ToastProvider>
        <WorkflowRunScene />
      </ToastProvider>,
    );

    const runTail = await screen.findByRole('region', { name: 'Run state' });
    expect(within(runTail).getByRole('button', { name: 'Review plan' })).toBeDefined();
    expect(screen.queryByTestId('run-header')).toBeNull();
    expect(screen.queryByTestId('orchestrator-strip')).toBeNull();
    expect(screen.queryByTestId('orchestrator-hint-input')).toBeNull();
  });
});
