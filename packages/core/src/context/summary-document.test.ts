import { describe, expect, it } from 'vitest';
import {
  parseSummaryDocument,
  serializeSummaryDocument,
  type SummarySectionKey,
} from './summary-document';

const roundTrip = (text: string): string =>
  serializeSummaryDocument({ document: parseSummaryDocument({ text }) });

const sectionKeys = (text: string): ReadonlyArray<SummarySectionKey | null> =>
  parseSummaryDocument({ text }).blocks.map((block) => block.sectionKey);

const bodyOf = (text: string, sectionKey: SummarySectionKey): string | null =>
  parseSummaryDocument({ text }).blocks.find((block) => block.sectionKey === sectionKey)?.body ??
  null;

const CANONICAL = [
  '#### Problem',
  'auth middleware rejects valid tokens.',
  '',
  '#### Learned',
  '- clock skew between issuer and verifier.',
  '- tolerance is configurable.',
  '',
  '#### State',
  '- patch drafted.',
  '',
  '#### Next',
  '- add regression test.',
].join('\n');

const MISSING_STATE = [
  '#### Problem',
  'the summarizer drops sections.',
  '',
  '#### Learned',
  '- only 22 of 35 real summaries carry all four headings.',
  '',
  '#### Next',
  '- decide what to do about the other 13.',
].join('\n');

const EXTRA_HEADING = [
  '#### Problem',
  'rows render squashed.',
  '',
  '#### Learned',
  '- gap owns separation.',
  '',
  '#### Risks',
  '- the parser could drop this section.',
  '',
  '#### State',
  '- in review.',
  '',
  '#### Next',
  '- ship it.',
].join('\n');

const WITH_PREAMBLE = [
  '**pending:** user confirms fix scope before implementation starts.',
  '',
  '#### Problem',
  'the preamble has nowhere to live.',
  '',
  '#### State',
  '- preserved as its own block.',
].join('\n');

const FENCED_HEADING = [
  '#### Problem',
  'the markdown parser sees headings inside fences.',
  '',
  '#### Learned',
  '- a fence can hold anything:',
  '',
  '```md',
  '#### State',
  'this is sample copy, not a section.',
  '```',
  '',
  '#### Next',
  '- keep the fence intact.',
].join('\n');

const LEGACY_BOLD_LABELS = [
  '**root cause corrected:** `ResultView.tsx:63` fall-through renders blank.',
  '',
  '**plan proposed:** (1) recovery UI fallback, (2) error-status signaling.',
  '',
  '**tests:** none yet',
].join('\n');

const CORPUS = {
  canonical: CANONICAL,
  missingState: MISSING_STATE,
  extraHeading: EXTRA_HEADING,
  withPreamble: WITH_PREAMBLE,
  fencedHeading: FENCED_HEADING,
  legacyBoldLabels: LEGACY_BOLD_LABELS,
  empty: '',
  blank: '   ',
  headingOnly: '#### Problem',
  trailingBlank: '#### Problem\nsomething\n\n',
  crlf: '#### Problem\r\nsomething\r\n',
  deepHeading: '### State\n- a level-3 heading still names the section.',
  duplicateHeading: '#### State\n- first\n\n#### State\n- second',
  closingHashes: '#### Problem ####\nsomething',
  colonTitle: '#### Next:\n- with a colon',
  indentedPseudoHeading: '#### Learned\n- a fact\n\n    #### State\n    indented four spaces',
  hashesWithoutSeparator: '#### State####\n- the hashes belong to the title',
  onlyHashesAfterMarker: '#### ####\n- nothing but hashes',
  noisyTitle: '#### Next: .\n- trailing colon, space and stop',
} satisfies Record<string, string>;

