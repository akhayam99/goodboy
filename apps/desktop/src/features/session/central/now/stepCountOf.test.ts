import { describe, expect, it } from 'vitest';
import { stepCountOf } from './stepCountOf';

describe('the step count of a short run', () => {
  it('counts the steps that started over the steps of the run', () => {
    expect(stepCountOf({ started: 1, total: 2 })).toBe('1/2');
  });

  it('keeps a stopped or waiting step counted as started', () => {
    expect(stepCountOf({ started: 2, total: 2 })).toBe('2/2');
  });

  it('says 0 before the first step starts', () => {
    expect(stepCountOf({ started: 0, total: 2 })).toBe('0/2');
  });

  it('never goes over the steps of the run', () => {
    expect(stepCountOf({ started: 3, total: 2 })).toBe('2/2');
  });
});
