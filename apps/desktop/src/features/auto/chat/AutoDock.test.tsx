// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { aDelegation, aPlanRow, aView, FIXTURE_SESSION } from '../testing/autoViewFixtures';
import { AutoDock } from './AutoDock';

afterEach(cleanup);

const ROOT = anAgent({ id: brandId<AgentId>({ value: 'agent-auto' }) });

type RenderParams = {
  readonly view: AutoTreeView;
  readonly onOpenArtifact?: (artifactId: string) => void;
};

const renderDock = ({ view, onOpenArtifact = vi.fn() }: RenderParams) => {
  useAppStore.setState({ autoTreeViews: { [FIXTURE_SESSION]: [view] } });
  return render(
    <AutoDock
      sessionId={FIXTURE_SESSION}
      view={view}
      rootAgent={ROOT}
      onOpenArtifact={onOpenArtifact}
    />,
  );
};

describe('AutoDock', () => {
  it('asks for the plan with one primary, Approve plan, and two quiet buttons', () => {
    const onOpenArtifact = vi.fn();
    renderDock({
      view: aView({ phase: 'waiting', artifacts: [aPlanRow()] }),
      onOpenArtifact,
    });

    expect(screen.getByText('Plan v1 waits for your OK')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Approve plan' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ask for changes' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open plan Retry-safe credit retries' }));
    expect(onOpenArtifact).toHaveBeenCalledWith('artifact-plan');
    expect(document.querySelectorAll('[data-auto-dock] button')).toHaveLength(3);
  });

  it('says changes asked while the plan is revised, with Open plan only', () => {
    renderDock({
      view: aView({
        phase: 'waiting',
        artifacts: [aPlanRow({ approvalState: 'revising', openRevise: 'delegation-revise' })],
      }),
    });

    expect(screen.getByText('Plan v1 · changes asked')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Open plan Retry-safe credit retries' }),
    ).toBeDefined();
  });

  it('says approved in the artifact tone with Open plan only', () => {
    renderDock({
      view: aView({
        phase: 'waiting',
        artifacts: [aPlanRow({ approvalState: 'approved', approvedRevision: 1 })],
      }),
    });

    expect(screen.getByText('Plan v1 approved').getAttribute('data-tone')).toBe('merged');
    expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
  });

  it('says used once a writer took the plan', () => {
    renderDock({
      view: aView({ phase: 'waiting', artifacts: [{ ...aPlanRow(), status: 'consumed' }] }),
    });

    expect(screen.getByText('Plan v1 used')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
  });

  it('says no approval needed when Auto asks you nothing', () => {
    renderDock({
      view: { ...aView({ phase: 'waiting', artifacts: [aPlanRow()] }), level: 'run' },
    });

    expect(screen.getByText('Plan v1 · no approval needed')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
  });

  it('folds to one live row with its verb when there is no plan', () => {
    renderDock({
      view: aView({
        phase: 'waiting',
        delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })],
      }),
    });

    const dock = document.querySelector<HTMLElement>('[data-auto-dock]');
    expect(dock?.querySelector('[data-dock-plan]')).toBeNull();
    expect(within(dock as HTMLElement).getByText('Waiting for Implementer')).toBeDefined();
    expect(
      within(dock as HTMLElement).getByRole('button', { name: 'Change approach' }),
    ).toBeDefined();
  });

  it('draws nothing when no plan exists and nothing runs', () => {
    renderDock({ view: aView({ phase: 'done' }) });

    expect(document.querySelector('[data-auto-dock]')?.childElementCount).toBe(0);
  });
});
