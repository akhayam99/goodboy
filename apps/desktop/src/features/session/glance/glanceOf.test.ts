// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NAMES } from '../../../shared/utils/names';
import { glanceOf, type GlanceState } from './glanceOf';

const WORDS: ReadonlyArray<readonly [GlanceState, string]> = [
  ['waiting', NAMES.needsYou],
  ['running', NAMES.running],
  ['queued', NAMES.queued],
  ['ready', NAMES.ready],
  ['paused', NAMES.paused],
  ['failed', NAMES.failed],
  ['stopping', NAMES.stopping],
  ['stopped', NAMES.stopped],
  ['done', NAMES.done],
  ['idle', NAMES.idle],
  ['skipped', NAMES.skipped],
];

describe('glanceOf', () => {
  it.each(WORDS)('reads the word of %s from the one table of words', (state, word) => {
    expect(glanceOf({ state, sentence: '' }).word).toBe(word);
  });

  it('keeps the words of the table free of Stuck, Blocked, Working and Planning', () => {
    const words = WORDS.map(([, word]) => word);

    expect(words).not.toContain('Stuck');
    expect(words).not.toContain('Blocked');
    expect(words).not.toContain('Working');
    expect(words).not.toContain('Planning');
  });

  it('paints a limit amber and an error red, and pulses only what runs', () => {
    expect(glanceOf({ state: 'paused', sentence: '' }).tone).toBe('warning');
    expect(glanceOf({ state: 'failed', sentence: '' }).tone).toBe('danger');
    expect(glanceOf({ state: 'running', sentence: '' }).isLive).toBe(true);
    expect(glanceOf({ state: 'queued', sentence: '' }).isLive).toBe(false);
  });

  it('lets a plan gate say Needs approval over the table word', () => {
    expect(glanceOf({ state: 'waiting', sentence: '', word: NAMES.needsApproval }).word).toBe(
      'Needs approval',
    );
  });
});
