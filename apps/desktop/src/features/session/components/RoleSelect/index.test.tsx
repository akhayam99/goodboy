// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AgentRole } from '@goodboy/types';

import { RoleSelect } from '.';

afterEach(() => {
  cleanup();
});

describe('RoleSelect', () => {
  it('offers exactly the picker-eligible roles', () => {
    render(<RoleSelect value={'custom' as AgentRole} onChange={vi.fn()} disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Generalist/i }));
    const options = within(screen.getByRole('listbox', { name: 'Agent role' }));

    expect(options.getAllByRole('button').map((option) => option.textContent)).toEqual([
      'Scout',
      'Debugger',
      'Planner',
      'Implementer',
      'Reviewer',
      'Tester',
      'Resolver',
      'Docs',
      'Generalist',
    ]);
  });

  it('omits artifact roles from the manual picker', () => {
    render(<RoleSelect value={'custom' as AgentRole} onChange={vi.fn()} disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Generalist/i }));
    const options = within(screen.getByRole('listbox', { name: 'Agent role' }));

    expect(options.queryByRole('button', { name: 'Report' })).toBeNull();
    expect(options.queryByRole('button', { name: 'Wireframe' })).toBeNull();
  });
});
