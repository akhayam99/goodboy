// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { BranchCommit, DiffView } from '@goodboy/types';
import { DiffViewSelector } from './index';

afterEach(cleanup);

const workingView: DiffView = { kind: 'working', scope: 'all' };
const commits: ReadonlyArray<BranchCommit> = [
  {
    sha: 'abc123456789',
    shortSha: 'abc1234',
    subject: 'local change',
    author: 'Ada',
    timestamp: Date.now() / 1000 - 60,
    pushed: false,
    parentSha: null,
  },
  {
    sha: 'def567856789',
    shortSha: 'def5678',
    subject: 'origin change',
    author: 'Lin',
    timestamp: Date.now() / 1000 - 120,
    pushed: true,
    parentSha: 'abc123456789',
  },
];

describe('DiffViewSelector', () => {
  it('renders the current label in the trigger', () => {
    render(
      <DiffViewSelector
        view={workingView}
        onChange={vi.fn()}
        commits={[]}
        status={null}
        filesCount={3}
      />,
    );
    expect(screen.getByText('working tree')).toBeDefined();
  });

  it('opens the menu and shows the staged-only option', () => {
    render(
      <DiffViewSelector
        view={workingView}
        onChange={vi.fn()}
        commits={[]}
        status={null}
        filesCount={null}
      />,
    );
    fireEvent.click(screen.getByTitle(/change diff view/i));
    expect(screen.getByText('staged only')).toBeDefined();
  });

  it('fires onChange with a new view when an option is picked', () => {
    const onChange = vi.fn();
    render(
      <DiffViewSelector
        view={workingView}
        onChange={onChange}
        commits={[]}
        status={null}
        filesCount={null}
      />,
    );
    fireEvent.click(screen.getByTitle(/change diff view/i));
    fireEvent.click(screen.getByText('staged only'));
    expect(onChange).toHaveBeenCalledWith({ kind: 'working', scope: 'staged' });
  });

  it('keeps commit details and section semantics in the portaled picker', () => {
    render(
      <DiffViewSelector
        view={workingView}
        onChange={vi.fn()}
        commits={commits}
        status={null}
        filesCount={2}
      />,
    );
    fireEvent.click(screen.getByTitle(/change diff view/i));

    expect(screen.getByText('ready to push')).toBeDefined();
    expect(screen.getByText('abc1234')).toBeDefined();
    expect(screen.getByText('origin change')).toBeDefined();
    expect(screen.getByText('pushed')).toBeDefined();
  });

  it('preserves arrow and enter keyboard selection from the filter, branch preset first', () => {
    const onChange = vi.fn();
    render(
      <DiffViewSelector
        view={{ kind: 'working', scope: 'all' }}
        onChange={onChange}
        commits={[]}
        status={null}
        filesCount={null}
      />,
    );
    fireEvent.click(screen.getByTitle(/change diff view/i));
    const filter = screen.getByRole('textbox', { name: 'Filter commits' });
    fireEvent.keyDown(filter, { key: 'ArrowDown' });
    fireEvent.keyDown(filter, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({ kind: 'branch' });
  });

  it('reads top-down as branch, currently editing, ready to push, on origin', () => {
    render(
      <DiffViewSelector
        view={workingView}
        onChange={vi.fn()}
        commits={commits}
        status={null}
        filesCount={null}
      />,
    );
    fireEvent.click(screen.getByTitle(/change diff view/i));

    const labels = ['branch', 'currently editing', 'ready to push', 'on origin'].map(
      (label) => screen.getByText(label) as HTMLElement,
    );
    for (let index = 1; index < labels.length; index += 1) {
      const position = labels[index - 1]!.compareDocumentPosition(labels[index]!);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    const firstOption = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-pressed') != null);
    expect(firstOption?.textContent).toContain('branch vs main');
  });

  it('shows one quiet empty line when the filter matches no commits', () => {
    render(
      <DiffViewSelector
        view={workingView}
        onChange={vi.fn()}
        commits={commits}
        status={null}
        filesCount={null}
      />,
    );
    fireEvent.click(screen.getByTitle(/change diff view/i));
    const filter = screen.getByRole('textbox', { name: 'Filter commits' });
    fireEvent.change(filter, { target: { value: 'zzz-no-such-commit' } });

    expect(screen.getByText('no commits match')).toBeDefined();
    expect(screen.queryByText('ready to push')).toBeNull();
    expect(screen.queryByText('on origin')).toBeNull();
    expect(screen.getByText('branch vs main')).toBeDefined();
    expect(screen.getByText('staged only')).toBeDefined();
  });

  it('keeps the filter scoped to commits and drops only the unmatched commit section', () => {
    render(
      <DiffViewSelector
        view={workingView}
        onChange={vi.fn()}
        commits={commits}
        status={null}
        filesCount={null}
      />,
    );
    fireEvent.click(screen.getByTitle(/change diff view/i));
    const filter = screen.getByRole('textbox', { name: 'Filter commits' });
    fireEvent.change(filter, { target: { value: 'origin change' } });

    expect(screen.getByText('on origin')).toBeDefined();
    expect(screen.getByText('origin change')).toBeDefined();
    expect(screen.queryByText('ready to push')).toBeNull();
    expect(screen.queryByText('no commits match')).toBeNull();
  });
});
