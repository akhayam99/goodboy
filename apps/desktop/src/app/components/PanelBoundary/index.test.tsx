// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PanelBoundary } from './index';

type BoomProps = {
  readonly state: { isBroken: boolean };
};

const Boom = ({ state }: BoomProps) => {
  if (state.isBroken) {
    throw new Error('Harborline pane exploded');
  }
  return <p>pane drawn</p>;
};

type HostProps = {
  readonly state: { isBroken: boolean };
  readonly onLeave: () => void;
};

const Host = ({ state, onLeave }: HostProps) => (
  <div>
    <nav aria-label="rail">rail alive</nav>
    <header>top bar alive</header>
    <PanelBoundary leaveLabel="Go to the board" onLeave={onLeave}>
      <Boom state={state} />
    </PanelBoundary>
  </div>
);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PanelBoundary', () => {
  it('keeps the rail and the top bar alive when a panel throws', () => {
    render(<Host state={{ isBroken: true }} onLeave={() => undefined} />);

    expect(screen.getByText("This page couldn't be drawn")).toBeDefined();
    expect(screen.getByText('rail alive')).toBeDefined();
    expect(screen.getByText('top bar alive')).toBeDefined();
    expect(screen.queryByText('pane drawn')).toBeNull();
  });

  it('remounts the panel on Retry', () => {
    const state = { isBroken: true };
    render(<Host state={state} onLeave={() => undefined} />);

    state.isBroken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('pane drawn')).toBeDefined();
    expect(screen.queryByText("This page couldn't be drawn")).toBeNull();
  });

  it('stays on the fallback when Retry throws again', () => {
    render(<Host state={{ isBroken: true }} onLeave={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText("This page couldn't be drawn")).toBeDefined();
    expect(screen.getByText('rail alive')).toBeDefined();
  });

  it('runs the leave action from the named button', () => {
    const onLeave = vi.fn();
    render(<Host state={{ isBroken: true }} onLeave={onLeave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Go to the board' }));

    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('opens the crash report from Report this', () => {
    render(<Host state={{ isBroken: true }} onLeave={() => undefined} />);
    expect(screen.queryByText('Report this crash')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Report this' }));

    expect(screen.getByText('Report this crash')).toBeDefined();
    expect(screen.getByText('rail alive')).toBeDefined();
  });
});
