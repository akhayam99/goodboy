// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { WorkspaceProfile } from '@goodboy/types';
import { ProfileForm } from './index';

const EMPTY: WorkspaceProfile = { roles: [], aboutWork: null, workingRules: null, explainMore: [] };

const Harness = ({
  initial = EMPTY,
  onCommit,
}: {
  readonly initial?: WorkspaceProfile;
  readonly onCommit: (profile: WorkspaceProfile) => void;
}) => {
  const [value, setValue] = useState(initial);
  return <ProfileForm value={value} onChange={setValue} onCommit={onCommit} />;
};

afterEach(cleanup);

describe('ProfileForm', () => {
  it('suggests library roles grouped as you type and adds the highlighted one on Enter', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Your roles' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'sre' } });
    const list = screen.getByRole('listbox', { name: 'Your roles suggestions' });
    expect(within(list).getByText('Engineering')).toBeDefined();
    expect(within(list).getByRole('option', { name: 'Site Reliability Engineer' })).toBeDefined();
    expect(within(list).getByRole('option', { name: 'Add "sre" as your own role' })).toBeDefined();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ roles: ['Site Reliability Engineer'] }),
    );
    expect(screen.getByRole('button', { name: 'Remove Site Reliability Engineer' })).toBeDefined();
  });

  it('adds a custom role that is not in the library', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Your roles' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Payments steward' } });
    fireEvent.click(
      screen.getByRole('option', { name: 'Add "Payments steward" as your own role' }),
    );

    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ roles: ['Payments steward'] }),
    );
  });

  it('removes a role with its chip button', () => {
    const onCommit = vi.fn();
    render(<Harness initial={{ ...EMPTY, roles: ['Tech Lead', 'Founder'] }} onCommit={onCommit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Tech Lead' }));

    expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ roles: ['Founder'] }));
  });

  it('adds a free topic on Enter without a suggestion list', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('combobox', { name: 'Explain more when it touches' });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Kubernetes' } });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ explainMore: ['Kubernetes'] }),
    );
  });

  it('commits the text fields when they lose focus', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const rules = screen.getByLabelText('How agents should work with you');

    fireEvent.change(rules, { target: { value: 'Ask before touching migrations.' } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(rules);

    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ workingRules: 'Ask before touching migrations.' }),
    );
  });

  it('shows who reads which field', () => {
    render(<Harness onCommit={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'See who reads what' }));
    const table = screen.getByRole('dialog', { name: 'Who reads what' });
    const implementerRow = within(table).getByRole('row', { name: /Implementer, Tester, Docs/ });
    expect(
      within(implementerRow)
        .getAllByRole('cell')
        .map((cell) => cell.getAttribute('aria-label')),
    ).toEqual(['reads', 'does not read', 'reads', 'does not read']);
  });
});
