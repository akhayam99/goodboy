// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { aDelegation } from '../../testing/autoViewFixtures';
import { spawnRecordOf, type SpawnRecordModel } from '../spawnRecordOf';
import { SpawnRecord } from './index';

afterEach(cleanup);

const recordOf = (): SpawnRecordModel => {
  const base = aDelegation({ key: 'tester', role: 'tester', state: 'running' });
  const record = spawnRecordOf({
    agentId: 'agent-tester',
    number: '4',
    delegations: [{ ...base, request: { ...base.request, roleReason: 'Tests only.' } }],
  });
  if (record === null) {
    throw new Error('record missing');
  }
  return record;
};

describe('SpawnRecord', () => {
  it('shows the eight fields and Not recorded without a snapshot', () => {
    render(<SpawnRecord record={recordOf()} onClose={vi.fn()} onOpenTranscript={vi.fn()} />);
    for (const name of [
      'Why',
      'Brief',
      'Role',
      'Model',
      'Went in',
      'Done when',
      'Result',
      'Attempts',
    ]) {
      expect(screen.getByText(name).tagName).toBe('DT');
    }
    expect(screen.getByText('Went in').nextElementSibling?.textContent).toBe('Not recorded');
    expect(screen.getByText('Still working.').tagName).toBe('DD');
  });

  it('puts the role reason next to the role even when thin', () => {
    render(<SpawnRecord record={recordOf()} onClose={vi.fn()} onOpenTranscript={vi.fn()} />);
    expect(screen.getByText('Role').nextElementSibling?.textContent).toBe('Tester · Tests only.');
  });

  it('opens the transcript of the agent and closes on Escape', () => {
    const onOpenTranscript = vi.fn();
    const onClose = vi.fn();
    render(
      <SpawnRecord record={recordOf()} onClose={onClose} onOpenTranscript={onOpenTranscript} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open transcript' }));
    expect(onOpenTranscript).toHaveBeenCalledWith({ agentId: 'agent-tester' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
