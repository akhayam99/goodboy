// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { DiffView } from '@goodboy/types';
import { DiffViewSelector } from './index';

afterEach(cleanup);

const workingView: DiffView = { kind: 'working', scope: 'all' };

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
});
