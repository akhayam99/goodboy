// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AgentRole } from '@goodboy/types';

import { RoleSelect } from '.';

afterEach(() => {
  cleanup();
});

describe('RoleSelect', () => {
  it('offers every role in a workspace', () => {
    render(<RoleSelect value={'custom' as AgentRole} onChange={vi.fn()} disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Custom/i }));
    const options = within(screen.getByRole('listbox', { name: 'Agent role' }));

    expect(options.getAllByRole('button').map((option) => option.textContent)).toEqual([
      'Scout',
      'Planner',
      'Implementer',
      'Reviewer',
      'Tester',
      'Debugger',
      'Custom',
    ]);
  });

  it('offers every role once the workspace becomes a dev project', () => {
    render(<RoleSelect value={'custom' as AgentRole} onChange={vi.fn()} disabled={false} />);

    fireEvent.click(screen.getByRole('button', { name: /Custom/i }));
    const options = within(screen.getByRole('listbox', { name: 'Agent role' }));

    expect(options.getAllByRole('button').map((option) => option.textContent)).toEqual([
      'Scout',
      'Planner',
      'Implementer',
      'Reviewer',
      'Tester',
      'Debugger',
      'Custom',
    ]);
  });
});
