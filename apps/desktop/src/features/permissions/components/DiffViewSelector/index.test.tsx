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

  it('preserves arrow and enter keyboard selection from the filter', () => {
    const onChange = vi.fn();
    render(
      <DiffViewSelector
        view={{ kind: 'branch' }}
        onChange={onChange}
        commits={[]}
        status={null}
        filesCount={null}
      />,
    );
    fireEvent.click(screen.getByTitle(/change diff view/i));
    const filter = screen.getByRole('textbox', { name: 'filter commits' });
    fireEvent.keyDown(filter, { key: 'ArrowDown' });
    fireEvent.keyDown(filter, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith({ kind: 'working', scope: 'all' });
  });
});
