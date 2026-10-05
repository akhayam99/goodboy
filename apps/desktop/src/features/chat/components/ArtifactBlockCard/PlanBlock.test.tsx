// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PlanArtifact, ProviderRunId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../../store';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  PLAN_FIXTURE_ID,
  PLAN_FIXTURE_PLANNER,
  PLAN_FIXTURE_SESSION,
  aPlan,
  aStoredPlan,
} from '../../../../test/planFixtures';
import type { TranscriptItem } from '../../utils/transcript-items';
import { ArtifactBlockCard } from './index';

type Block = Extract<TranscriptItem, { kind: 'artifact_block' }>;

const block = (overrides: Partial<Block>): Block => ({
  kind: 'artifact_block',
  key: 'text-0-artifact-0',
  artifactKind: 'plan',
  title: 'Retry-safe webhook credits',
  complete: true,
  runId: 'run-1' as ProviderRunId,
  ...overrides,
});

const seed = (stored: Partial<PlanArtifact>) => {
  const plan = aPlan();
  useAppStore.setState({
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [plan] },
    sessionArtifacts: { [PLAN_FIXTURE_SESSION]: [aStoredPlan(stored, plan)] },
    sessionPhaseRuns: {
      [PLAN_FIXTURE_SESSION]: [
        anAgent({ id: PLAN_FIXTURE_PLANNER, sessionId: PLAN_FIXTURE_SESSION, name: 'Planner' }),
      ],
    },
    sessionOpenQuestions: {},
    agentTurnState: {},
    drawer: null,
  });
};

const renderBlock = (item: Block, planVersion: number | null = null) =>
  render(
    <ToastProvider>
      <ArtifactBlockCard
        item={item}
        sessionId={PLAN_FIXTURE_SESSION}
        agentId={PLAN_FIXTURE_PLANNER}
        planVersion={planVersion}
      />
    </ToastProvider>,
  );

beforeEach(() => {
  useAppStore.setState({
    sessionPlans: {},
    sessionArtifacts: {},
    sessionPhaseRuns: {},
    agentTurnState: {},
    drawer: null,
  });
});

afterEach(cleanup);

describe('a plan block in the transcript', () => {
  it('is a row on the column while the plan is still arriving', () => {
    renderBlock(block({ complete: false, title: null }));

    const row = screen.getByTestId('plan-block-arriving');
    expect(row.getAttribute('data-span')).toBe('column');
    expect(row.textContent).toContain('Plan · writing');
  });

  it('is the same row on the column once the plan is stored', () => {
    seed({ revision: 1, sourceTurnId: 'run-1' });
    renderBlock(block({}));

    expect(screen.getByTestId('plan-row').getAttribute('data-span')).toBe('column');
    expect(screen.queryByTestId('artifact-block-chip')).toBeNull();
  });

  it('opens the plan in the drawer when the row is pressed', () => {
    seed({ revision: 1, sourceTurnId: 'run-1' });
    renderBlock(block({}));

    fireEvent.click(screen.getByTestId('plan-row-open'));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    });
  });

  it('turns into a slim line naming the version that replaced it after a rework', () => {
    seed({ revision: 2, sourceTurnId: 'run-2' });
    renderBlock(block({ runId: 'run-1' as ProviderRunId }), 1);

    const line = screen.getByTestId('plan-block-replaced');
    expect(line.textContent).toBe('Plan v1 · replaced by v2');
    expect(screen.queryByText('Plan not in this session')).toBeNull();

    fireEvent.click(line);
    expect(useAppStore.getState().drawer).toEqual({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: 1 },
    });
  });

  it('never names a version newer than the one that replaced it', () => {
    seed({ revision: 3, sourceTurnId: 'run-3' });
    renderBlock(block({ runId: 'run-1' as ProviderRunId }), 7);

    expect(screen.getByTestId('plan-block-replaced').textContent).toBe('Plan v2 · replaced by v3');
  });

  it('says the plan is not in this session when nothing was stored', () => {
    renderBlock(block({}));

    expect(screen.getByTestId('artifact-block-row').textContent).toContain(
      'Plan not in this session',
    );
  });
});
