// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { queueKeyOf, type QueueBand } from './queueKeyOf';

type KeyParams = {
  readonly key: string;
  readonly band: QueueBand;
  readonly isTyping?: boolean;
};

const commandOf = ({ key, band, isTyping = false }: KeyParams) =>
  queueKeyOf({ key, band, isTyping, hasModifier: false })?.kind ?? null;

describe('the Queue keys, one band at a time', () => {
  it.each([
    ['needs-you', 'Enter', 'primary'],
    ['needs-you', 's', 'not-now'],
    ['needs-you', '2', 'choice'],
    ['needs-you', 'ArrowRight', 'open'],
    ['needs-you', ' ', null],
    ['running', ' ', 'peek'],
    ['running', 'ArrowRight', 'open'],
    ['running', 'Enter', null],
    ['running', 's', null],
    ['ready', 'ArrowRight', 'open'],
    ['ready', 'Enter', null],
    ['ready', '1', null],
  ] as const)('in %s, %j does %s', (band, key, kind) => {
    expect(commandOf({ key, band })).toBe(kind);
  });

  it('moves inside the active band with j, k and the arrows', () => {
    for (const band of ['needs-you', 'running', 'ready'] as const) {
      expect(queueKeyOf({ key: 'j', band, isTyping: false, hasModifier: false })).toEqual({
        kind: 'step',
        delta: 1,
      });
      expect(queueKeyOf({ key: 'ArrowUp', band, isTyping: false, hasModifier: false })).toEqual({
        kind: 'step',
        delta: -1,
      });
    }
  });

  it('passes to the next band with F6, even from a field', () => {
    expect(commandOf({ key: 'F6', band: 'running', isTyping: true })).toBe('next-band');
  });

  it('lets letters type in a field and leaves a modified key to the app', () => {
    expect(commandOf({ key: 's', band: 'needs-you', isTyping: true })).toBeNull();
    expect(commandOf({ key: 'Enter', band: 'needs-you', isTyping: true })).toBeNull();
    expect(queueKeyOf({ key: 'j', band: 'ready', isTyping: false, hasModifier: true })).toBeNull();
  });
});
