// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { WorkspaceScript } from '@goodboy/types';
import { ScriptRow } from './ScriptRow';

const script = {
  id: 'script-1',
  workspaceId: 'workspace-1',
  name: 'setup',
  body: 'echo hi',
} as WorkspaceScript;

afterEach(cleanup);

describe('ScriptRow', () => {
  it('reverts an inline command edit on Escape', () => {
    const onSave = vi.fn();
    render(
      <ScriptRow
        script={script}
        run={null}
        completedAt={undefined}
        expanded
        runnable
        canRun
        copied={false}
        onToggle={vi.fn()}
        onSave={onSave}
        onRun={vi.fn()}
        onCancel={vi.fn()}
        onCopy={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'echo hi' }));
    const textarea = screen.getByRole('textbox', { name: 'Edit setup command' });
    fireEvent.change(textarea, { target: { value: 'echo changed' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });

    expect(screen.queryByRole('textbox', { name: 'Edit setup command' })).toBeNull();
    expect(screen.getByText('echo hi')).toBeDefined();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('commits the next blur after cancelling an edit with Escape', () => {
    const onSave = vi.fn();
    render(
      <ScriptRow
        script={script}
        run={null}
        completedAt={undefined}
        expanded
        runnable
        canRun
        copied={false}
        onToggle={vi.fn()}
        onSave={onSave}
        onRun={vi.fn()}
        onCancel={vi.fn()}
        onCopy={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'echo hi' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit setup command' }), {
      key: 'Escape',
    });
    fireEvent.click(screen.getByRole('button', { name: 'echo hi' }));
    const textarea = screen.getByRole('textbox', { name: 'Edit setup command' });
    fireEvent.change(textarea, { target: { value: 'echo next' } });
    fireEvent.blur(textarea);

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith('setup', 'echo next');
  });

  it('places expand in navigation and run, copy, edit, and delete in lifecycle', () => {
    render(
      <ScriptRow
        script={script}
        run={null}
        completedAt={undefined}
        expanded={false}
        runnable
        canRun
        copied={false}
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onRun={vi.fn()}
        onCancel={vi.fn()}
        onCopy={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const navigationSlot = screen.getByRole('group', { name: 'Script navigation actions' });
    const lifecycleSlot = screen.getByRole('group', { name: 'Script lifecycle actions' });

    expect(navigationSlot.contains(screen.getByRole('button', { name: 'Expand setup' }))).toBe(
      true,
    );
    expect(lifecycleSlot.contains(screen.getByRole('button', { name: 'Run script' }))).toBe(true);
    expect(lifecycleSlot.contains(screen.getByRole('button', { name: 'Copy script' }))).toBe(true);
    expect(lifecycleSlot.contains(screen.getByRole('button', { name: 'Edit script' }))).toBe(true);
    expect(lifecycleSlot.contains(screen.getByRole('button', { name: 'Delete script' }))).toBe(
      true,
    );
  });

  it('deletes only after inline confirmation', () => {
    const onDelete = vi.fn();
    render(
      <ScriptRow
        script={script}
        run={null}
        completedAt={undefined}
        expanded={false}
        runnable
        canRun
        copied={false}
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onRun={vi.fn()}
        onCancel={vi.fn()}
        onCopy={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete script' }));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete setup' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
