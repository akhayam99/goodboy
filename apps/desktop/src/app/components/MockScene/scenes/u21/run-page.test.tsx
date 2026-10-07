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

const stepsEdge = (): HTMLElement => {
  const edge = document.querySelector('[data-slot="scroll-edge"]');
  if (!(edge instanceof HTMLElement)) {
    throw new Error('the steps scroller has no edge line');
  }
  return edge;
};

const scrollerOf = (edge: HTMLElement): HTMLElement => {
  const scroller = edge.previousElementSibling;
  if (!(scroller instanceof HTMLElement)) {
    throw new Error('the edge line has no scroller before it');
  }
  return scroller;
};

const stripPhase = (): string | null =>
  screen.getByTestId('orchestrator-strip').getAttribute('data-phase');

const header = () => screen.getByRole('group', { name: 'Run lifecycle actions' });

describe('the u21 run page scenes', () => {
  it('registers exactly the three scenes the plan names', () => {
    expect(Object.keys(U21_RUN_PAGE_SCENES).sort()).toEqual([...SCENE_IDS].sort());
  });

  it('scrolls the steps 40px and lights the edge line under the pinned block', async () => {
    renderScene('workflow-run-scrolled');

    await waitFor(() => {
      const scroller = scrollerOf(stepsEdge());
      expect(scroller.scrollTop).toBe(40);
      expect(scroller.parentElement?.getAttribute('data-scrolled')).toBe('true');
    });
    expect(screen.getAllByRole('heading', { name: 'Duplicate credit fix' }).length).toBeGreaterThan(
      0,
    );
  });

  it('keeps the composer docked under the scroller, after the steps', async () => {
    renderScene('workflow-run-scrolled');

    const steps = await screen.findByTestId('run-tree');
    const composer = await screen.findByTestId('orchestrator-hint-input');
    const scroller = scrollerOf(stepsEdge());

    expect(scroller.contains(steps)).toBe(true);
    expect(scroller.contains(composer)).toBe(false);
    expect(steps.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('folds the two queued hints into one row above the steps', async () => {
    renderScene('workflow-run-scrolled');

    const row = await screen.findByRole('button', { name: /2 queued/ });
    const steps = screen.getByTestId('run-tree');

    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(row.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Queue waits for the next decision.')).toBeNull();
  });

  it('names its two Stop buttons Stop run in the header and Stop step in the strip', async () => {
    renderScene('workflow-run-scrolled');

    await screen.findByTestId('orchestrator-strip');
    const names = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '')
      .filter((name) => /^Stop\b/.test(name));

    expect(names).toEqual(['Stop run', 'Stop step']);
    expect(screen.getByRole('button', { name: 'Show run summary' })).toBeDefined();
  });

  it('opens at the top and reveals the live row without ever scrolling past the header', async () => {
    const reveal = vi.fn();
    Element.prototype.scrollIntoView = reveal;
    window.history.replaceState(null, '', '/?run=live');
    render(
      <ToastProvider>
        <WorkflowRunScene />
      </ToastProvider>,
    );

    const steps = await screen.findByTestId('run-tree');
    const scroller = scrollerOf(stepsEdge());

    expect(scroller.contains(steps)).toBe(true);
    expect(scroller.scrollTop).toBe(0);
    expect(scroller.parentElement?.hasAttribute('data-scrolled')).toBe(false);
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
    expect(stripPhase()).toBe('plan-approval');
    expect(within(header()).getByRole('button', { name: 'Review plan' })).toBeDefined();
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

  it('says what the planner asked and offers Answer in the strip', async () => {
    renderScene('workflow-run-plan-question');

    const strip = await screen.findByTestId('orchestrator-strip');

    expect(stripPhase()).toBe('plan-question');
    expect(within(strip).getByTestId('orchestrator-state').textContent).toContain(
      'The planner asked: Should the plan keep the retry window',
    );
    expect(within(strip).getByRole('button', { name: 'Answer' })).toBeDefined();
    expect(within(strip).queryByRole('button', { name: 'Review plan' })).toBeNull();
  });

  it('keeps the static plan hold reachable as workflow-run with run=plan-hold', async () => {
    window.history.replaceState(null, '', '/?run=plan-hold');
    render(
      <ToastProvider>
        <WorkflowRunScene />
      </ToastProvider>,
    );

    expect(await screen.findByTestId('run-review-plan')).toBeDefined();
    expect(screen.getByTestId('workflow-run-plan-ready').tagName).toBe('BUTTON');
    expect(screen.queryByTestId('orchestrator-strip')).toBeNull();
    expect(screen.queryByTestId('orchestrator-hint-input')).toBeNull();
  });
});
