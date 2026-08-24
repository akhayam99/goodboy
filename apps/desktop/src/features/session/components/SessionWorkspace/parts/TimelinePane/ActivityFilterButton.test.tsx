// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ACTIVITY_CATEGORIES,
  DEFAULT_ACTIVITY_FILTER,
  type ActivityFilter,
  type ActivityToggle,
} from '../../../../timeline/activityFilter';
import { ActivityFilterButton } from './ActivityFilterButton';

afterEach(cleanup);

type RenderParams = {
  readonly filter?: ActivityFilter;
  readonly onToggle?: (params: {
    readonly toggle: ActivityToggle;
    readonly enabled: boolean;
  }) => void;
  readonly onAll?: (params: { readonly enabled: boolean }) => void;
};

const open = ({
  filter = DEFAULT_ACTIVITY_FILTER,
  onToggle = () => {},
  onAll = () => {},
}: RenderParams = {}) => {
  const hiddenCount = Object.values(filter).filter((enabled) => !enabled).length;
  render(
    <ActivityFilterButton
      filter={filter}
      hiddenCount={hiddenCount}
      onToggle={onToggle}
      onAll={onAll}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Filter the activity feed' }));
};

describe('ActivityFilterButton', () => {
  it('lists every activity group and both subagent sub-rows as toggleable items', () => {
    open();
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(ACTIVITY_CATEGORIES.length + 2);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('carries the active state on the row itself', () => {
    open({ filter: { ...DEFAULT_ACTIVITY_FILTER, decisions: false } });
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Workflows' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Decisions' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('flips the group when the row is clicked', () => {
    const onToggle = vi.fn();
    open({ filter: { ...DEFAULT_ACTIVITY_FILTER, decisions: false }, onToggle });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Workflows' }));
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'workflows', enabled: false });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Decisions' }));
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'decisions', enabled: true });
  });

  it('offers a plans row like any other category', () => {
    const onToggle = vi.fn();
    open({ onToggle });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Plans' }));
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'plans', enabled: false });
  });

  it('nests a subagent sub-row directly under Workflows and under Agents', () => {
    open();
    const workflowsRow = screen.getByRole('menuitemcheckbox', { name: 'Workflows' });
    const agentsRow = screen.getByRole('menuitemcheckbox', { name: 'Agents' });
    expect(workflowsRow.nextElementSibling?.getAttribute('aria-label')).toBe('Workflow subagents');
    expect(agentsRow.nextElementSibling?.getAttribute('aria-label')).toBe('Agent subagents');
  });

  it('flips a subagent flag from its sub-row', () => {
    const onToggle = vi.fn();
    open({ onToggle });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Workflow subagents' }));
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'workflowSubagents', enabled: false });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Agent subagents' }));
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'agentSubagents', enabled: false });
  });

  it('disables the sub-row and reads it as off while its parent is hidden', () => {
    const onToggle = vi.fn();
    open({ filter: { ...DEFAULT_ACTIVITY_FILTER, workflows: false }, onToggle });
    const subRow = screen.getByRole('menuitemcheckbox', { name: 'Workflow subagents' });
    expect(subRow.hasAttribute('disabled')).toBe(true);
    expect(subRow.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(subRow);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('keeps both bulk actions on one row below the categories', () => {
    open();
    const menu = screen.getByRole('menu');
    const showAll = screen.getByRole('menuitem', { name: 'Show all' });
    const hideAll = screen.getByRole('menuitem', { name: 'Hide all' });
    expect(showAll.parentElement).toBe(hideAll.parentElement);
    expect(showAll.parentElement?.previousElementSibling?.getAttribute('role')).toBe('separator');
    expect(menu.lastElementChild).toBe(showAll.parentElement);
  });

  it('turns everything on from Show all and off from Hide all', () => {
    const onAll = vi.fn();
    open({ onAll });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show all' }));
    expect(onAll).toHaveBeenCalledWith({ enabled: true });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide all' }));
    expect(onAll).toHaveBeenCalledWith({ enabled: false });
  });

  it('gives each row the concept glyph of its own kind', () => {
    open();
    const row = screen.getByRole('menuitemcheckbox', { name: 'Workflows' });
    expect(row.querySelector('svg')).not.toBeNull();
    expect(row.querySelector('svg')?.getAttribute('class')).toContain('text-accent');
  });

  it('dims the glyph of an inactive row', () => {
    open({ filter: { ...DEFAULT_ACTIVITY_FILTER, decisions: false } });
    const row = screen.getByRole('menuitemcheckbox', { name: 'Decisions' });
    expect(row.querySelector('svg')?.getAttribute('class')).toContain('text-muted-foreground/50');
  });

  it('closes a visible row with an open eye at the trailing edge', () => {
    open();
    const row = screen.getByRole('menuitemcheckbox', { name: 'Workflows' });
    const eye = row.querySelector('.lucide-eye');
    expect(eye).not.toBeNull();
    expect(row.querySelector('.lucide-eye-off')).toBeNull();
    expect(row.lastElementChild?.classList.contains('lucide-eye')).toBe(true);
  });

  it('marks a hidden row with a dimmer closed eye', () => {
    open({ filter: { ...DEFAULT_ACTIVITY_FILTER, decisions: false } });
    const row = screen.getByRole('menuitemcheckbox', { name: 'Decisions' });
    const eye = row.querySelector('.lucide-eye-off');
    expect(eye).not.toBeNull();
    expect(row.querySelector('.lucide-eye')).toBeNull();
    expect(eye?.getAttribute('class')).toContain('text-muted-foreground/40');
  });
});
