// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AgentRole } from '@goodboy/types';

import { RoleSelect } from '.';

afterEach(() => {
  cleanup();
});

const openRoles = () => {
  render(<RoleSelect value={'custom' as AgentRole} onChange={vi.fn()} disabled={false} />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Agent role' }));
  return within(screen.getByRole('listbox', { name: 'Agent role' }));
};

describe('RoleSelect', () => {
  it('offers exactly the picker-eligible roles', () => {
    const options = openRoles();

    expect(options.getAllByRole('option').map((option) => option.dataset.value)).toEqual([
      'scout',
      'investigator',
      'planner',
      'implementer',
      'reviewer',
      'tester',
      'resolver',
      'docs',
      'custom',
    ]);
    expect(options.getByRole('option', { name: /^Debugger/ })).toBeDefined();
    expect(options.getByRole('option', { name: /^Generalist/ })).toBeDefined();
  });

  it('omits artifact roles from the manual picker', () => {
    const options = openRoles();

    expect(options.queryByRole('option', { name: /^Report/ })).toBeNull();
    expect(options.queryByRole('option', { name: /^Wireframe/ })).toBeNull();
  });

  it('marks the current role without a primary tint', () => {
    const options = openRoles();
    const custom = options.getByRole('option', { name: /^Generalist/ });

    expect(custom.getAttribute('aria-selected')).toBe('true');
    expect(custom.className).not.toContain('primary');
  });

  it('chooses a role and closes', () => {
    const onChange = vi.fn();
    render(<RoleSelect value={'custom' as AgentRole} onChange={onChange} disabled={false} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Agent role' }));
    fireEvent.click(screen.getByRole('option', { name: /^Planner/ }));

    expect(onChange).toHaveBeenCalledWith('planner');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