describe('parseSummaryDocument', () => {
  it('finds the four known sections in a canonical document', () => {
    expect(sectionKeys(CORPUS.canonical)).toEqual(['problem', 'learned', 'state', 'next']);
    expect(bodyOf(CORPUS.canonical, 'state')).toBe('- patch drafted.\n');
  });

  it('reports a missing section as absent rather than inventing it', () => {
    expect(sectionKeys(CORPUS.missingState)).toEqual(['problem', 'learned', 'next']);
    expect(bodyOf(CORPUS.missingState, 'state')).toBeNull();
  });

  it('keeps an unrecognised heading as its own block', () => {
    expect(sectionKeys(CORPUS.extraHeading)).toEqual(['problem', 'learned', null, 'state', 'next']);
    const extra = parseSummaryDocument({ text: CORPUS.extraHeading }).blocks[2];
    expect(extra?.title).toBe('Risks');
    expect(extra?.body).toBe('- the parser could drop this section.\n');
  });

  it('keeps text before the first heading as a headingless block', () => {
    const blocks = parseSummaryDocument({ text: CORPUS.withPreamble }).blocks;
    expect(blocks[0]?.headingLine).toBeNull();
    expect(blocks[0]?.sectionKey).toBeNull();
    expect(blocks[0]?.body).toContain('**pending:**');
    expect(sectionKeys(CORPUS.withPreamble)).toEqual([null, 'problem', 'state']);
  });

  it('does not treat a heading inside a code fence as a section', () => {
    expect(sectionKeys(CORPUS.fencedHeading)).toEqual(['problem', 'learned', 'next']);
    expect(bodyOf(CORPUS.fencedHeading, 'learned')).toContain('#### State');
  });

  it('does not treat an indented pseudo heading as a section', () => {
    expect(sectionKeys(CORPUS.indentedPseudoHeading)).toEqual(['learned']);
  });

  it('reads a legacy bold-label document as one preserved block', () => {
    const blocks = parseSummaryDocument({ text: CORPUS.legacyBoldLabels }).blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.headingLine).toBeNull();
    expect(blocks[0]?.body).toBe(CORPUS.legacyBoldLabels);
  });

  it('yields no blocks for an empty document', () => {
    expect(parseSummaryDocument({ text: '' }).blocks).toEqual([]);
  });

  it('matches a known section at any heading level, and by a noisy title', () => {
    expect(sectionKeys(CORPUS.deepHeading)).toEqual(['state']);
    expect(sectionKeys(CORPUS.closingHashes)).toEqual(['problem']);
    expect(sectionKeys(CORPUS.colonTitle)).toEqual(['next']);
  });

  it('lets only the first of two identical headings claim the section', () => {
    expect(sectionKeys(CORPUS.duplicateHeading)).toEqual(['state', null]);
  });

  it('treats closing hashes as a title unless whitespace separates them', () => {
    expect(sectionKeys(CORPUS.hashesWithoutSeparator)).toEqual([null]);
    expect(parseSummaryDocument({ text: CORPUS.hashesWithoutSeparator }).blocks[0]?.title).toBe(
      'State####',
    );
    expect(parseSummaryDocument({ text: CORPUS.onlyHashesAfterMarker }).blocks[0]?.title).toBe(
      '####',
    );
  });

  it('matches a section through several trailing punctuation marks', () => {
    expect(sectionKeys(CORPUS.noisyTitle)).toEqual(['next']);
    expect(parseSummaryDocument({ text: CORPUS.noisyTitle }).blocks[0]?.title).toBe('Next: .');
  });
});

describe('summary document round trip', () => {
  it.each(Object.entries(CORPUS))('rebuilds %s byte for byte', (_name, text) => {
    expect(roundTrip(text)).toBe(text);
  });
});

const LINE_SHAPES = [
  '#### Problem',
  '#### Learned',
  '#### State',
  '#### Next',
  '#### Risks',
  '### State',
  '##### deep',
  '',
  '   ',
  'plain sentence with no marker.',
  '- a bullet',
  '  - a nested bullet',
  '**bold label:** with a value',
  '```md',
  '```',
  '    #### indented four spaces',
  '#',
  '#not a heading',
] as const;

const nextSeed = ({ seed }: { readonly seed: number }): number =>
  (seed * 1103515245 + 12345) % 2147483648;

describe('summary document round trip over generated documents', () => {
  it('rebuilds every generated combination of real line shapes byte for byte', () => {
    let seed = 7;
    let checked = 0;
    for (let document = 0; document < 3000; document += 1) {
      seed = nextSeed({ seed });
      const length = seed % 14;
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
