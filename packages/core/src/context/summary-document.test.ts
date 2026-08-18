import { describe, expect, it } from 'vitest';
import {
  insertSummarySection,
  parseSummaryDocument,
  replaceSummarySectionBody,
  serializeSummaryDocument,
  SUMMARY_SECTION_KEYS,
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

describe('replaceSummarySectionBody', () => {
  it('rewrites one section and leaves every other byte untouched', () => {
    const parsed = parseSummaryDocument({ text: CORPUS.canonical });
    const state = parsed.blocks.find((block) => block.sectionKey === 'state');
    const updated = replaceSummarySectionBody({
      text: CORPUS.canonical,
      index: state?.index ?? -1,
      body: '- patch merged, regression test green.\n',
    });

    expect(updated).toBe(
      CORPUS.canonical.replace('- patch drafted.', '- patch merged, regression test green.'),
    );
    for (const key of ['problem', 'learned', 'next'] satisfies ReadonlyArray<SummarySectionKey>) {
      expect(bodyOf(updated, key)).toBe(bodyOf(CORPUS.canonical, key));
    }
  });

  it('never rewrites the heading of the section being edited', () => {
    const updated = replaceSummarySectionBody({
      text: CORPUS.deepHeading,
      index: 0,
      body: '- rewritten',
    });
    expect(updated).toBe('### State\n- rewritten');
  });

  it('leaves an unknown block editable without touching the known sections', () => {
    const parsed = parseSummaryDocument({ text: CORPUS.extraHeading });
    const risks = parsed.blocks[2];
    const updated = replaceSummarySectionBody({
      text: CORPUS.extraHeading,
      index: risks?.index ?? -1,
      body: '- handled.\n',
    });
    expect(updated).toContain('#### Risks\n- handled.\n');
    expect(bodyOf(updated, 'state')).toBe(bodyOf(CORPUS.extraHeading, 'state'));
  });

  it('rewrites a headingless preamble in place', () => {
    const updated = replaceSummarySectionBody({
      text: CORPUS.withPreamble,
      index: 0,
      body: 'rewritten preamble\n',
    });
    expect(updated.startsWith('rewritten preamble\n\n#### Problem')).toBe(true);
  });

  it('ignores an index that names no block', () => {
    expect(replaceSummarySectionBody({ text: CORPUS.canonical, index: 99, body: 'x' })).toBe(
      CORPUS.canonical,
    );
  });
});

describe('insertSummarySection', () => {
  it('places a missing section in canonical order', () => {
    const updated = insertSummarySection({
      text: CORPUS.missingState,
      sectionKey: 'state',
      body: '- freshly written.',
    });
    expect(sectionKeys(updated)).toEqual(['problem', 'learned', 'state', 'next']);
    expect(updated).toContain('#### State\n- freshly written.\n\n#### Next');
  });

  it('appends a section that has no successor', () => {
    const updated = insertSummarySection({
      text: '#### Problem\nsomething',
      sectionKey: 'next',
      body: '- later.',
    });
    expect(updated).toBe('#### Problem\nsomething\n\n#### Next\n- later.');
  });

  it('refuses to add a second copy of a section that already exists', () => {
    expect(
      insertSummarySection({ text: CORPUS.canonical, sectionKey: 'state', body: '- other' }),
    ).toBe(CORPUS.canonical);
  });

  it('keeps a legacy preamble above the section it adds', () => {
    const updated = insertSummarySection({
      text: CORPUS.legacyBoldLabels,
      sectionKey: 'problem',
      body: 'stated at last.',
    });
    expect(updated.startsWith(CORPUS.legacyBoldLabels)).toBe(true);
    expect(sectionKeys(updated)).toEqual([null, 'problem']);
  });

  it('covers every known section key', () => {
    for (const sectionKey of SUMMARY_SECTION_KEYS) {
      const updated = insertSummarySection({ text: '', sectionKey, body: 'body' });
      expect(sectionKeys(updated)).toEqual([sectionKey]);
    }
  });
});
