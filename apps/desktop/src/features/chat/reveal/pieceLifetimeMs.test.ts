import { describe, expect, it } from 'vitest';
import { pieceLifetimeMs } from './pieceLifetimeMs';
import { REVEAL_PACE } from './revealNumbers';

const table = (rows: number): string =>
  ['| Step | Time |', '|---|---|', ...Array.from({ length: rows }, () => '| Add | 40 ms |')].join(
    '\n',
  );

describe('pieceLifetimeMs', () => {
  it('is the fade for plain text', () => {
    expect(pieceLifetimeMs({ text: 'alpha beta gamma' })).toBe(REVEAL_PACE.fadeMs);
  });

  it('adds one stagger per body row of a table', () => {
    expect(pieceLifetimeMs({ text: table(3) })).toBe(
      REVEAL_PACE.fadeMs + 3 * REVEAL_PACE.rowStaggerMs,
    );
  });

  it('caps the stagger on a long table', () => {
    expect(pieceLifetimeMs({ text: table(40) })).toBe(
      REVEAL_PACE.fadeMs + REVEAL_PACE.maxStaggerRows * REVEAL_PACE.rowStaggerMs,
    );
  });

  it('ignores a lone pipe line', () => {
    expect(pieceLifetimeMs({ text: '| one\ntwo' })).toBe(REVEAL_PACE.fadeMs);
  });
});
