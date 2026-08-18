import { describe, expect, it } from 'vitest';
import {
  appendDecision,
  parseDecisions,
  removeDecision,
  replaceDecision,
  serializeDecisions,
} from './decisions-document';

const roundTrip = (text: string): string =>
  serializeDecisions({ segments: parseDecisions({ text }).segments });

const rowTexts = (text: string): ReadonlyArray<string> =>
  parseDecisions({ text }).rows.map((row) => row.text);

const BULLETED = [
  '- use jwt for auth',
  '',
  '- keep the refresh token in memory only',
  '',
  '- soft delete via `deletedAt` timestamp',
].join('\n');

const TIGHT_BULLETS = ['- first', '- second', '- third'].join('\n');

const BULLETLESS = [
  '**Props/Params naming (FINAL):** Components `type Props`, hooks `type Params`.',
  '',
  '**Back buttons navigate to logical parent:** window.history.back() reserved for detours.',
  '',
  'Patient ID and therapy record created in the local database.',
].join('\n');

const NESTED = [
  '- the resolver keeps one thread per comment',
  '  - the marker carries the thread id',
  '  - a missing marker blocks the publish',
  '',
  '- the lens order is Overview then Context',
].join('\n');

const WRAPPED = ['- a decision whose prose', '  continues on a second line', '', '- another'].join(
  '\n',
);

const FENCED = [
  '- the protocol marker looks like this:',
  '',
  '```',
  '- not a decision',
  'plain line inside a fence',
  '```',
  '',
  '- and the publish blocks without it',
].join('\n');

const CORPUS = {
  bulleted: BULLETED,
  tightBullets: TIGHT_BULLETS,
  bulletless: BULLETLESS,
  nested: NESTED,
  wrapped: WRAPPED,
  fenced: FENCED,
  empty: '',
  blank: '   ',
  singleRow: '- only one',
  trailingBlanks: '- one\n\n',
  leadingBlanks: '\n\n- one',
  crlf: '- one\r\n\r\n- two\r\n',
  starBullets: '* one\n\n* two',
  numbered: '1. one\n2. two',
  mixedMarkers: '- one\n\nplain two\n\n* three',
} satisfies Record<string, string>;

describe('parseDecisions', () => {
  it('reads one bullet as one row and strips the marker', () => {
    expect(rowTexts(CORPUS.bulleted)).toEqual([
      'use jwt for auth',
      'keep the refresh token in memory only',
      'soft delete via `deletedAt` timestamp',
    ]);
  });

  it('reads a bulletless document as one row per line', () => {
    expect(rowTexts(CORPUS.bulletless)).toHaveLength(3);
    expect(rowTexts(CORPUS.bulletless)[0]).toContain('**Props/Params naming (FINAL):**');
  });

  it('keeps a nested bullet inside the row that owns it', () => {
    const rows = parseDecisions({ text: CORPUS.nested }).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]?.text).toBe(
      'the resolver keeps one thread per comment\n  - the marker carries the thread id\n  - a missing marker blocks the publish',
    );
    expect(rows[0]?.isMultiline).toBe(true);
    expect(rows[1]?.isMultiline).toBe(false);
  });

  it('keeps a wrapped continuation line inside its row', () => {
    const rows = parseDecisions({ text: CORPUS.wrapped }).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]?.text).toBe('a decision whose prose\n  continues on a second line');
  });

  it('does not read a bullet inside a code fence as a row', () => {
    const document = parseDecisions({ text: CORPUS.fenced });
    expect(document.rows).toHaveLength(2);
    expect(document.rows[0]?.text).toBe('the protocol marker looks like this:');
    expect(document.rows[1]?.text).toBe('and the publish blocks without it');
  });

  it('reports content that no row can reach', () => {
    expect(parseDecisions({ text: CORPUS.fenced }).hasContentOutsideRows).toBe(true);
    expect(parseDecisions({ text: CORPUS.bulleted }).hasContentOutsideRows).toBe(false);
    expect(parseDecisions({ text: CORPUS.nested }).hasContentOutsideRows).toBe(false);
    expect(parseDecisions({ text: '' }).hasContentOutsideRows).toBe(false);
  });

  it('strips star and numbered markers too', () => {
    expect(rowTexts(CORPUS.starBullets)).toEqual(['one', 'two']);
    expect(rowTexts(CORPUS.numbered)).toEqual(['one', 'two']);
  });

  it('yields no rows for an empty document', () => {
    expect(parseDecisions({ text: '' }).rows).toEqual([]);
    expect(parseDecisions({ text: '   ' }).rows).toEqual([]);
  });
});

describe('decisions document round trip', () => {
  it.each(Object.entries(CORPUS))('rebuilds %s byte for byte', (_name, text) => {
    expect(roundTrip(text)).toBe(text);
  });
});

const LINE_SHAPES = [
  '- a bullet',
  '* a star bullet',
  '1. a numbered item',
  'a plain line',
  '**a bold label:** with a value',
  '  - a nested bullet',
  '  a continuation line',
  '',
  '   ',
  '```',
  '- inside a fence',
] as const;

const nextSeed = ({ seed }: { readonly seed: number }): number =>
  (seed * 1103515245 + 12345) % 2147483648;

describe('decisions document round trip over generated documents', () => {
  it('rebuilds every generated combination of real line shapes byte for byte', () => {
    let seed = 11;
    let checked = 0;
    for (let document = 0; document < 3000; document += 1) {
      seed = nextSeed({ seed });
      const length = seed % 12;
      const lines: string[] = [];
      for (let line = 0; line < length; line += 1) {
        seed = nextSeed({ seed });
        lines.push(LINE_SHAPES[seed % LINE_SHAPES.length] ?? '');
      }
      const text = lines.join('\n');
      expect(roundTrip(text)).toBe(text);
      checked += 1;
    }
    expect(checked).toBe(3000);
  });
});

