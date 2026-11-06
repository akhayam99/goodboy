// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { THINKING_PHRASE } from '../../utils/livePhraseOf';
import { conversationStopOf } from './conversationStopOf';
import type { ConversationLive, ConversationStop } from '../../../../shared/types/conversationStop';
import { DockLiveLine } from './DockLiveLine';

afterEach(cleanup);

const LIVE: ConversationLive = {
  phrase: 'Running pnpm install',
  startedAt: null,
  waitingFor: null,
  stepAgentId: null,
};

const stopOf = (overrides: Partial<ConversationStop> = {}): ConversationStop => ({
  label: 'Stop',
  phase: 'idle',
  sentence: null,
  stop: vi.fn(),
  ...overrides,
});

const renderLine = ({
  live = LIVE,
  stop = stopOf(),
  isStopArmed = false,
}: {
  readonly live?: ConversationLive;
  readonly stop?: ConversationStop;
  readonly isStopArmed?: boolean;
}) => render(<DockLiveLine live={live} stop={stop} isStopArmed={isStopArmed} />);

describe('DockLiveLine', () => {
  it('says what runs and names what Stop stops', () => {
    const stop = stopOf({ label: 'Stop Auto and 2 agents', sentence: 'Implementer running' });
    renderLine({ stop });

    screen.getByText('Implementer running');
    fireEvent.click(screen.getByRole('button', { name: 'Stop Auto and 2 agents' }));
    expect(stop.stop).toHaveBeenCalledOnce();
  });

  it('reads the waiting phrase over a thinking phrase', () => {
    renderLine({ live: { ...LIVE, phrase: THINKING_PHRASE, waitingFor: 'Tester' } });

    screen.getByText('Waiting for Tester');
  });

  it('turns busy on Stopping, and keeps its label off the row', () => {
    renderLine({ stop: stopOf({ phase: 'stopping' }) });

    screen.getByText('Stopping', { selector: '[role="status"]' });
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
    const line = document.querySelector<HTMLElement>('[data-dock-live]');
    expect(line?.getAttribute('data-stop-phase')).toBe('stopping');
  });

  it('offers Force stop once the exit takes too long, and it asks again', () => {
    const stop = stopOf({ phase: 'stalled' });
    renderLine({ stop });

    screen.getByText('Still stopping');
    fireEvent.click(screen.getByRole('button', { name: 'Force stop' }));
    expect(stop.stop).toHaveBeenCalledOnce();
  });

  it('shows Esc again to stop only while the first Esc is armed', () => {
    const { container } = renderLine({});
    expect(within(container).queryByText('Esc again to stop')).toBeNull();
    cleanup();

    renderLine({ isStopArmed: true });
    screen.getByText('Esc again to stop');
  });
});

describe('conversationStopOf', () => {
  const agentStop = { phase: 'idle' as const, isLive: true, isBlocked: false, stop: vi.fn() };

  it('prefers the scope the conversation names', () => {
    const scoped = stopOf({ label: 'Stop Auto' });

    expect(
      conversationStopOf({ agentStop, scoped, stopLabel: null, isRunning: true, sentence: null }),
    ).toBe(scoped);
  });

  it('offers no Stop when nothing runs', () => {
    expect(
      conversationStopOf({
        agentStop: { ...agentStop, isLive: false },
        scoped: null,
        stopLabel: null,
        isRunning: false,
        sentence: null,
      }),
    ).toBeNull();
  });

  it('stops the reply on a step page with the label the page gives', () => {
    const stop = conversationStopOf({
      agentStop,
      scoped: null,
      stopLabel: 'Stop this reply',
      isRunning: true,
      sentence: 'Implementer running step 2',
    });

    expect(stop?.label).toBe('Stop this reply');
    expect(stop?.sentence).toBe('Implementer running step 2');
    expect(stop?.stop).toBe(agentStop.stop);
  });

  it('keeps Stop beside a permission ask, saying what the agent waits for', () => {
    const stop = conversationStopOf({
      agentStop: { ...agentStop, isBlocked: true },
      scoped: null,
      stopLabel: null,
      isRunning: false,
      sentence: null,
    });

    expect(stop?.label).toBe('Stop');
    expect(stop?.sentence).toBe('Asking you');
    expect(stop?.stop).toBe(agentStop.stop);
  });

  it('keeps Stop during the start of a turn, before the run is live', () => {
    const stop = conversationStopOf({
      agentStop: { ...agentStop, isLive: false },
      scoped: null,
      stopLabel: null,
      isRunning: true,
      sentence: null,
    });

    expect(stop?.label).toBe('Stop');
  });
});
