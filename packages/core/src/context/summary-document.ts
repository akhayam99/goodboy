export const SUMMARY_SECTION_KEYS = ['problem', 'learned', 'state', 'next'] as const;

export type SummarySectionKey = (typeof SUMMARY_SECTION_KEYS)[number];

export const SUMMARY_SECTION_TITLES = {
  problem: 'Problem',
  learned: 'Learned',
  state: 'State',
  next: 'Next',
} satisfies Record<SummarySectionKey, string>;

export type SummaryBlock = {
  readonly index: number;
  readonly sectionKey: SummarySectionKey | null;
  readonly title: string;
  readonly headingLine: string | null;
  readonly body: string | null;
};

export type SummaryDocument = {
  readonly blocks: ReadonlyArray<SummaryBlock>;
};

const HEADING_LINE = /^ {0,3}(#{1,6})[ \t]+(\S.*)$/;
const CLOSING_HASHES = /[ \t]+#+[ \t]*$/;
const FENCE_LINE = /^ {0,3}(?:```|~~~)/;
const TITLE_NOISE = /[:.\s]+$/;

const SECTION_BY_TITLE = new Map<string, SummarySectionKey>(
  SUMMARY_SECTION_KEYS.map((key) => [key, key]),
);

type Segment = {
  readonly headingLine: string | null;
  readonly lines: ReadonlyArray<string>;
};

type LinesParams = {
  readonly lines: ReadonlyArray<string>;
};

const splitSegments = ({ lines }: LinesParams): ReadonlyArray<Segment> => {
  const segments: Array<{ headingLine: string | null; lines: string[] }> = [];
  let isFenced = false;

  for (const line of lines) {
    if (FENCE_LINE.test(line)) {
      isFenced = !isFenced;
    }
    const heading = isFenced ? null : HEADING_LINE.exec(line);
    if (heading != null) {
      segments.push({ headingLine: line, lines: [] });
      continue;
    }
    const current = segments.at(-1);
    if (current == null) {
      segments.push({ headingLine: null, lines: [line] });
      continue;
    }
    current.lines.push(line);
  }

  return segments;
};

type TitleParams = {
  readonly headingLine: string;
};

const titleOf = ({ headingLine }: TitleParams): string => {
  const heading = HEADING_LINE.exec(headingLine);
  if (heading == null) {
    return '';
  }
  return (heading[2] ?? '').replace(CLOSING_HASHES, '').trim();
};

type NormalizeParams = {
  readonly title: string;
};

const normalizeTitle = ({ title }: NormalizeParams): string =>
  title.replace(TITLE_NOISE, '').trim().toLowerCase();

type TextParams = {
  readonly text: string;
};

export const parseSummaryDocument = ({ text }: TextParams): SummaryDocument => {
  if (text === '') {
    return { blocks: [] };
  }

  const claimed = new Set<SummarySectionKey>();
  const blocks = splitSegments({ lines: text.split('\n') }).map((segment, index) => {
    const body = segment.lines.length > 0 ? segment.lines.join('\n') : null;
    if (segment.headingLine == null) {
      return { index, sectionKey: null, title: '', headingLine: null, body };
    }
    const title = titleOf({ headingLine: segment.headingLine });
    const known = SECTION_BY_TITLE.get(normalizeTitle({ title }));
    if (known == null || claimed.has(known)) {
      return { index, sectionKey: null, title, headingLine: segment.headingLine, body };
    }
    claimed.add(known);
    return { index, sectionKey: known, title, headingLine: segment.headingLine, body };
  });

  return { blocks };
};

type DocumentParams = {
  readonly document: SummaryDocument;
};

export const serializeSummaryDocument = ({ document }: DocumentParams): string => {
  const lines: string[] = [];
  for (const block of document.blocks) {
    if (block.headingLine != null) {
      lines.push(block.headingLine);
    }
    if (block.body != null) {
      lines.push(...block.body.split('\n'));
    }
  }
  return lines.join('\n');
};

type ReplaceParams = {
  readonly text: string;
  readonly index: number;
  readonly body: string;
};

export const replaceSummarySectionBody = ({ text, index, body }: ReplaceParams): string => {
  const document = parseSummaryDocument({ text });
  const blocks = document.blocks.map((block) =>
    block.index === index ? { ...block, body } : block,
  );
  return serializeSummaryDocument({ document: { blocks } });
};

type InsertParams = {
  readonly text: string;
  readonly sectionKey: SummarySectionKey;
  readonly body: string;
};

const blockFor = ({ sectionKey, body }: Omit<InsertParams, 'text'>): SummaryBlock => ({
  index: -1,
  sectionKey,
  title: SUMMARY_SECTION_TITLES[sectionKey],
  headingLine: `#### ${SUMMARY_SECTION_TITLES[sectionKey]}`,
  body,
});

export const insertSummarySection = ({ text, sectionKey, body }: InsertParams): string => {
  const document = parseSummaryDocument({ text });
  if (document.blocks.some((block) => block.sectionKey === sectionKey)) {
    return text;
  }

  const rank = SUMMARY_SECTION_KEYS.indexOf(sectionKey);
  const successor = document.blocks.find(
    (block) => block.sectionKey != null && SUMMARY_SECTION_KEYS.indexOf(block.sectionKey) > rank,
  );

  if (successor != null) {
    const blocks = document.blocks.flatMap((block) =>
      block === successor ? [blockFor({ sectionKey, body: `${body}\n` }), block] : [block],
    );
    return serializeSummaryDocument({ document: { blocks } });
  }

  const tail = document.blocks.at(-1);
  const separated = document.blocks.map((block) =>
    block === tail ? { ...block, body: `${block.body ?? ''}\n` } : block,
  );
  const blocks = [...separated, blockFor({ sectionKey, body })];
  return serializeSummaryDocument({ document: { blocks } });
};
