// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PlanWithCount, ProviderRunId } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../../actions/components/ObjectMenuProvider';
import { PLAN_FIXTURE_AT, PLAN_FIXTURE_SESSION } from '../../../../../test/planFixtures';
import {
  aPlanDraft,
  seedPlanDrawer,
  type PlanDrawerSeed,
} from '../../../../../test/planDrawerFixtures';
import type { ArtifactListRow as Row } from '../../../artifactListRows';
import { ListGrid } from '@goodboy/ui';
import { ArtifactWorkRow } from './index';
import { ARTIFACTS_GRID_COLUMNS } from '../artifactsGridColumns';

type RowOfParams = {
  readonly plan: PlanWithCount;
  readonly group: Row['group'];
};

const rowOf = ({ plan, group }: RowOfParams): Row => ({
  id: `artifact:${plan.id}`,
  target: { kind: 'artifact', artifactId: plan.id },
  kind: 'plan',
  title: plan.title,
  state: null,
  group,
  at: plan.createdAt,
  deletedAt: null,
  partCount: 0,
  parts: [],
  runBy: null,
  isPlanRunning: false,
  isFaint: false,
});

const renderRow = (seed: PlanDrawerSeed, group: Row['group'] = 'needs') => {
  const { plan } = seedPlanDrawer(seed);
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <ListGrid label="Artifacts" columns={ARTIFACTS_GRID_COLUMNS}>
          <ArtifactWorkRow
            row={rowOf({ plan, group })}
            rowKey={`artifact:${plan.id}`}
            sessionId={PLAN_FIXTURE_SESSION}
            isPartsOpen={false}
            onTogglePartsOf={() => undefined}
            onOpenRow={() => undefined}
          />
        </ListGrid>
      </ObjectMenuProvider>
    </ToastProvider>,
  );
};

const primary = (name: string): HTMLElement => screen.getByRole('button', { name });

afterEach(cleanup);

describe('the primary of a plan row follows the plan rule', () => {
  it('is Approve, filled, for a plan its run holds for', () => {
    renderRow({ run: 'held' });

    expect(primary('Approve and start Implement').getAttribute('data-filled')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Run plan' })).toBeNull();
  });

  it('is Run plan, filled, for a session plan', () => {
    renderRow({ run: 'none' });

    expect(primary('Run plan').getAttribute('data-filled')).toBe('true');
  });

  it('turns secondary while the plan has unsent comments', () => {
    renderRow({ run: 'held', drafts: [aPlanDraft()] });

    expect(primary('Approve and start Implement').getAttribute('data-filled')).toBe('false');
  });

  it('is off, with its reason, while the planner revises', () => {
    renderRow({
      run: 'held',
      turn: { kind: 'running', runId: 'run-2' as ProviderRunId, startedAt: PLAN_FIXTURE_AT },
    });

    const button = primary('Approve and start Implement');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('title')).toBe('The planner is revising this plan');
  });

  it('has no button on a row outside Needs you: the opened plan and right click hold its verbs', () => {
    renderRow({ run: 'none' }, 'ready');

    expect(screen.queryByRole('button', { name: 'Run plan' })).toBeNull();
  });

  it('has no primary for a plan that already ran', () => {
    renderRow({ status: 'consumed' });

    expect(screen.queryByRole('button', { name: 'Approve and start Implement' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Run plan' })).toBeNull();
  });
});

const visibleButtons = (): ReadonlyArray<string> =>
  screen
    .getAllByRole('button', { hidden: true })
    .filter((button) => button.closest('[data-row-secondary=""]') === null)
    .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '');

describe('an artifact row shows one action', () => {
  it('shows the open control and the state-driven primary, no icon wall and no overflow', () => {
    renderRow({ run: 'held' });

    expect(visibleButtons()).toEqual([
      expect.stringMatching(/^Plan /),
      'Approve and start Implement',
    ]);
  });

  it('has no Delete button on the row', () => {
    renderRow({ run: 'none' });

    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });

  it('keeps Delete in the right click menu of the row', () => {
    renderRow({ run: 'none' });

    fireEvent.contextMenu(screen.getByRole('button', { name: /^Plan / }));

    screen.getByRole('menuitem', { name: /^Delete\b/ });
  });

  it('draws no kind column: the glyph says it', () => {
    renderRow({ run: 'none' });

    expect(screen.queryByTestId('artifact-row-kind')).toBeNull();
  });
});

describe('an artifact row asks beside its button', () => {
  it('opens Approve anyway as a popover outside the row and leaves the row as it was', () => {
    renderRow({ run: 'held', drafts: [aPlanDraft()] });
    const frame = screen.getByRole('list', { name: 'Artifacts' });
    const childCount = frame.children.length;

    fireEvent.click(primary('Approve and start Implement'));

    const dialog = screen.getByRole('dialog', { name: 'Approve without your comment?' });
    expect(frame.contains(dialog)).toBe(false);
    expect(dialog.closest('[data-dropdown-portal]')).not.toBeNull();
    within(dialog).getByRole('button', { name: 'Approve anyway' });
    expect(frame.children.length).toBe(childCount);
  });

  it('closes on Escape and gives focus back to the row button', async () => {
    renderRow({ run: 'held', drafts: [aPlanDraft()] });
    const approve = primary('Approve and start Implement');
    approve.focus();

    fireEvent.click(approve);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(approve);
  });
});

describe('an artifact row opens its parts from the initial cell', () => {
  it('puts the chevron before the title and toggles the parts from it', () => {
    const { plan } = seedPlanDrawer({ run: 'none' });
    const onTogglePartsOf = vi.fn();
    const base = rowOf({ plan, group: 'ready' });
    const row: Row = {
      ...base,
      partCount: 2,
      parts: [
        { index: 0, title: 'Add the ledger', nodeState: 'done', nodeLabel: 'Done' },
        { index: 1, title: 'Wire the webhook', nodeState: 'queued', nodeLabel: 'Queued' },
      ],
    };
    render(
      <ToastProvider>
        <ObjectMenuProvider>
          <ListGrid label="Artifacts" columns={ARTIFACTS_GRID_COLUMNS}>
            <ArtifactWorkRow
              row={row}
              rowKey={row.id}
              sessionId={PLAN_FIXTURE_SESSION}
              isPartsOpen={false}
              onTogglePartsOf={onTogglePartsOf}
              onOpenRow={() => undefined}
            />
          </ListGrid>
        </ObjectMenuProvider>
      </ToastProvider>,
    );

    const toggle = screen.getByRole('button', { name: `Show parts of ${row.title}` });
    const titleCell = toggle.closest('[data-artifact-row-title]');
    expect(titleCell?.firstElementChild).toBe(toggle);
    fireEvent.click(toggle);
    expect(onTogglePartsOf).toHaveBeenCalledWith(row.id);
  });
});
