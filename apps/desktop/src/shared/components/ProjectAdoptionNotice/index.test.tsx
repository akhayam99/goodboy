// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';
import { ProjectAdoptionNotice } from './index';

afterEach(cleanup);

const conflict = {
  project: { id: 'proj-api', name: 'api', rootPath: '/repos/api' },
  sourceWorkspace: { id: 'ws-legacy', name: 'Legacy' },
  sessionCount: 5,
  isShell: true,
} as unknown as ProjectAttachConflict;

describe('ProjectAdoptionNotice', () => {
  it('names the project, its current workspace, and its session count', () => {
    render(
      <ProjectAdoptionNotice conflict={conflict} busy={false} onMove={vi.fn()} onKeep={vi.fn()} />,
    );

    expect(screen.getByText('api')).toBeDefined();
    expect(screen.getByText('already in Legacy with 5 sessions')).toBeDefined();
  });

  it('moves on confirm and keeps on dismiss', () => {
    const onMove = vi.fn();
    const onKeep = vi.fn();
    render(
      <ProjectAdoptionNotice conflict={conflict} busy={false} onMove={onMove} onKeep={onKeep} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Move it here' }));
    expect(onMove).toHaveBeenCalledWith(conflict);

    fireEvent.click(screen.getByRole('button', { name: 'Keep there' }));
    expect(onKeep).toHaveBeenCalledWith(conflict);
  });

  it('blocks both actions while busy', () => {
    render(
      <ProjectAdoptionNotice conflict={conflict} busy={true} onMove={vi.fn()} onKeep={vi.fn()} />,
    );

    expect(
      (screen.getByRole('button', { name: 'Move it here' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: 'Keep there' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
