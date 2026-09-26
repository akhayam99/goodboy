import { CHANGELOG_AREA_VALUES } from './changelogAreas';
import { CHANGELOG_SCREEN_VALUES } from './changelogScreens';

export type ChangelogLine = {
  readonly number: number;
  readonly text: string;
};

export type ChangelogLintRule =
  | 'heading'
  | 'opening-missing'
  | 'opening-length'
  | 'opening-sentence'
  | 'one-way-format'
  | 'section-unexpected'
  | 'section-duplicate'
  | 'section-order'
  | 'section-empty'
  | 'entry-title-length'
  | 'entry-title-period'
  | 'entry-meta-missing'
  | 'entry-paragraph-missing'
  | 'entry-paragraph-count'
  | 'entry-paragraph-length'
  | 'fix-line-format'
  | 'fix-line-length'
  | 'meta-key-unknown'
  | 'meta-key-duplicate'
  | 'meta-area-missing'
  | 'meta-area-unknown'
  | 'meta-screen-unknown'
  | 'meta-image-format'
  | 'meta-pr-format'
  | 'denylist';

export type ChangelogLintViolation = {
  readonly line: number;
  readonly rule: ChangelogLintRule;
  readonly message: string;
};

const HEADING_PATTERN = /^## Goodboy v\d+\.\d+\.\d+$/;
const SECTION_PATTERN = /^### (New|Improved|Fixed)$/;
const ENTRY_TITLE_PATTERN = /^#### (.+)$/;
const META_LINE_PATTERN = /^<!-- gb (.+) -->$/;
const META_TOKEN_PATTERN = /^([a-z]+)=(\S+)$/;
const FIX_LINE_PATTERN = /^- (.+) (<!-- gb .+ -->)$/;
const ONE_WAY_PATTERN =
  /^This version updates your data in one direction\. To go back to \d+\.\d+, restore the backup Goodboy made before updating\.$/;
const IMAGE_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PR_LIST_PATTERN = /^\d+(,\d+)*$/;

const SECTION_ORDER: ReadonlyArray<'New' | 'Improved' | 'Fixed'> = ['New', 'Improved', 'Fixed'];
const AREA_VALUES: ReadonlySet<string> = new Set(CHANGELOG_AREA_VALUES);
const SCREEN_VALUES: ReadonlySet<string> = new Set(CHANGELOG_SCREEN_VALUES);
const META_KNOWN_KEYS: ReadonlySet<string> = new Set(['area', 'screen', 'image', 'pr']);

const EM_DASH = String.fromCharCode(0x2014);
const MIDDOT = String.fromCharCode(0xb7);

