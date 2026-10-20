// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { runHeadCardOf } from './runHeadCardOf';
import { runAgentCardOf } from './runAgentCardOf';

describe('the Agents tree run cards', () => {
  it('titles a run head card with the run and says its state in the dot tone', () => {
    const card = runHeadCardOf({ name: 'Fix and verify', dot: 'needsYou', word: 'Plan ready' });

    expect(card.title).toBe('Fix and verify');
    expect(card.state).toEqual({ tone: 'warning', words: 'Plan ready', isRunning: false });
    expect(card.facts).toEqual([]);
  });

  it('pulses the state of a running run head', () => {
    expect(
      runHeadCardOf({ name: 'Fix and verify', dot: 'running', word: 'Running' }).state,
    ).toEqual({ tone: 'info', words: 'Running', isRunning: true });
  });

  it('titles a run agent card with the agent and maps its row tone', () => {
    const card = runAgentCardOf({
      name: 'Tester',
      kind: 'tester',
      tone: 'success',
      word: 'Done',
      isRunning: false,
    });

    expect(card.title).toBe('Tester');
    expect(card.state).toEqual({ tone: 'ok', words: 'Done', isRunning: false });
  });
});
