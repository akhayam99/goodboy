// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { heldDraftStore } from '../../../plans/planComments/heldDraftStore';
import { trackDraftSave } from '../../../plans/planComments/trackDraftSave';
import { PLAN_FIXTURE_ID } from '../../../../test/planFixtures';
import { ToastProvider } from '../../../../shared/components/Toast';
import { PLAN_FIXTURE_SESSION } from '../../../../test/planFixtures';
import {
  aPlanDraft,
  seedPlanDrawer,
  setPlanDrafts,
  stubRunPlan,
  type PlanDrawerSeed,
} from '../../../../test/planDrawerFixtures';
import { ArtifactDocumentShell } from './ArtifactDocumentShell';

const renderPage = (seed: PlanDrawerSeed) => {
  const { plan, stored } = seedPlanDrawer(seed);
  const subject = { kind: 'plan', plan, artifact: stored } as const;
  return render(
    <ToastProvider>
      <ArtifactDocumentShell sessionId={PLAN_FIXTURE_SESSION} subject={subject} agents={[]} />
    </ToastProvider>,
  );
};

const filledButtons = () => Array.from(document.querySelectorAll('button[data-variant="primary"]'));

afterEach(() => {
  cleanup();
  heldDraftStore.clear();
});

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

  describe('with a first comment still being saved', () => {
    const written = {
      sessionId: PLAN_FIXTURE_SESSION,
      artifactId: PLAN_FIXTURE_ID,
      revision: 2,
      anchor: { kind: 'part', index: 0, title: 'Backfill the ledger' },
      body: 'Name the index',
    } as const;

    it('asks about the comment that landed, from the header button', async () => {
      renderPage({ run: 'none' });
      const runPlan = vi.fn(async () => ({
        kind: 'refused' as const,
        reason: null,
        workflowRunId: null,
      }));
      stubRunPlan({ runPlan });
      let settle: () => void = () => undefined;
      trackDraftSave({
        save: new Promise<void>((resolve) => {
          settle = () => {
            setPlanDrafts({ drafts: [aPlanDraft()] });
            resolve();
          };
        }),
        draft: written,
      });

      fireEvent.click(await screen.findByTestId('artifact-action-runPlan'));
      await act(async () => undefined);
      expect(runPlan).not.toHaveBeenCalled();
      expect(screen.queryByText('Run without your comment?')).toBeNull();
      await act(async () => settle());

      await screen.findByText('Run without your comment?');
      expect(runPlan).not.toHaveBeenCalled();
    });

    it('does not start while a comment that could not be saved is held', async () => {
      renderPage({ run: 'none' });
      const runPlan = vi.fn(async () => ({
        kind: 'refused' as const,
        reason: null,
        workflowRunId: null,
      }));
      stubRunPlan({ runPlan });
      heldDraftStore.hold({ draft: written });

      fireEvent.click(await screen.findByTestId('artifact-action-runPlan'));

      await screen.findByText(/A comment didn't save/);
      expect(runPlan).not.toHaveBeenCalled();
    });
  });
});
