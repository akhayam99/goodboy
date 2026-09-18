// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Project, ProjectScript } from '@goodboy/types';
import { ScriptRow } from './ScriptRow';

const script = {
  id: 'script-1',
  projectId: 'project-1',
  name: 'setup',
  body: 'echo hi',
} as ProjectScript;

const projects = [{ id: 'project-1', name: 'API' }] as unknown as ReadonlyArray<Project>;

afterEach(cleanup);

describe('ScriptRow', () => {
  it('reverts an inline command edit on Escape', () => {
    const onSave = vi.fn();
    render(
      <ScriptRow
        script={script}
        projects={projects}
        projectName="API"
        mountPath="/tmp/api"
        run={null}
        completedAt={undefined}
        expanded
        runnable
        canRun
        runDisabledReason={null}
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
        projects={projects}
        projectName="API"
        mountPath="/tmp/api"
        run={null}
        completedAt={undefined}
        expanded
        runnable
        canRun
        runDisabledReason={null}
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
    expect(onSave).toHaveBeenCalledWith('setup', 'echo next', 'project-1');
  });

  it('keeps one verb on the row and the rest behind a menu that says what it is', () => {
    render(
      <ScriptRow
        script={script}
        projects={projects}
        projectName="API"
        mountPath="/tmp/api"
        run={null}
        completedAt={undefined}
        expanded={false}
        runnable
        canRun
        runDisabledReason={null}
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
    expect(screen.queryByRole('button', { name: 'Copy script' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete script' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    expect(screen.getByRole('menuitem', { name: 'Copy script' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Edit script' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Delete script' })).toBeDefined();
  });

  it('says on the row that the command was copied, not inside a shut menu', () => {
    render(
      <ScriptRow
        script={script}
        projects={projects}
        projectName="API"
        mountPath="/tmp/api"
        run={null}
        completedAt={undefined}
        expanded={false}
        runnable
        canRun
        runDisabledReason={null}
        copied
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onRun={vi.fn()}
        onCancel={vi.fn()}
        onCopy={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Copied')).toBeDefined();
  });

  it('deletes only after inline confirmation', () => {
    const onDelete = vi.fn();
    render(
      <ScriptRow
        script={script}
        projects={projects}
        projectName="API"
        mountPath="/tmp/api"
        run={null}
        completedAt={undefined}
        expanded={false}
        runnable
        canRun
        runDisabledReason={null}
        copied={false}
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onRun={vi.fn()}
        onCancel={vi.fn()}
        onCopy={vi.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete script' }));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete setup' }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('keeps the More trigger unframed alongside the ghost icon controls', () => {
    render(
      <ScriptRow
        script={script}
        projects={projects}
        projectName="API"
        mountPath="/tmp/api"
        run={null}
        completedAt={undefined}
        expanded={false}
        runnable
        canRun
        runDisabledReason={null}
        copied={false}
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onRun={vi.fn()}
        onCancel={vi.fn()}
        onCopy={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'More' });

    expect(trigger.className).not.toContain('border');
  });
});
