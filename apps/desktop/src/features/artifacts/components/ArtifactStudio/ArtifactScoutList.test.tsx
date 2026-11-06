// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId } from '@goodboy/types';
import { ArtifactScoutList } from './ArtifactScoutList';
import type { ArtifactScoutRow } from '../../artifactScoutRoster';

afterEach(cleanup);

const REASON = 'the batch list and the exception drawer already exist in this repo';

const row: ArtifactScoutRow = {
  key: 'agent-scout-screens',
  name: 'screens and routes',
  state: 'done',
  detail: '14s',
  claims: '8 of 11 claims verified',
  root: '/mock/harborline/ledger-core-rounding',
  branch: 'ak/fix-posting-rounding',
  reason: REASON,
  agentId: 'agent-scout-screens' as AgentId,
};

import { asCutText, tooltipTextOf } from '../../../../__tests__/helpers/tooltip';

describe('ArtifactScoutList', () => {
  it('gives the reason its own line instead of the one the state competes for', () => {
    render(<ArtifactScoutList rows={[row]} emptyLine="nothing read anything" />);
    const entry = screen.getByTestId('artifact-scout-row');
    const reason = screen.getByTestId('artifact-scout-reason');
    const summary = entry.firstElementChild;

    expect(reason.textContent).toBe(`${REASON.charAt(0).toUpperCase()}${REASON.slice(1)}`);
    expect(summary?.contains(reason)).toBe(false);
    expect(summary?.textContent).toContain('Screens and routes');
    expect(summary?.textContent).toContain('Done · 14s · 8 of 11 claims verified');
    expect(entry.className).toContain('flex-col');
  });

  it('keeps the whole reason reachable when the line has to truncate', () => {
    render(<ArtifactScoutList rows={[row]} emptyLine="nothing read anything" />);
    const reason = screen.getByTestId('artifact-scout-reason');
    expect(reason.getAttribute('title')).toBeNull();
    expect(tooltipTextOf({ element: asCutText({ element: reason }) })).toBe(
      `${REASON.charAt(0).toUpperCase()}${REASON.slice(1)}`,
    );
    expect(reason.className).toContain('truncate');
  });

  it('names the worktree by its leaf and keeps the whole root in the title', () => {
    render(<ArtifactScoutList rows={[row]} emptyLine="nothing read anything" />);
    const where = screen.getByText('ledger-core-rounding on ak/fix-posting-rounding');
    expect(where.getAttribute('title')).toBeNull();
    expect(tooltipTextOf({ element: asCutText({ element: where }) })).toBe(
      '/mock/harborline/ledger-core-rounding',
    );
  });

  it('spends no second line on a scout the plan recorded no reason for', () => {
    render(
      <ArtifactScoutList
        rows={[{ ...row, reason: null, root: null, branch: null }]}
        emptyLine="nothing read anything"
      />,
    );
    expect(screen.queryByTestId('artifact-scout-reason')).toBeNull();
    expect(screen.getByTestId('artifact-scout-row').textContent).toContain('Screens and routes');
  });

  it('opens the agent from its row when the page can take you there', () => {
    const onOpen = vi.fn();
    render(<ArtifactScoutList rows={[row]} emptyLine="nothing read anything" onOpen={onOpen} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Screens and routes' }));

    expect(onOpen).toHaveBeenCalledWith({ agentId: 'agent-scout-screens' });
  });

  it('leaves a planned scout without an agent as plain text', () => {
    render(
      <ArtifactScoutList
        rows={[{ ...row, agentId: null, state: 'planned' }]}
        emptyLine="nothing read anything"
        onOpen={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws plain rows when nothing opens', () => {
    render(<ArtifactScoutList rows={[row]} emptyLine="nothing read anything" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says the session read no repository when there is no scout at all', () => {
    render(<ArtifactScoutList rows={[]} emptyLine="no scout read a repository for this one" />);
    expect(screen.getByTestId('artifact-scouts-empty').textContent).toBe(
      'No scout read a repository for this one',
    );
    expect(screen.queryByTestId('artifact-scouts')).toBeNull();
  });
});
