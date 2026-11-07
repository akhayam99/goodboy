// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { Trail } from '../components/Trail';
import type { CrumbMenuModel, CrumbMenuRow } from '../components/Trail/crumbMenuTypes';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const rowOf = ({ id, label }: { readonly id: string; readonly label: string }): CrumbMenuRow => ({
  id,
  lead: { kind: 'icon', icon: Circle },
  label,
  secondary: null,
  metaA: null,
  state: null,
  isCurrent: id === 'pages',
  isDisabled: false,
  indent: 0,
  onSelect: vi.fn(),
});

const MENU: CrumbMenuModel = {
  title: 'Pages',
  context: null,
  count: null,
  triggerLabel: 'Switch page',
  groups: [
    {
      id: 'pages',
      label: null,
      rows: [rowOf({ id: 'pages', label: 'Pages' }), rowOf({ id: 'runs', label: 'Runs' })],
    },
  ],
  actions: [],
  width: 'narrow',
  filterPlaceholder: null,
};

const mountTrail = () =>
  render(
    <Trail
      segments={[
        { id: 'pages', label: 'Pages', icon: Circle, menu: MENU, onSelect: vi.fn() },
        { id: 'run', label: 'Ship a fix', icon: Circle },
      ]}
    />,
  );

const trigger = () => screen.getByRole('button', { name: 'Switch page: Pages' });

const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

describe('CrumbMenuTrigger from the keyboard', () => {
  it('opens on ArrowDown, moves focus in and refocuses the trigger on close with no tooltip', async () => {
    vi.useFakeTimers();
    mountTrail();
    act(() => trigger().focus());
    await advance(10);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    await advance(10);

    const menu = screen.getByRole('menu');
    expect(menu.contains(document.activeElement)).toBe(true);
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.keyDown(document.activeElement ?? menu, { key: 'Escape' });
    await advance(10);

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger());
    await advance(600);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens on Enter and closes back to the trigger with no tooltip', async () => {
    vi.useFakeTimers();
    mountTrail();
    act(() => trigger().focus());
    await advance(10);

    fireEvent.keyDown(trigger(), { key: 'Enter' });
    fireEvent.click(trigger());
    await advance(10);

    const menu = screen.getByRole('menu');
    expect(menu.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document.activeElement ?? menu, { key: 'Escape' });
    await advance(10);

    expect(document.activeElement).toBe(trigger());
    await advance(600);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
