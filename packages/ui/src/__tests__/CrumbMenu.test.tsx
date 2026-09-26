// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Circle, Square } from 'lucide-react';
import { Trail } from '../components/Trail';
import type { CrumbMenuModel, CrumbMenuRow } from '../components/Trail/crumbMenuTypes';

afterEach(cleanup);

const row = (
  overrides: Partial<CrumbMenuRow> & Pick<CrumbMenuRow, 'id' | 'label'>,
): CrumbMenuRow => ({
  lead: { kind: 'icon', icon: Circle },
  secondary: null,
  metaA: null,
  state: null,
  isCurrent: false,
  isDisabled: false,
  indent: 0,
  onSelect: vi.fn(),
  ...overrides,
});

const stepMenu = (onStop: () => void): CrumbMenuModel => ({
  title: 'Steps',
  context: 'Ship a fix',
  count: 3,
  triggerLabel: 'Switch step',
  width: 'regular',
  filterPlaceholder: null,
  groups: [
    {
      id: 'steps',
      label: null,
      rows: [
        row({
          id: 's1',
          label: 'Scout the webhook module',
          lead: { kind: 'number', value: 1 },
          metaA: 'Haiku 4.5',
          state: { word: 'Done', tone: 'success' },
        }),
        row({
          id: 's2',
          label: 'Implement the fix',
          lead: { kind: 'number', value: 2 },
          metaA: 'Sonnet 5',
          state: { word: 'Running', tone: 'info' },
          isCurrent: true,
        }),
        row({
          id: 's3',
          label: 'Test the retry path',
          lead: { kind: 'number', value: 3 },
          state: { word: 'Not started', tone: 'neutral' },
          isDisabled: true,
        }),
      ],
    },
  ],
  actions: [
    {
      id: 'stop',
      label: 'Stop this step',
      icon: Square,
      confirm: {
        title: 'Stop Implement the fix?',
        description: 'The edits so far stay.',
        confirmLabel: 'Stop step',
      },
      onRun: onStop,
    },
  ],
});

const renderTrail = (menu: CrumbMenuModel) =>
  render(
    <Trail
      segments={[
        { id: 'run', label: 'Ship a fix', icon: Circle, onSelect: vi.fn(), menu: null },
        { id: 'step', label: 'Implement the fix', icon: Circle, menu },
      ]}
    />,
  );

const openLast = () => fireEvent.click(screen.getByRole('button', { name: /Implement the fix/ }));

describe('CrumbMenu', () => {
  it('opens from the last segment with a word for every state and the current row checked', () => {
    renderTrail(stepMenu(vi.fn()));
    openLast();

    const menu = screen.getByRole('menu', { name: 'Switch step' });
    const rows = within(menu).getAllByRole('menuitemradio');
    expect(rows).toHaveLength(3);
    expect(within(menu).getByText('Done')).toBeDefined();
    expect(within(menu).getByText('Not started')).toBeDefined();
    const current = rows.find((item) => item.getAttribute('aria-checked') === 'true');
    expect(current?.textContent).toContain('Implement the fix');
    expect(rows[2]?.hasAttribute('disabled')).toBe(true);
    expect(document.activeElement).toBe(current);
  });

  it('moves with the arrows past a row that has not started, and selects on click', () => {
    const menu = stepMenu(vi.fn());
    renderTrail(menu);
    openLast();
    const list = screen.getByRole('menu', { name: 'Switch step' });

    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' });
    expect((document.activeElement as HTMLElement).textContent).toContain('Stop this step');
    fireEvent.keyDown(document.activeElement as Element, { key: 'Home' });
    expect((document.activeElement as HTMLElement).textContent).toContain('Scout the webhook');

    fireEvent.click(within(list).getAllByRole('menuitemradio')[0] as HTMLElement);
    expect(menu.groups[0]?.rows[0]?.onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('confirms a breaking action inside the band, and Escape cancels the confirm first', () => {
    const onStop = vi.fn();
    renderTrail(stepMenu(onStop));
    openLast();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Stop this step' }));
    expect(screen.getByText('Stop Implement the fix?')).toBeDefined();
    expect(onStop).not.toHaveBeenCalled();

    const root = screen
      .getByRole('menu', { name: 'Switch step' })
      .querySelector('[data-crumb-menu]');
    fireEvent.keyDown(root as Element, { key: 'Escape' });
    expect(screen.queryByText('Stop Implement the fix?')).toBeNull();
    expect(screen.getByRole('menu', { name: 'Switch step' })).toBeDefined();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Stop this step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop step' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('keeps the menu on a segment with a single sibling', () => {
    renderTrail({
      ...stepMenu(vi.fn()),
      groups: [
        {
          id: 'one',
          label: null,
          rows: [row({ id: 'only', label: 'Implement the fix', isCurrent: true })],
        },
      ],
    });
    openLast();
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
  });

  it('filters from nine rows up', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      row({ id: `p${index}`, label: `Project ${index}` }),
    );
    renderTrail({
      ...stepMenu(vi.fn()),
      filterPlaceholder: 'Find a project',
      groups: [{ id: 'p', label: 'Projects', rows: many }],
      actions: [],
    });
    openLast();
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a project' }), {
      target: { value: 'project 3' },
    });
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
  });

  it('lets an ancestor go up by its name and switch by its chevron', () => {
    const onUp = vi.fn();
    render(
      <Trail
        segments={[
          {
            id: 'run',
            label: 'Ship a fix',
            icon: Circle,
            onSelect: onUp,
            menu: { ...stepMenu(vi.fn()), triggerLabel: 'Switch run' },
          },
          { id: 'step', label: 'Implement the fix', icon: Circle },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ship a fix' }));
    expect(onUp).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Switch run: Ship a fix' }));
    expect(screen.getByRole('menu', { name: 'Switch run' })).toBeDefined();
  });
});
