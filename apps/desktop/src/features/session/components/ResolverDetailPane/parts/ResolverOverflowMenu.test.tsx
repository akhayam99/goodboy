// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Agent } from '@goodboy/types';
import type { ResolverAction } from '../../../resolverActions';
import type { ResolverActionsController } from '../../../hooks/useResolverActions';
import { ResolverOverflowMenu } from './ResolverOverflowMenu';

const FORCE_CLOSE = {
  kind: 'forceClose',
  label: 'Force close threads',
  role: 'danger',
  isEnabled: true,
  confirm: {
    role: 'danger',
    title: 'Force close every thread',
    description: 'The remaining threads are marked resolved without a verdict.',
    confirmLabel: 'Force close',
  },
  opensInspector: false,
} satisfies ResolverAction;

const REWORK = {
  kind: 'rework',
  label: 'Rework the resolution',
  role: 'neutral',
  isEnabled: true,
  confirm: null,
  opensInspector: false,
} satisfies ResolverAction;

const AGENT = { id: 'agent-1' } as Agent;

type Params = {
  readonly overflow?: ReadonlyArray<ResolverAction>;
  readonly run?: (kind: ResolverAction['kind']) => Promise<void>;
};

const renderMenu = ({
  overflow = [FORCE_CLOSE, REWORK],
  run = vi.fn(async () => undefined),
}: Params = {}) => {
  const actions = {
    plan: { primary: null, secondary: null, overflow, note: null },
    run,
  } as unknown as ResolverActionsController;
  render(<ResolverOverflowMenu agent={AGENT} actions={actions} />);
  return { run };
};

const trigger = () => screen.getByRole('button', { name: /more resolver actions/i });

afterEach(cleanup);

describe('ResolverOverflowMenu', () => {
  it('renders nothing without overflow actions', () => {
    renderMenu({ overflow: [] });
    expect(screen.queryByRole('button', { name: /more resolver actions/i })).toBeNull();
  });

  it('opens a menu listing every overflow action', () => {
    renderMenu();
    fireEvent.click(trigger());
    expect(screen.getByRole('menu', { name: /more resolver actions/i })).toBeDefined();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(screen.queryByText('Rewrite the branch')).toBeNull();
  });

  it('arms an action into its confirm and runs it', async () => {
    const { run } = renderMenu();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('menuitem', { name: /force close threads/i }));
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Force close' }));
    await waitFor(() => expect(run).toHaveBeenCalledWith('forceClose'));
    await waitFor(() =>
      expect(screen.queryByRole('menu', { name: /more resolver actions/i })).toBeNull(),
    );
  });

  it('escapes clipping ancestors through a fixed body portal', () => {
    renderMenu();
    fireEvent.click(trigger());
    const menu = screen.getByRole('menu', { name: /more resolver actions/i });
    expect(menu.className).toContain('fixed');
    expect(menu.className).toContain('z-popover');
    expect(menu.closest('[data-dropdown-portal]')?.parentElement).toBe(document.body);
  });

  it('closes on Escape and drops the armed action', () => {
    renderMenu();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('menuitem', { name: /force close threads/i }));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: /more resolver actions/i })).toBeNull();
    fireEvent.click(trigger());
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('closes on a mousedown outside the menu and drops the armed action', () => {
    renderMenu();
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('menuitem', { name: /force close threads/i }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu', { name: /more resolver actions/i })).toBeNull();
    fireEvent.click(trigger());
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });
});
