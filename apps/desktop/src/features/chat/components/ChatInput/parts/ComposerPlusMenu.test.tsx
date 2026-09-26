// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ComposerPlusMenu } from './ComposerPlusMenu';

afterEach(cleanup);

describe('ComposerPlusMenu', () => {
  it('shows the prefix next to each menu entry, so the syntax is learned here', () => {
    render(<ComposerPlusMenu onAttachFiles={vi.fn()} onInsertPrefix={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByText('Run a script')).toBeTruthy();
    expect(screen.getByText('$')).toBeTruthy();
    expect(screen.getByText('Start a workflow')).toBeTruthy();
    expect(screen.getByText('~')).toBeTruthy();
    expect(screen.getByText('Ask another agent')).toBeTruthy();
    expect(screen.getByText('@')).toBeTruthy();
    expect(screen.getByText('Attach files')).toBeTruthy();
  });

  it('calls onAttachFiles and closes when that entry is picked', () => {
    const onAttachFiles = vi.fn();
    render(<ComposerPlusMenu onAttachFiles={onAttachFiles} onInsertPrefix={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('Attach files'));
    expect(onAttachFiles).toHaveBeenCalledOnce();
    expect(screen.queryByText('Attach files')).toBeNull();
  });

  it('inserts the prefix symbol when a prefix entry is picked', () => {
    const onInsertPrefix = vi.fn();
    render(<ComposerPlusMenu onAttachFiles={vi.fn()} onInsertPrefix={onInsertPrefix} />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByText('Start a workflow'));
    expect(onInsertPrefix).toHaveBeenCalledWith('~');
  });

  it('disables the trigger when the composer is blocked', () => {
    render(<ComposerPlusMenu onAttachFiles={vi.fn()} onInsertPrefix={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'More actions' }).hasAttribute('disabled')).toBe(
      true,
    );
  });
});
