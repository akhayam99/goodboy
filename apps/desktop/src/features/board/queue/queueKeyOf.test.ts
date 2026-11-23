// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { queueKeyOf, type QueueBand } from './queueKeyOf';

type KeyParams = {
  readonly key: string;
  readonly band: QueueBand;
  readonly isTyping?: boolean;
  readonly isOnControl?: boolean;
  readonly hasModifier?: boolean;
};

const commandOf = ({
  key,
  band,
  isTyping = false,
  isOnControl = false,
  hasModifier = false,
}: KeyParams) => queueKeyOf({ key, band, isTyping, isOnControl, hasModifier });

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
    ['ready', ' ', 'mark'],
    ['ready', 'm', 'merge-train'],
    ['ready', 'M', 'merge-train'],
    ['needs-you', 'm', null],
    ['running', 'm', null],
  ] as const)('in %s, %j does %s', (band, key, kind) => {
    expect(commandOf({ key, band })?.kind ?? null).toBe(kind);
  });

  it('moves inside the active band with j, k and the arrows', () => {
    for (const band of ['needs-you', 'running', 'ready'] as const) {
      expect(commandOf({ key: 'j', band })).toEqual({ kind: 'step', delta: 1 });
      expect(commandOf({ key: 'ArrowUp', band })).toEqual({ kind: 'step', delta: -1 });
    }
  });

  it('passes to the next band with F6, even from a field', () => {
    expect(commandOf({ key: 'F6', band: 'running', isTyping: true })?.kind).toBe('next-band');
  });

  it('lets letters type in a field and leaves a modified key to the app', () => {
    expect(commandOf({ key: 's', band: 'needs-you', isTyping: true })).toBeNull();
    expect(commandOf({ key: 'Enter', band: 'needs-you', isTyping: true })).toBeNull();
    expect(commandOf({ key: 'j', band: 'ready', hasModifier: true })).toBeNull();
  });

  it('leaves Enter and Space to the button that has the focus', () => {
    expect(commandOf({ key: 'Enter', band: 'needs-you', isOnControl: true })).toBeNull();
    expect(commandOf({ key: ' ', band: 'running', isOnControl: true })).toBeNull();
    expect(commandOf({ key: 'j', band: 'needs-you', isOnControl: true })?.kind).toBe('step');
  });
});
