// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import type { WorkflowAdvanceState } from '../../../workflows/advanceGate';
import { NowBlock } from './NowBlock';
import { aQuestionCard } from './testing/nowCards';
import {
  aNowRun,
  aNowStepAgent,
  aNowWorkflow,
  NOW_SESSION,
  nowModelOf,
} from './testing/nowModelOf';

const navigate = vi.fn();
let store: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  navigate.mockReset();
  store.setState({ navigate });
});
afterEach(() => {
  cleanup();
});

const BUILD_STEPS = ['Scope', 'Tests', 'Implement', 'Review', 'Docs', 'Ship'];

const showBuild = () => {
  const attached = aNowRun({
    key: 'build',
    title: 'Build',
    workflow: aNowWorkflow({ key: 'build', name: 'Build', stepNames: BUILD_STEPS }),
  });
  const agents = [
    aNowStepAgent({ attached, stepIndex: 0, status: 'completed', name: 'Scope' }),
    aNowStepAgent({ attached, stepIndex: 1, status: 'completed', name: 'Tests' }),
    aNowStepAgent({ attached, stepIndex: 2, status: 'running', name: 'Implement' }),
  ];
  const waitingStep = attached.workflow.steps[3];
  if (waitingStep === undefined) {
    throw new Error('The Build workflow needs a fourth step.');
  }
  const advance: WorkflowAdvanceState = {
    kind: 'blocked',
    reason: 'questions',
    step: waitingStep,
    failedStep: null,
  };
  store.setState({ sessionPhaseRuns: { [NOW_SESSION]: agents } });
  return render(
    <NowBlock
      sessionId={NOW_SESSION}
      model={nowModelOf({
        agents,
        runs: [attached],
        advanceByRunId: new Map([[attached.run.id, advance]]),
      })}
      cards={[aQuestionCard({ where: 'Build step 4' })]}
      doneOutcome={null}
    />,
  );
};

describe('NowBlock', () => {
  it('opens the run page from the group row', () => {
    showBuild();
    fireEvent.click(screen.getByRole('button', { name: 'Open Build' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    const [{ to }] = navigate.mock.calls[0] ?? [{}];
    expect(JSON.stringify(to)).toContain('workflows');
    expect(JSON.stringify(to)).toContain('run-build');
  });

  it('names the step meter with the step, its state and the step that waits', () => {
    showBuild();
    screen.getByRole('img', { name: 'Step 3 of 6, Implement running, step 4 waits on you' });
  });

  it('says the state word and the sentence', () => {
    showBuild();
    expect(screen.getByRole('region', { name: 'Now' }).getAttribute('data-now-state')).toBe(
      'waiting',
    );
    expect(document.querySelector('[data-now-sentence]')?.textContent).toBe(
      'Build is on step 3 of 6, Implement. Build step 4 waits on one answer from you.',
    );
  });

  it('draws no Button inside the block', () => {
    const { container } = showBuild();
    expect(container.querySelectorAll('button[data-variant]')).toHaveLength(0);
  });
});
