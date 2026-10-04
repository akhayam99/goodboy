// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import { StudioShell } from '../../../shared/components/StudioShell';
import { ImportPopover } from '../../../features/workflows/components/WorkflowStudio/ImportPopover';
import { StudioFrame } from './index';

vi.mock('../../../features/workflows/components/WorkflowsPanel/useWorkflowImport', () => ({
  useWorkflowImport: () => ({
    groups: [],
    picks: [],
    selected: new Set(),
    isImporting: false,
    importError: null,
    load: vi.fn(),
    toggle: vi.fn(),
    clear: vi.fn(),
    importSelected: vi.fn(async () => null),
  }),
}));

vi.mock('../../../shared/components/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const WORKSPACE_ID = 'ws-harborline' as WorkspaceId;

const pressEscape = () => fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

const settle = () =>
  act(() => {
    vi.advanceTimersByTime(300);
  });

describe('a popover inside a studio', () => {
  it('closes the popover first and the studio on the next escape', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(
      <StudioFrame kind="workflow" onClose={onClose}>
        <StudioShell title="Workflows" closeLabel="Close workflows" onClose={() => undefined}>
          {() => <ImportPopover workspaceId={WORKSPACE_ID} takenNames={new Set()} />}
        </StudioShell>
      </StudioFrame>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByRole('dialog', { name: 'Import workflows' })).toBeDefined();

    pressEscape();
    settle();

    expect(screen.queryByRole('dialog', { name: 'Import workflows' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    pressEscape();
    settle();

    expect(onClose).toHaveBeenCalledOnce();
  });
});
