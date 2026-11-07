// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, DEFAULT_WORKFLOW_RULES, type SessionId, type WorkspaceId } from '@goodboy/types';
import { EMPTY_OVERRIDES } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import { useAutoTreeLimit } from '.';

const HARBORLINE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION = brandId<SessionId>({ value: 'session-harborline' });

type ProbeParams = {
  readonly sessionId?: SessionId | null;
};

const Probe = ({ sessionId = null }: ProbeParams) => {
  const { view, start, settle } = useAutoTreeLimit({ workspaceId: HARBORLINE, sessionId });
  return (
    <div>
      <p data-testid="usd">{String(view.usd)}</p>
      <p data-testid="session">{String(view.isFromSession)}</p>
      <p data-testid="start">{String(start().usd)}</p>
      <button type="button" onClick={() => view.change(9)}>
        change
      </button>
      <button type="button" onClick={settle}>
        settle
      </button>
    </div>
  );
};

type RunDefaultParams = {
  readonly usd: number | null;
};

const withRunDefault = ({ usd }: RunDefaultParams): void => {
  useAppStore.setState({
    workspaceOverrides: {
      [HARBORLINE]: {
        ...EMPTY_OVERRIDES,
        workflowRules: { ...DEFAULT_WORKFLOW_RULES, spendLimitUsd: usd },
      },
    },
  });
};

beforeEach(() => {
  useAppStore.setState({ workspaceOverrides: {}, workspaceValues: {}, sessionBudgets: {} });
});

afterEach(cleanup);

describe('useAutoTreeLimit', () => {
  it('shows the Run defaults amount tagged as the default', () => {
    withRunDefault({ usd: 6 });
    render(<Probe />);

    expect(screen.getByTestId('usd').textContent).toBe('6');
  });

  it('ignores a leftover auto.treeLimitUsd value in the store', () => {
    withRunDefault({ usd: 6 });
    useAppStore.setState({ workspaceValues: { [HARBORLINE]: { 'auto.treeLimitUsd': '12' } } });
    render(<Probe />);

    expect(screen.getByTestId('usd').textContent).toBe('6');
  });

  it('has no limit when Run defaults has none', () => {
    withRunDefault({ usd: null });
    render(<Probe />);

    expect(screen.getByTestId('usd').textContent).toBe('null');
  });

  it('starts with an amount typed on the run and keeps it for a retry', () => {
    withRunDefault({ usd: 6 });
    render(<Probe />);

    fireEvent.click(screen.getByText('change'));

    expect(screen.getByTestId('usd').textContent).toBe('9');
    expect(screen.getByTestId('start').textContent).toBe('9');
  });

  it('forgets the typed amount after settle and shows the default again', () => {
    withRunDefault({ usd: 6 });
    render(<Probe />);
    fireEvent.click(screen.getByText('change'));

    fireEvent.click(screen.getByText('settle'));

    expect(screen.getByTestId('usd').textContent).toBe('6');
  });

  it('follows a smaller session budget', () => {
    withRunDefault({ usd: 6 });
    useAppStore.setState({
      sessionBudgets: {
        [SESSION]: { sessionId: SESSION, softCapUsd: 2, onExceed: 'pause', warnRatio: 0.8 },
      },
    });
    render(<Probe sessionId={SESSION} />);

    expect(screen.getByTestId('usd').textContent).toBe('2');
    expect(screen.getByTestId('session').textContent).toBe('true');
  });

  it('does not follow a smaller session budget that only warns', () => {
    useAppStore.setState({
      sessionBudgets: {
        [SESSION]: { sessionId: SESSION, softCapUsd: 2, onExceed: 'warn', warnRatio: 0.8 },
      },
    });
    render(<Probe sessionId={SESSION} />);

    expect(screen.getByTestId('usd').textContent).toBe('null');
    expect(screen.getByTestId('session').textContent).toBe('false');
  });

  it('keeps the smaller run default under a larger session budget', () => {
    withRunDefault({ usd: 5 });
    useAppStore.setState({
      sessionBudgets: {
        [SESSION]: { sessionId: SESSION, softCapUsd: 25, onExceed: 'pause', warnRatio: 0.8 },
      },
    });
    render(<Probe sessionId={SESSION} />);

    expect(screen.getByTestId('usd').textContent).toBe('5');
    expect(screen.getByTestId('session').textContent).toBe('false');
  });
});
