import { describe, expect, it } from 'vitest';
import { summarizeStagedAnswers } from '.';

describe('summarizeStagedAnswers', () => {
  it('pairs every question with the answer staged for it', () => {
    expect(
      summarizeStagedAnswers({
        entries: [
          { text: 'Use Postgres or SQLite?', answer: 'Postgres' },
          { text: 'Redis or Memcached?', answer: 'Redis' },
        ],
      }),
    ).toBe('Use Postgres or SQLite? → Postgres · Redis or Memcached? → Redis');
  });

  it('drops the questions left unanswered', () => {
    expect(
      summarizeStagedAnswers({
        entries: [
          { text: 'first', answer: '' },
          { text: 'second', answer: 'yes' },
        ],
      }),
    ).toBe('second → yes');
  });

  it('collapses the whitespace a multiline question carries', () => {
    expect(summarizeStagedAnswers({ entries: [{ text: 'pick\n  one', answer: ' a \n b ' }] })).toBe(
      'pick one → a b',
    );
  });

  it('returns an empty line when nothing is staged', () => {
    expect(summarizeStagedAnswers({ entries: [] })).toBe('');
  });
});
