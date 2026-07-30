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

  it('keeps run, copy, edit, and overflow controls together in the header', () => {
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

    expect(screen.getByRole('button', { name: 'Run script' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Copy script' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit script' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'More actions for setup' })).toBeDefined();
  });
});
