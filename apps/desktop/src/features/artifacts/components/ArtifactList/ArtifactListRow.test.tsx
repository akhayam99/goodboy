// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PlanWithCount, ProviderRunId } from '@goodboy/types';
import { ToastProvider } from '../../../../shared/components/Toast';
import { PLAN_FIXTURE_AT, PLAN_FIXTURE_SESSION } from '../../../../test/planFixtures';
import {
  aPlanDraft,
  seedPlanDrawer,
  type PlanDrawerSeed,
} from '../../../../test/planDrawerFixtures';
import type { ArtifactListRow as Row } from '../../artifactListRows';
import { ArtifactListRow } from './ArtifactListRow';

const rowOf = ({ plan }: { readonly plan: PlanWithCount }): Row => ({
  id: `artifact:${plan.id}`,
  target: { kind: 'artifact', artifactId: plan.id },
  kind: 'plan',
  title: plan.title,
  state: null,
  group: 'ready',
  at: plan.createdAt,
  deletedAt: null,
  partCount: 0,
  parts: [],
  runBy: null,
  isPlanRunning: false,
  isFaint: false,
});

const renderRow = (seed: PlanDrawerSeed) => {
  const { plan } = seedPlanDrawer(seed);
  render(
    <ToastProvider>
      <ArtifactListRow
        row={rowOf({ plan })}
        sessionId={PLAN_FIXTURE_SESSION}
        isPartsOpen={false}
        onTogglePartsOf={() => undefined}
        onOpenRow={() => undefined}
      />
    </ToastProvider>,
  );
};

const primary = (name: string): HTMLElement => screen.getByRole('button', { name });

afterEach(cleanup);

describe('the primary of a plan row follows the plan rule', () => {
  it('is Approve, filled, for a plan its run holds for', () => {
    renderRow({ run: 'held' });

    expect(primary('Approve').getAttribute('data-filled')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Run plan' })).toBeNull();
  });

  it('is Run plan, filled, for a session plan', () => {
    renderRow({ run: 'none' });

    expect(primary('Run plan').getAttribute('data-filled')).toBe('true');
  });

  it('turns secondary while the plan has unsent comments', () => {
    renderRow({ run: 'held', drafts: [aPlanDraft()] });

    expect(primary('Approve').getAttribute('data-filled')).toBe('false');
  });

  it('is off, with its reason, while the planner revises', () => {
    renderRow({
      run: 'held',
      turn: { kind: 'running', runId: 'run-2' as ProviderRunId, startedAt: PLAN_FIXTURE_AT },
    });

    const button = primary('Approve');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('title')).toBe('The planner is revising this plan');
  });

  it('has no primary for a plan that already ran', () => {
    renderRow({ status: 'consumed' });

    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Run plan' })).toBeNull();
  });
});

const visibleButtons = (): ReadonlyArray<string> =>
  screen
    .getAllByRole('button', { hidden: true })
    .filter((button) => button.closest('[data-reveal="hover"]') === null)
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '');

describe('an artifact row shows one action', () => {
  it('shows the open control, the state-driven primary and the overflow, nothing else', () => {
    renderRow({ run: 'held' });

    expect(visibleButtons()).toEqual([
      expect.stringMatching(/^Plan /),
      'Approve',
      expect.stringMatching(/^More for /),
    ]);
  });

  it('has no Delete button on the row', () => {
    renderRow({ run: 'none' });

    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });

  it('keeps Delete in the row overflow menu', () => {
    renderRow({ run: 'none' });

    fireEvent.click(screen.getByRole('button', { name: /^More for / }));

    expect(screen.getByRole('menuitem', { name: /^Delete\b/ })).toBeDefined();
  });

  it('names the kind in its own column', () => {
    renderRow({ run: 'none' });

    expect(screen.getByTestId('artifact-row-kind').textContent).toBe('Plan');
  });
});
