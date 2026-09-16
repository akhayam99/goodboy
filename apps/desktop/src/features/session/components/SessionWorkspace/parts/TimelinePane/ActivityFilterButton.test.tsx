// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CHILD_TOGGLES,
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
  it('lists every activity group and every sub-row as toggleable items', () => {
    open();
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(
      ACTIVITY_CATEGORIES.length + ACTIVITY_CHILD_TOGGLES.length,
    );
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

  it('nests plans, reports and wireframes under one Artifacts category', () => {
    const onToggle = vi.fn();
    open({ onToggle });
    const artifactsRow = screen.getByRole('menuitemcheckbox', { name: 'Artifacts' });
    const plansRow = screen.getByRole('menuitemcheckbox', { name: 'Plans' });
    const reportsRow = screen.getByRole('menuitemcheckbox', { name: 'Reports' });
    const wireframesRow = screen.getByRole('menuitemcheckbox', { name: 'Wireframes' });

    expect(artifactsRow.nextElementSibling).toBe(plansRow);
    expect(plansRow.nextElementSibling).toBe(reportsRow);
    expect(reportsRow.nextElementSibling).toBe(wireframesRow);

    fireEvent.click(reportsRow);
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'reports', enabled: false });
    fireEvent.click(artifactsRow);
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'artifacts', enabled: false });
  });

  it('disables every artifact sub-row while Artifacts is hidden', () => {
    const onToggle = vi.fn();
    open({ filter: { ...DEFAULT_ACTIVITY_FILTER, artifacts: false }, onToggle });
    const wireframesRow = screen.getByRole('menuitemcheckbox', { name: 'Wireframes' });

    expect(wireframesRow.hasAttribute('disabled')).toBe(true);
    expect(wireframesRow.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(wireframesRow);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('offers a suggestions row and counts it on the badge once hidden', () => {
    const onToggle = vi.fn();
    open({ filter: { ...DEFAULT_ACTIVITY_FILTER, suggestions: false }, onToggle });

    const row = screen.getByRole('menuitemcheckbox', { name: 'Suggestions' });
    expect(row.getAttribute('aria-checked')).toBe('false');
    expect(row.nextElementSibling).toBeNull();
    expect(screen.getByRole('button', { name: 'Filter the activity feed' }).textContent).toBe('1');
    fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'suggestions', enabled: true });
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

  it('scrolls the rows inside a capped panel and keeps the footer out of that scroll', () => {
    open();
    const menu = screen.getByRole('menu');
    const rows = screen.getAllByRole('menuitemcheckbox');
    const first = rows[0];
    const showAll = screen.getByRole('menuitem', { name: 'Show all' });
    const scroller = first?.closest('.max-h-72') ?? null;

    expect(scroller).not.toBeNull();
    expect(menu.className).not.toContain('max-h-72');
    expect(rows.every((row) => scroller?.contains(row) === true)).toBe(true);
    expect(scroller?.contains(showAll)).toBe(false);
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
