// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { updateCardCopy, updatePillLabel } from './updateCardCopy';

describe('updateCardCopy', () => {
  it('names the version in the title of the available, ready and failed cards', () => {
    expect(
      updateCardCopy({ state: 'available', version: '0.27.2', runningCount: 0, failure: null })
        .title,
    ).toBe('Goodboy 0.27.2 is available');
    expect(
      updateCardCopy({ state: 'ready', version: '0.27.2', runningCount: 0, failure: null }).title,
    ).toBe('Goodboy 0.27.2 is ready');
    expect(
      updateCardCopy({
        state: 'failed',
        version: '0.27.2',
        runningCount: 0,
        failure: { phase: 'download', message: 'The download was cut off.' },
      }),
    ).toEqual({
      title: 'Goodboy 0.27.2 did not install',
      body: 'Nothing changed on this Mac.',
      detail: 'The download was cut off.',
    });
  });

  it('counts the running agents from one line, singular and plural', () => {
    expect(
      updateCardCopy({ state: 'running', version: '0.27.2', runningCount: 1, failure: null }).title,
    ).toBe('1 agent is running');
    expect(
      updateCardCopy({ state: 'running', version: '0.27.2', runningCount: 2, failure: null }).title,
    ).toBe('2 agents are running');
    expect(
      updateCardCopy({ state: 'queued', version: '0.27.2', runningCount: 1, failure: null }).title,
    ).toBe('Restarts when the agent finishes');
  });

  it('falls back when the version is unknown', () => {
    expect(
      updateCardCopy({ state: 'ready', version: null, runningCount: 0, failure: null }).title,
    ).toBe('The update is ready');
  });
});

describe('updatePillLabel', () => {
  it('carries the state the pill leaves out, so the pill keeps only the version', () => {
    expect(updatePillLabel({ state: 'ready', version: '0.27.2', runningCount: 0 })).toBe(
      'Goodboy 0.27.2 is ready',
    );
    expect(updatePillLabel({ state: 'running', version: '0.27.2', runningCount: 2 })).toBe(
      'Goodboy 0.27.2 is ready',
    );
    expect(updatePillLabel({ state: 'queued', version: '0.27.2', runningCount: 2 })).toBe(
      'Restarts when 2 agents finish',
    );
  });
});
