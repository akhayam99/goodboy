// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { PresetCard } from './index';

afterEach(cleanup);

const NOW = '2026-08-03T00:00:00.000Z' as IsoDateTime;

const workflow = (over: Partial<Workflow> = {}): Workflow => ({
  id: 'wf-1' as WorkflowId,
  workspaceId: 'ws-1' as WorkspaceId,
  name: 'Refactor',
  description: 'four steps',
  steps: [],
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});

const renderCard = (template: Workflow) =>
  render(
    <ul>
      <PresetCard template={template} active={false} onSelect={vi.fn()} />
    </ul>,
  );

describe('PresetCard', () => {
  it('uses the row only to open a workflow', () => {
    const onSelect = vi.fn();
    render(
      <ul>
        <PresetCard template={workflow()} active={false} onSelect={onSelect} />
      </ul>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Refactor/ }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Duplicate Refactor' })).toBeNull();
  });

  it('names the origin of the workflow', () => {
    renderCard(workflow({ origin: 'library' }));

    expect(screen.getByText('preset')).toBeDefined();
  });

  it('calls an orchestrated workflow by its name, not custom', () => {
    renderCard(workflow({ origin: 'orchestrated' }));

    expect(screen.getByText('orchestrated')).toBeDefined();
    expect(screen.queryByText('custom')).toBeNull();
  });

  it('says nothing about the origin of a row written before it was tracked', () => {
    renderCard(workflow());

    for (const label of ['preset', 'custom', 'orchestrated']) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });
});
