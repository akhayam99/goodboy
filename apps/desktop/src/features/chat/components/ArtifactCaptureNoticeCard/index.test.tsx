// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: { sendTurn: vi.fn(async () => undefined) },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { ArtifactCaptureNoticeCard, REPAIR_PROMPT } from './index';

const item = {
  kind: 'artifact_capture_failed' as const,
  key: 'artifact-capture-1',
  code: 'invalid_json',
  message: 'the artifact body is not valid JSON',
  runId: 'run-1' as never,
};

beforeEach(() => {
  state.sendTurn.mockClear();
});
afterEach(cleanup);

describe('ArtifactCaptureNoticeCard', () => {
  it('renders collapsed by default', () => {
    render(<ArtifactCaptureNoticeCard item={item} />);
    const header = screen.getByTestId('artifact-capture-notice');
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /retry capture/i })).toBeNull();
  });

  it('sends one bounded repair prompt and then disables the action', () => {
    render(
      <ArtifactCaptureNoticeCard
        item={item}
        sessionId={'sess-1' as never}
        agentId={'agent-1' as never}
      />,
    );
    fireEvent.click(screen.getByTestId('artifact-capture-notice'));
    expect(screen.getByText('the artifact body is not valid JSON')).toBeDefined();
    const retry = screen.getByRole('button', { name: /retry capture/i });
    fireEvent.click(retry);
    expect(state.sendTurn).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      agentId: 'agent-1',
      content: REPAIR_PROMPT,
    });
    fireEvent.click(retry);
    expect(state.sendTurn).toHaveBeenCalledTimes(1);
    expect(screen.getByText('repair requested')).toBeDefined();
  });

  it('cannot repair without an agent in scope', () => {
    render(<ArtifactCaptureNoticeCard item={item} sessionId={'sess-1' as never} />);
    fireEvent.click(screen.getByTestId('artifact-capture-notice'));
    fireEvent.click(screen.getByRole('button', { name: /retry capture/i }));
    expect(state.sendTurn).not.toHaveBeenCalled();
  });
});