const DENYLIST_PATTERNS: ReadonlyArray<{ readonly pattern: RegExp; readonly label: string }> = [
  { pattern: new RegExp(EM_DASH), label: 'an em dash' },
  { pattern: new RegExp(MIDDOT), label: 'a middot' },
  { pattern: /follow-up/i, label: '"follow-up"' },
  { pattern: /not yet/i, label: '"not yet"' },
  { pattern: /coming soon/i, label: '"coming soon"' },
  { pattern: /\bwill\b/i, label: '"will"' },
  { pattern: /\[#/, label: 'a PR reference in the text' },
  { pattern: /\]\(/, label: 'a markdown link' },
];

type ScanDenylistParams = {
  readonly text: string;
  readonly line: number;
};

const scanDenylist = ({ text, line }: ScanDenylistParams): ReadonlyArray<ChangelogLintViolation> =>
  DENYLIST_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => ({
    line,
    rule: 'denylist',
    message: `contains ${entry.label}`,
  }));

type WordCountParams = {
  readonly text: string;
};

const wordCount = ({ text }: WordCountParams): number =>
  text.split(/\s+/).filter((word) => word.length > 0).length;

type IsBlankParams = {
  readonly text: string;
};

const isBlank = ({ text }: IsBlankParams): boolean => text.trim().length === 0;

type IsStructuralLineParams = {
  readonly text: string;
};

const isStructuralLine = ({ text }: IsStructuralLineParams): boolean => {
  if (SECTION_PATTERN.test(text)) {
    return true;
  }
  if (ENTRY_TITLE_PATTERN.test(text)) {
    return true;
  }
  if (META_LINE_PATTERN.test(text.trim())) {
    return true;
  }
  return text.startsWith('- ');
};

type CursorState = { index: number };

type LinesParams = {
  readonly lines: ReadonlyArray<ChangelogLine>;
  readonly cursor: CursorState;
};

const advanceIndex = ({ cursor }: { readonly cursor: CursorState }): void => {
  cursor.index += 1;
};

const peekLine = ({ lines, cursor }: LinesParams): ChangelogLine | null => {
  const line = lines[cursor.index];
  if (line === undefined) {
    return null;
  }
  return line;
};

const skipBlankLines = ({ lines, cursor }: LinesParams): void => {
  while (true) {
    const line = peekLine({ lines, cursor });
    if (line === null || !isBlank({ text: line.text })) {
      break;
    }
    advanceIndex({ cursor });
  }
};

type Paragraph = {
  readonly text: string;
  readonly startLine: number;
};

const takeParagraph = ({ lines, cursor }: LinesParams): Paragraph | null => {
  skipBlankLines({ lines, cursor });
  const first = peekLine({ lines, cursor });
  if (first === null) {
    return null;
  }
  if (isStructuralLine({ text: first.text })) {
    return null;
  }
  const startLine = first.number;
  const parts: string[] = [];
  while (true) {
    const current = peekLine({ lines, cursor });
    if (current === null) {
      break;
    }
    if (isBlank({ text: current.text })) {
      break;
    }
    parts.push(current.text);
    advanceIndex({ cursor });
  }
  return { text: parts.join(' '), startLine };
};

type ValidateParagraphLengthParams = {
  readonly paragraph: Paragraph;
  readonly maxWords: number;
};

const validateParagraphLength = ({
  paragraph,
  maxWords,
}: ValidateParagraphLengthParams): ReadonlyArray<ChangelogLintViolation> => {
  const violations: ChangelogLintViolation[] = [
    ...scanDenylist({ text: paragraph.text, line: paragraph.startLine }),
  ];
  const words = wordCount({ text: paragraph.text });
  if (words > maxWords) {
    violations.push({
      line: paragraph.startLine,
      rule: 'entry-paragraph-length',
      message: `${words} words, max ${maxWords}`,
    });
  }
  return violations;
};

type ValidateMetaParams = {
  readonly line: ChangelogLine;
};

const validateMeta = ({ line }: ValidateMetaParams): ReadonlyArray<ChangelogLintViolation> => {
  const match = META_LINE_PATTERN.exec(line.text.trim());
  if (match === null) {
    return [
      {
        line: line.number,
        rule: 'entry-meta-missing',
        message: 'expected a "<!-- gb ... -->" meta comment',
      },
    ];
  }
  const violations: ChangelogLintViolation[] = [];
  const seenKeys = new Set<string>();
  const metaBody = match[1] ?? '';
  metaBody.split(' ').forEach((token) => {
    const tokenMatch = META_TOKEN_PATTERN.exec(token);
    if (tokenMatch === null) {
      violations.push({
        line: line.number,
        rule: 'meta-key-unknown',
        message: `malformed meta token "${token}"`,
      });
      return;
    }
    const key = tokenMatch[1] ?? '';
    const value = tokenMatch[2] ?? '';
    if (seenKeys.has(key)) {
      violations.push({
        line: line.number,
        rule: 'meta-key-duplicate',
        message: `duplicate meta key "${key}"`,
      });
    }
    seenKeys.add(key);
    if (!META_KNOWN_KEYS.has(key)) {
      violations.push({
        line: line.number,
        rule: 'meta-key-unknown',
        message: `unknown meta key "${key}"`,
      });
      return;
    }
    if (key === 'area' && !AREA_VALUES.has(value)) {
      violations.push({
        line: line.number,
        rule: 'meta-area-unknown',
        message: `unknown area "${value}"`,
      });
    }
    if (key === 'screen' && !SCREEN_VALUES.has(value)) {
      violations.push({
        line: line.number,
        rule: 'meta-screen-unknown',
        message: `unknown screen "${value}"`,
      });
    }
    if (key === 'image' && !IMAGE_NAME_PATTERN.test(value)) {
      violations.push({
        line: line.number,
        rule: 'meta-image-format',
        message: `invalid image name "${value}"`,
      });
    }
    if (key === 'pr' && !PR_LIST_PATTERN.test(value)) {
      violations.push({
        line: line.number,
        rule: 'meta-pr-format',
        message: `invalid pr list "${value}"`,
      });
    }
  });
  if (!seenKeys.has('area')) {
    violations.push({
      line: line.number,
      rule: 'meta-area-missing',
      message: 'meta comment is missing "area"',
    });
  }
  return violations;
};

export type LintReleaseParams = {
  readonly lines: ReadonlyArray<ChangelogLine>;
};

export const lintRelease = ({
  lines,
}: LintReleaseParams): ReadonlyArray<ChangelogLintViolation> => {
  const violations: ChangelogLintViolation[] = [];
  const heading = lines[0];
  if (heading === undefined) {
    return violations;
  }
  if (!HEADING_PATTERN.test(heading.text)) {
    violations.push({
      line: heading.number,
      rule: 'heading',
      message: `expected "## Goodboy vX.Y.Z", got "${heading.text}"`,
    });
    return violations;
  }

  const cursor: CursorState = { index: 1 };

  const opening = takeParagraph({ lines, cursor });
  if (opening === null) {
    violations.push({
      line: heading.number,
      rule: 'opening-missing',
      message: 'missing opening sentence',
    });
  }
  if (opening !== null) {
    violations.push(...scanDenylist({ text: opening.text, line: opening.startLine }));
    if (opening.text.length > 160) {
      violations.push({
        line: opening.startLine,
        rule: 'opening-length',
        message: `${opening.text.length} chars, max 160`,
      });
    }
    const withoutTrailingStop = opening.text.replace(/[.!?]$/, '');
    if (/[.!?]/.test(withoutTrailingStop)) {
      violations.push({
        line: opening.startLine,
        rule: 'opening-sentence',
        message: 'opening must be a single sentence',
      });
    }
  }

  const maybeOneWay = takeParagraph({ lines, cursor });
  if (maybeOneWay !== null && !ONE_WAY_PATTERN.test(maybeOneWay.text)) {
    violations.push({
      line: maybeOneWay.startLine,
      rule: 'one-way-format',
      message: `unexpected paragraph before a section heading: "${maybeOneWay.text}"`,
    });
  }

  const seenSections = new Set<'New' | 'Improved' | 'Fixed'>();
  let lastOrderIndex = -1;
  let firstEntrySeen = false;

  skipBlankLines({ lines, cursor });
  while (peekLine({ lines, cursor }) !== null) {
    const line = peekLine({ lines, cursor });
    if (line === null) {
      break;
    }
    const sectionMatch = SECTION_PATTERN.exec(line.text);
    if (sectionMatch === null) {
      violations.push({
        line: line.number,
        rule: 'section-unexpected',
        message: `unexpected line "${line.text}"`,
      });
      advanceIndex({ cursor });
      skipBlankLines({ lines, cursor });
      continue;
    }
    const sectionName = sectionMatch[1] as 'New' | 'Improved' | 'Fixed';
    if (seenSections.has(sectionName)) {
      violations.push({
        line: line.number,
        rule: 'section-duplicate',
        message: `section "${sectionName}" repeated`,
      });
    }
    const orderIndex = SECTION_ORDER.indexOf(sectionName);
    if (orderIndex < lastOrderIndex) {
      violations.push({
        line: line.number,
        rule: 'section-order',
        message: `section "${sectionName}" out of order`,
      });
    }
    seenSections.add(sectionName);
    lastOrderIndex = Math.max(lastOrderIndex, orderIndex);
    advanceIndex({ cursor });
    skipBlankLines({ lines, cursor });

    let sectionEntryCount = 0;

    if (sectionName === 'Fixed') {
      while (true) {
        const fixLine = peekLine({ lines, cursor });
        if (fixLine === null || !fixLine.text.startsWith('- ')) {
          break;
        }
        sectionEntryCount += 1;
        const fixMatch = FIX_LINE_PATTERN.exec(fixLine.text);
        if (fixMatch === null) {
          violations.push({
            line: fixLine.number,
            rule: 'fix-line-format',
            message: `malformed fix line "${fixLine.text}"`,
          });
          advanceIndex({ cursor });
          skipBlankLines({ lines, cursor });
          continue;
        }
        const fixText = fixMatch[1] ?? '';
        const metaComment = fixMatch[2] ?? '';
        violations.push(...scanDenylist({ text: fixText, line: fixLine.number }));
        const words = wordCount({ text: fixText });
        if (words > 30) {
          violations.push({
            line: fixLine.number,
            rule: 'fix-line-length',
            message: `${words} words, max 30`,
          });
        }
        violations.push(...validateMeta({ line: { number: fixLine.number, text: metaComment } }));
        advanceIndex({ cursor });
        skipBlankLines({ lines, cursor });
      }
    }

    if (sectionName !== 'Fixed') {
      while (true) {
        const entryLine = peekLine({ lines, cursor });
        if (entryLine === null || !ENTRY_TITLE_PATTERN.test(entryLine.text)) {
          break;
        }
        sectionEntryCount += 1;
        const isFirstEntry = !firstEntrySeen;
        firstEntrySeen = true;
        const titleMatch = ENTRY_TITLE_PATTERN.exec(entryLine.text);
        const title = titleMatch === null ? '' : (titleMatch[1] ?? '');
        if (title.length > 60) {
          violations.push({
            line: entryLine.number,
            rule: 'entry-title-length',
            message: `${title.length} chars, max 60`,
          });
        }
        if (title.endsWith('.')) {
          violations.push({
            line: entryLine.number,
            rule: 'entry-title-period',
            message: 'title ends with a period',
          });
        }
        violations.push(...scanDenylist({ text: title, line: entryLine.number }));
        advanceIndex({ cursor });

        const metaLine = peekLine({ lines, cursor });
        const hasMetaLine = metaLine !== null && META_LINE_PATTERN.test(metaLine.text.trim());
        if (!hasMetaLine) {
          violations.push({
            line: entryLine.number,
            rule: 'entry-meta-missing',
            message: 'entry title is not followed by a meta comment',
          });
        }
        if (hasMetaLine && metaLine !== null) {
          violations.push(...validateMeta({ line: metaLine }));
          advanceIndex({ cursor });
        }

        const maxParagraphs = isFirstEntry ? 3 : 2;
        let paragraphCount = 0;
        while (true) {
          const paragraph = takeParagraph({ lines, cursor });
          if (paragraph === null) {
            break;
          }
          paragraphCount += 1;
          violations.push(...validateParagraphLength({ paragraph, maxWords: 70 }));
          if (paragraphCount > maxParagraphs) {
            violations.push({
              line: paragraph.startLine,
              rule: 'entry-paragraph-count',
              message: `entry has more than ${maxParagraphs} paragraphs`,
            });
          }
        }
        if (paragraphCount === 0) {
          violations.push({
            line: entryLine.number,
            rule: 'entry-paragraph-missing',
            message: 'entry has no body paragraph',
          });
        }
      }
    }

    if (sectionEntryCount === 0) {
      violations.push({
        line: line.number,
        rule: 'section-empty',
        message: `section "${sectionName}" has no entries`,
      });
    }
  }

  if (seenSections.size === 0) {
    violations.push({
      line: heading.number,
      rule: 'section-empty',
      message: 'release has no New, Improved or Fixed section',
    });
  }

  return violations;
};