describe('replaceDecision', () => {
  it('rewrites one row and leaves the others byte identical', () => {
    const updated = replaceDecision({ text: CORPUS.bulleted, index: 0, decision: 'use paseto' });
    expect(updated).toBe(CORPUS.bulleted.replace('use jwt for auth', 'use paseto'));
    expect(rowTexts(updated)[1]).toBe('keep the refresh token in memory only');
    expect(rowTexts(updated)[2]).toBe('soft delete via `deletedAt` timestamp');
  });

  it('addresses a row by its own index, not by its position among the rows', () => {
    const rows = parseDecisions({ text: CORPUS.bulleted }).rows;
    expect(rows.map((row) => row.index)).toEqual([0, 2, 4]);
  });

  it('keeps the row marker the document already uses', () => {
    expect(replaceDecision({ text: CORPUS.starBullets, index: 0, decision: 'edited' })).toBe(
      '* edited\n\n* two',
    );
    expect(replaceDecision({ text: CORPUS.bulletless, index: 0, decision: 'edited' })).toBe(
      CORPUS.bulletless.replace(
        '**Props/Params naming (FINAL):** Components `type Props`, hooks `type Params`.',
        'edited',
      ),
    );
  });

  it('keeps a multi-line decision in one row', () => {
    const updated = replaceDecision({
      text: CORPUS.nested,
      index: 0,
      decision: 'one thread per comment\n  - the id is injected into the prompt',
    });
    const rows = parseDecisions({ text: updated }).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]?.text).toBe('one thread per comment\n  - the id is injected into the prompt');
  });

  it('refuses a blank decision and an index that names no row', () => {
    expect(replaceDecision({ text: CORPUS.bulleted, index: 0, decision: '  ' })).toBe(
      CORPUS.bulleted,
    );
    expect(replaceDecision({ text: CORPUS.bulleted, index: 1, decision: 'x' })).toBe(
      CORPUS.bulleted,
    );
    expect(replaceDecision({ text: CORPUS.bulleted, index: 99, decision: 'x' })).toBe(
      CORPUS.bulleted,
    );
  });
});

describe('removeDecision', () => {
  it('removes a row and the blank line that separated it', () => {
    const updated = removeDecision({ text: CORPUS.bulleted, index: 2 });
    expect(updated).toBe(
      ['- use jwt for auth', '', '- soft delete via `deletedAt` timestamp'].join('\n'),
    );
  });

  it('removes the last row without leaving a trailing blank', () => {
    const updated = removeDecision({ text: CORPUS.bulleted, index: 4 });
    expect(updated).toBe(
      ['- use jwt for auth', '', '- keep the refresh token in memory only'].join('\n'),
    );
  });

  it('removes the only row and leaves nothing behind', () => {
    expect(removeDecision({ text: CORPUS.singleRow, index: 0 })).toBe('');
  });

  it('takes a nested bullet away with the row that owns it', () => {
    const updated = removeDecision({ text: CORPUS.nested, index: 0 });
    expect(updated).toBe('- the lens order is Overview then Context');
    expect(updated).not.toContain('the marker carries the thread id');
  });

  it('leaves a fenced block alone when a neighbouring row goes', () => {
    const updated = removeDecision({ text: CORPUS.fenced, index: 4 });
    expect(updated).toContain('```\n- not a decision');
  });

  it('ignores an index that names no row', () => {
    expect(removeDecision({ text: CORPUS.bulleted, index: 1 })).toBe(CORPUS.bulleted);
    expect(removeDecision({ text: CORPUS.bulleted, index: 99 })).toBe(CORPUS.bulleted);
  });
});

describe('appendDecision', () => {
  it('adds a row after the last one, matching the separation in use', () => {
    expect(appendDecision({ text: CORPUS.bulleted, decision: 'ship it' })).toBe(
      `${CORPUS.bulleted}\n\n- ship it`,
    );
    expect(appendDecision({ text: CORPUS.tightBullets, decision: 'fourth' })).toBe(
      `${CORPUS.tightBullets}\n- fourth`,
    );
  });

  it('matches the marker the document already uses', () => {
    expect(appendDecision({ text: CORPUS.starBullets, decision: 'three' })).toBe(
      '* one\n\n* two\n\n* three',
    );
    expect(appendDecision({ text: CORPUS.bulletless, decision: 'a new one' })).toBe(
      `${CORPUS.bulletless}\n\na new one`,
    );
  });

  it('starts a bulleted list in an empty document', () => {
    expect(appendDecision({ text: '', decision: 'the first one' })).toBe('- the first one');
    expect(appendDecision({ text: '   ', decision: 'the first one' })).toBe('- the first one');
  });

  it('does not accumulate trailing blank lines', () => {
    expect(appendDecision({ text: CORPUS.trailingBlanks, decision: 'two' })).toBe('- one\n- two');
  });

  it('refuses a blank decision', () => {
    expect(appendDecision({ text: CORPUS.bulleted, decision: '  \n ' })).toBe(CORPUS.bulleted);
  });

  it('never drops the content it appends to', () => {
    const updated = appendDecision({ text: CORPUS.fenced, decision: 'a new one' });
    expect(updated.startsWith(CORPUS.fenced)).toBe(true);
    expect(rowTexts(updated)).toHaveLength(3);
  });
});
