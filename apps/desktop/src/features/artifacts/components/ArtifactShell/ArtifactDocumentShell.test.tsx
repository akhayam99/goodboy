// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useAppStore } from '../../../../store';
import { ToastProvider } from '../../../../shared/components/Toast';
import { PLAN_FIXTURE_SESSION } from '../../../../test/planFixtures';
import {
  aPlanDraft,
  seedPlanDrawer,
  type PlanDrawerSeed,
} from '../../../../test/planDrawerFixtures';
import { ArtifactDocumentShell } from './ArtifactDocumentShell';

const renderPage = (seed: PlanDrawerSeed) => {
  const { plan, stored } = seedPlanDrawer(seed);
  const agents = useAppStore.getState().sessionPhaseRuns[PLAN_FIXTURE_SESSION] ?? [];
  const subject = { kind: 'plan', plan, artifact: stored } as const;
  return render(
    <ToastProvider>
      <ArtifactDocumentShell sessionId={PLAN_FIXTURE_SESSION} subject={subject} agents={agents} />
    </ToastProvider>,
  );
};

const filledButtons = () => Array.from(document.querySelectorAll('button[data-variant="primary"]'));

afterEach(cleanup);

describe('ArtifactDocumentShell plan page', () => {
  it('draws Approve once for a held plan, in the header, filled', async () => {
    renderPage({ run: 'held' });

    const approve = await screen.findAllByRole('button', { name: /^Approve/ });
    expect(approve).toHaveLength(1);
    expect(approve[0]?.getAttribute('data-variant')).toBe('primary');
    expect(screen.queryByTestId('plan-bar-approve')).toBeNull();
  });

  it('leaves Send to planner as the only filled button while comments wait', async () => {
    renderPage({ run: 'held', drafts: [aPlanDraft()] });

    const approve = await screen.findByTestId('artifact-action-runPlan');
    expect(approve.getAttribute('data-variant')).toBe('secondary');
    expect(filledButtons().map((button) => button.getAttribute('data-testid'))).toEqual([
      'plan-bar-send',
    ]);
  });

  it('keeps Run plan as the filled button when no comment waits', async () => {
    renderPage({ run: 'none' });

    const run = await screen.findByTestId('artifact-action-runPlan');
    expect(run.getAttribute('data-variant')).toBe('primary');
  });
});
