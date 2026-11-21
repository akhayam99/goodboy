import { describe, expect, it } from 'vitest';
import { couldntLoadTitle } from './couldntLoadTitle';

describe('couldntLoadTitle', () => {
  it('names one thing', () => {
    expect(couldntLoadTitle({ labels: ['pull requests'] })).toBe("Couldn't load pull requests");
  });

  it('joins two things with and', () => {
    expect(couldntLoadTitle({ labels: ['pull requests', 'review throughput'] })).toBe(
      "Couldn't load pull requests and review throughput",
    );
  });

  it('joins three things with a serial and', () => {
    expect(couldntLoadTitle({ labels: ['limits', 'budget alerts', 'session telemetry'] })).toBe(
      "Couldn't load limits, budget alerts, and session telemetry",
    );
  });
});
