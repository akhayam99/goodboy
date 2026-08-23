import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DetectedRepoList } from './index';

afterEach(cleanup);

const REPOS = [
  { name: 'api', path: '/repos/parent/api' },
  { name: 'web', path: '/repos/parent/web' },
];

describe('DetectedRepoList', () => {
  it('pre-selects every detected repository and links them all on confirm', () => {
    const onConfirm = vi.fn();
    render(
      <DetectedRepoList repos={REPOS} busy={false} onConfirm={onConfirm} onDismiss={vi.fn()} />,
    );

    expect(screen.getByText('2 repositories found in this folder')).toBeDefined();
    for (const checkbox of screen.getAllByRole('checkbox')) {
      expect((checkbox as HTMLInputElement).checked).toBe(true);
    }

    fireEvent.click(screen.getByRole('button', { name: 'Link 2 projects' }));

    expect(onConfirm).toHaveBeenCalledWith({
      paths: ['/repos/parent/api', '/repos/parent/web'],
    });
  });

  it('excludes an unchecked repository from the confirm action', () => {
    const onConfirm = vi.fn();
    render(
      <DetectedRepoList repos={REPOS} busy={false} onConfirm={onConfirm} onDismiss={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Link api' }));

    fireEvent.click(screen.getByRole('button', { name: 'Link 1 project' }));

    expect(onConfirm).toHaveBeenCalledWith({ paths: ['/repos/parent/web'] });
  });

  it('disables the confirm action when nothing stays selected', () => {
    render(<DetectedRepoList repos={REPOS} busy={false} onConfirm={vi.fn()} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Link api' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Link web' }));

    expect(
      (screen.getByRole('button', { name: 'Link 0 projects' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('dismisses through the quiet cancel action', () => {
    const onDismiss = vi.fn();
    render(
      <DetectedRepoList repos={REPOS} busy={false} onConfirm={vi.fn()} onDismiss={onDismiss} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
