// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { THEME_NAMES, tokenOf } from '../../../test/styleTokens';
import { GUTTER_FILL, LINE_FILL, SELECTED_FILL, SELECTED_RAIL, WORD_FILL } from './lineTone';

const TOKEN = /(?:bg-|var\(--color-)([a-z-]+)/;

type TokenNameParams = { readonly classes: string };

const tokenNameOf = ({ classes }: TokenNameParams): string => {
  const match = classes.match(TOKEN);
  if (match === null) {
    throw new Error(`no colour token in ${classes}`);
  }
  return String(match[1]);
};

describe('diff line tone', () => {
  it('paints added and removed lines and words with the diff tokens', () => {
    expect(tokenNameOf({ classes: LINE_FILL.add })).toBe('diff-add-line');
    expect(tokenNameOf({ classes: LINE_FILL.del })).toBe('diff-remove-line');
    expect(tokenNameOf({ classes: WORD_FILL.add })).toBe('diff-add-word');
    expect(tokenNameOf({ classes: WORD_FILL.del })).toBe('diff-remove-word');
    expect(LINE_FILL.context).toBe('');
    expect(WORD_FILL.context).toBe('');
  });

  it('paints the line number column of an added and a removed line with its own step', () => {
    expect(tokenNameOf({ classes: GUTTER_FILL.add })).toBe('diff-add-gutter');
    expect(tokenNameOf({ classes: GUTTER_FILL.del })).toBe('diff-remove-gutter');
    expect(GUTTER_FILL.context).toBe('');
  });

  it('marks the selected line with the primary steps', () => {
    expect(tokenNameOf({ classes: SELECTED_FILL })).toBe('primary-subtle');
    expect(tokenNameOf({ classes: SELECTED_RAIL })).toBe('primary-solid');
  });

  it('reads every token it names from styles.css in both themes', () => {
    const classes = [
      LINE_FILL.add,
      LINE_FILL.del,
      GUTTER_FILL.add,
      GUTTER_FILL.del,
      WORD_FILL.add,
      WORD_FILL.del,
    ];
    const names = [...classes, SELECTED_FILL, SELECTED_RAIL].map((each) =>
      tokenNameOf({ classes: each }),
    );
    for (const theme of THEME_NAMES) {
      for (const name of names) {
        expect(() => tokenOf({ theme, name })).not.toThrow();
      }
    }
  });
});
