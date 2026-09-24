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
import {
  ActivityFilterButton,
  PANEL_EXPECTED_HEIGHT,
  PANEL_FOOTER_HEIGHT,
} from './ActivityFilterButton';

const REM_IN_PX = 16;

const SCROLLER_CAP_CLASS = 'max-h-[min(70vh,20rem)]';

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

  it('holds plans, reports and wireframes as chips on one row under Artifacts', () => {
    const onToggle = vi.fn();
    open({ onToggle });
    const artifactsRow = screen.getByRole('menuitemcheckbox', { name: 'Artifacts' });
    const plansChip = screen.getByRole('menuitemcheckbox', { name: 'Plans' });
    const reportsChip = screen.getByRole('menuitemcheckbox', { name: 'Reports' });
    const wireframesChip = screen.getByRole('menuitemcheckbox', { name: 'Wireframes' });
    const chipRow = artifactsRow.nextElementSibling;

    expect(chipRow?.className).toContain('flex-wrap');
    expect(Array.from(chipRow?.children ?? [])).toEqual([plansChip, reportsChip, wireframesChip]);

    fireEvent.click(reportsChip);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'reports', enabled: false });
    fireEvent.click(artifactsRow);
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'artifacts', enabled: false });
  });

  it('disables every artifact chip while Artifacts is hidden', () => {
    const onToggle = vi.fn();
    open({ filter: { ...DEFAULT_ACTIVITY_FILTER, artifacts: false }, onToggle });
    const artifactsRow = screen.getByRole('menuitemcheckbox', { name: 'Artifacts' });
    const chipRow = artifactsRow.nextElementSibling;
    const chips = Array.from(chipRow?.children ?? []);

    expect(chips).toHaveLength(3);
    expect(chips.every((chip) => chip.hasAttribute('disabled'))).toBe(true);
    expect(chips.every((chip) => chip.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(chipRow?.className).toContain('opacity-50');
    chips.forEach((chip) => fireEvent.click(chip));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('keeps an off chip on a bordered ground so it never reads as a caption', () => {
    open({ filter: { ...DEFAULT_ACTIVITY_FILTER, reports: false } });
    const reportsChip = screen.getByRole('menuitemcheckbox', { name: 'Reports' });

    expect(reportsChip.getAttribute('aria-checked')).toBe('false');
    expect(reportsChip.className).toContain('border-border-soft');
    expect(reportsChip.className).toContain('bg-elevated');
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

  it('puts a subagent chip on the row under Workflows and under Agents', () => {
    open();
    const workflowsRow = screen.getByRole('menuitemcheckbox', { name: 'Workflows' });
    const agentsRow = screen.getByRole('menuitemcheckbox', { name: 'Agents' });
    expect(workflowsRow.nextElementSibling?.firstElementChild?.getAttribute('aria-label')).toBe(
      'Workflow subagents',
    );
    expect(agentsRow.nextElementSibling?.firstElementChild?.getAttribute('aria-label')).toBe(
      'Agent subagents',
    );
  });

  it('flips a subagent flag from its chip', () => {
    const onToggle = vi.fn();
    open({ onToggle });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Workflow subagents' }));
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'workflowSubagents', enabled: false });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Agent subagents' }));
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'agentSubagents', enabled: false });
  });

  it('leaves the sibling chips alone when one chip is flipped', () => {
    const onToggle = vi.fn();
    open({ onToggle });
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Wireframes' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith({ toggle: 'wireframes', enabled: false });
  });

  it('disables the chip and reads it as off while its parent is hidden', () => {
    const onToggle = vi.fn();
    open({ filter: { ...DEFAULT_ACTIVITY_FILTER, workflows: false }, onToggle });
    const chip = screen.getByRole('menuitemcheckbox', { name: 'Workflow subagents' });
    expect(chip.hasAttribute('disabled')).toBe(true);
    expect(chip.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(chip);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('scrolls the rows inside a capped panel and keeps the footer out of that scroll', () => {
    open();
    const menu = screen.getByRole('menu');
    const rows = screen.getAllByRole('menuitemcheckbox');
    const first = rows[0];
    const showAll = screen.getByRole('menuitem', { name: 'Show all' });
    const scroller = first?.closest('.overflow-y-auto') ?? null;

    expect(scroller).not.toBeNull();
    expect(scroller?.className).toContain(SCROLLER_CAP_CLASS);
    expect(menu.className).not.toContain('max-h-');
    expect(rows.every((row) => scroller?.contains(row) === true)).toBe(true);
    expect(scroller?.contains(showAll)).toBe(false);
  });

  it('asks the dropdown for the height the capped scroller and the footer actually take', () => {
    open();
    const scroller = screen.getAllByRole('menuitemcheckbox')[0]?.closest('.overflow-y-auto');
    const cap = /max-h-\[min\(70vh,(\d+)rem\)\]/.exec(scroller?.className ?? '');

    expect(cap).not.toBeNull();
    expect(Number(cap?.[1]) * REM_IN_PX + PANEL_FOOTER_HEIGHT).toBe(PANEL_EXPECTED_HEIGHT);
  });

  it('paints the panel scrollbar at rest so a cut row announces itself before the pointer arrives', () => {
    open();
    const scroller = screen.getAllByRole('menuitemcheckbox')[0]?.closest('.overflow-y-auto');

    expect(scroller?.className).not.toContain('[scrollbar-width:none]');
    expect(scroller?.className).not.toContain('[&::-webkit-scrollbar]:hidden');
    expect(scroller?.className).toContain('[&::-webkit-scrollbar-thumb]:bg-border/60');
  });

  it('drops the gradient that used to veil the last row', () => {
    open();
    const menu = screen.getByRole('menu');

    expect(menu.querySelectorAll('[class*="bg-gradient-to-t"]')).toHaveLength(0);
    expect(menu.querySelectorAll('[class*="bg-gradient-to-b"]')).toHaveLength(0);
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
    expect(row.querySelector('svg')?.getAttribute('class')).toContain('text-primary');
  });

  it('keeps the glyph of an inactive row', () => {
    open({ filter: { ...DEFAULT_ACTIVITY_FILTER, decisions: false } });
    const row = screen.getByRole('menuitemcheckbox', { name: 'Decisions' });
    expect(row.querySelector('svg')).not.toBeNull();
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
  });
});
