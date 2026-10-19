import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { revealPacer } from './revealPacer';

const KEY = 'run-harborline-1:text-3';
const OTHER_KEY = 'run-northwind-2:text-1';

const WORDS = Array.from({ length: 400 }, (_, index) => `word${index}`).join(' ');

const TABLE = '| Step | Time |\n|---|---|\n| Add | 40 ms |\n| Fill | 6 min |\n| Swap | 1 min |';

const cutOf = (key = KEY): number => revealPacer.snapshotOf({ key })?.cut ?? -1;

const track = (text: string, isComplete = true, key = KEY): void =>
  revealPacer.track({ key, text, isComplete, startCut: 0 });

describe('revealPacer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    revealPacer.reset();
  });

  afterEach(() => {
    revealPacer.reset();
    vi.useRealTimers();
  });

  it('starts hidden and writes in at least the floor pace', () => {
    track(WORDS);
    expect(cutOf()).toBe(0);
    vi.advanceTimersByTime(100);
    expect(cutOf()).toBeGreaterThan(0);
  });

  it('shows a whole message of any length in under 1.6 s', () => {
    track(WORDS);
    vi.advanceTimersByTime(1599);
    expect(cutOf()).toBe(WORDS.length);
    expect(revealPacer.snapshotOf({ key: KEY })?.isRevealing).toBe(true);
    vi.advanceTimersByTime(300);
    expect(revealPacer.snapshotOf({ key: KEY })?.isRevealing).toBe(false);
  });

  it('is never slower than the model: a fast delta stream stays within the lag cap', () => {
    let text = '';
    const sent: number[] = [];
    for (let step = 0; step < 40; step += 1) {
      text += `${'x'.repeat(30)} `;
      track(text, false);
      sent.push(text.length);
      vi.advanceTimersByTime(50);
    }
    const lagged = sent[sent.length - 31]!;
    expect(cutOf()).toBeGreaterThanOrEqual(lagged);
  });

  it('shows a piece that arrived 1.5 s ago in the next frame whatever the pace', () => {
    const text = `${'a'.repeat(200)} ${'b'.repeat(200)}`;
    track(text, false);
    vi.advanceTimersByTime(200);
    expect(cutOf()).toBeLessThan(text.length);
    vi.advanceTimersByTime(1400);
    expect(cutOf()).toBeGreaterThanOrEqual(200);
  });

  it('moves the cut only to word ends', () => {
    track(WORDS);
    for (let frame = 0; frame < 60; frame += 1) {
      vi.advanceTimersByTime(16);
      const cut = cutOf();
      const isEnd = cut === WORDS.length || cut === 0 || WORDS[cut] === ' ';
      expect(isEnd).toBe(true);
    }
  });

  it('commits at most once per frame', () => {
    track(WORDS);
    const listener = vi.fn();
    revealPacer.subscribe({ key: KEY, listener });
    vi.advanceTimersByTime(160);
    expect(listener.mock.calls.length).toBeLessThanOrEqual(11);
  });

  it('keeps pieces for the fade and then drops them', () => {
    track(WORDS);
    vi.advanceTimersByTime(48);
    const pieces = revealPacer.snapshotOf({ key: KEY })?.pieces ?? [];
    expect(pieces.length).toBeGreaterThan(0);
    vi.advanceTimersByTime(2000);
    expect(revealPacer.snapshotOf({ key: KEY })?.pieces).toEqual([]);
  });

  it('keeps a table hidden while it may still grow, then shows it whole', () => {
    const open = `Plan:\n\n${TABLE}\n`;
    track(open, false);
    vi.advanceTimersByTime(2000);
    expect(cutOf()).toBeLessThanOrEqual('Plan:\n\n'.length);
    track(`${open}\nAfter the table we ship `, false);
    vi.advanceTimersByTime(2000);
    expect(cutOf()).toBeGreaterThanOrEqual(`Plan:\n\n${TABLE}`.length);
  });

  it('holds the words after a table until its rows have faded in', () => {
    const tableEnd = `Plan:\n\n${TABLE}`.length;
    track(`Plan:\n\n${TABLE}\n\nAfter the table we ship ${WORDS}`);
    for (let frame = 0; frame < 200 && cutOf() < tableEnd; frame += 1) {
      vi.advanceTimersByTime(16);
    }
    expect(cutOf()).toBe(tableEnd);
    vi.advanceTimersByTime(300);
    expect(cutOf()).toBe(tableEnd);
    vi.advanceTimersByTime(100);
    expect(cutOf()).toBeGreaterThan(tableEnd);
  });

  it('keeps the rows of a table alive for the stagger and the fade', () => {
    const tableEnd = `Plan:\n\n${TABLE}`.length;
    track(`Plan:\n\n${TABLE}`);
    for (let frame = 0; frame < 200 && cutOf() < tableEnd; frame += 1) {
      vi.advanceTimersByTime(16);
    }
    vi.advanceTimersByTime(300);
    expect(revealPacer.snapshotOf({ key: KEY })?.pieces.length).toBeGreaterThan(0);
    vi.advanceTimersByTime(1000);
    expect(revealPacer.snapshotOf({ key: KEY })?.pieces).toEqual([]);
  });

  it('resumes pacing from the cut when a delta arrives after the reveal ended', () => {
    track('alpha beta gamma ', false);
    vi.advanceTimersByTime(2000);
    const before = cutOf();
    expect(before).toBeGreaterThan(0);
    track('alpha beta gamma delta epsilon ', false);
    expect(cutOf()).toBe(before);
    vi.advanceTimersByTime(300);
    expect(cutOf()).toBeGreaterThan(before);
  });

  it('holds the unfinished last word of a stream and settles it after the idle time', () => {
    track('alpha beta gam', false);
    vi.advanceTimersByTime(2000);
    expect(cutOf()).toBe('alpha beta'.length);
    vi.advanceTimersByTime(1500);
    expect(cutOf()).toBe('alpha beta gam'.length);
  });

  it('shows the last word at once when the text is complete', () => {
    track('alpha beta gam', true);
    vi.advanceTimersByTime(1500);
    expect(cutOf()).toBe('alpha beta gam'.length);
  });

  it('flush finishes one text at once and leaves the others', () => {
    track(WORDS);
    track(WORDS, true, OTHER_KEY);
    revealPacer.flush({ key: KEY });
    expect(cutOf()).toBe(WORDS.length);
    expect(cutOf(OTHER_KEY)).toBe(0);
  });

  it('flushRun finishes every text of that run only', () => {
    track(WORDS);
    track(WORDS, true, OTHER_KEY);
    revealPacer.flushRun({ runId: 'run-harborline-1' });
    expect(cutOf()).toBe(WORDS.length);
    expect(cutOf(OTHER_KEY)).toBe(0);
  });

  it('a text that shrinks is shown whole', () => {
    track(WORDS);
    track('short text', true);
    expect(cutOf()).toBe('short text'.length);
  });

  it('a start cut keeps what was already on screen', () => {
    revealPacer.track({ key: KEY, text: 'alpha beta gamma delta', isComplete: true, startCut: 11 });
    expect(cutOf()).toBe(11);
  });

  it('stops its loop when nothing is live', () => {
    track(WORDS);
    vi.advanceTimersByTime(3000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows every live text whole when the loop fails', () => {
    track(WORDS);
    const throwing = vi.fn().mockImplementationOnce(() => {
      throw new Error('listener failed');
    });
    revealPacer.subscribe({ key: KEY, listener: throwing });
    vi.advanceTimersByTime(100);
    expect(cutOf()).toBe(WORDS.length);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('release forgets the text', () => {
    track(WORDS);
    revealPacer.release({ key: KEY });
    expect(revealPacer.snapshotOf({ key: KEY })).toBeNull();
  });
});
