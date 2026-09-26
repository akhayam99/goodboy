import { isChangelogArea } from './changelogAreas';
import type { ChangelogArea } from './changelogAreas';
import { isChangelogScreen } from './changelogScreens';
import type { ChangelogScreen } from './changelogScreens';

export type ChangelogFeature = {
  readonly title: string;
  readonly area: ChangelogArea;
  readonly screen: ChangelogScreen | null;
  readonly image: string | null;
  readonly prs: ReadonlyArray<number>;
  readonly paragraphs: ReadonlyArray<string>;
};

export type ChangelogFix = {
  readonly text: string;
  readonly area: ChangelogArea;
  readonly prs: ReadonlyArray<number>;
};

export type ReleaseSections = {
  readonly new: ReadonlyArray<ChangelogFeature>;
  readonly improved: ReadonlyArray<ChangelogFeature>;
  readonly fixed: ReadonlyArray<ChangelogFix>;
};

export type ReleaseEntry = {
  readonly version: string;
  readonly shape: 'v2' | 'markdown';
  readonly lead: string | null;
  readonly oneWayFrom: string | null;
  readonly sections: ReleaseSections;
  readonly markdown: string | null;
  readonly publishedAt: string | null;
};

const EMPTY_SECTIONS: ReleaseSections = { new: [], improved: [], fixed: [] };

const HEADING_PATTERN = /^## Goodboy v(\d+\.\d+\.\d+)$/;
const SECTION_PATTERN = /^### (New|Improved|Fixed)$/;
const ENTRY_TITLE_PATTERN = /^#### (.+)$/;
const META_LINE_PATTERN = /^<!-- gb (.+) -->$/;
const META_TOKEN_PATTERN = /^([a-z]+)=(\S+)$/;
const FIX_LINE_PATTERN = /^- (.+) (<!-- gb .+ -->)$/;
const ONE_WAY_PATTERN =
  /^This version updates your data in one direction\. To go back to (\d+\.\d+), restore the backup Goodboy made before updating\.$/;
const IMAGE_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PR_LIST_PATTERN = /^\d+(,\d+)*$/;
const SECTION_KEY_BY_NAME = {
  New: 'new',
  Improved: 'improved',
  Fixed: 'fixed',
} as const satisfies Record<string, 'new' | 'improved' | 'fixed'>;

type Meta = {
  readonly area: ChangelogArea;
  readonly screen: ChangelogScreen | null;
  readonly image: string | null;
  readonly prs: ReadonlyArray<number>;
};

const parsePrList = ({ value }: { readonly value: string }): ReadonlyArray<number> | null => {
  if (!PR_LIST_PATTERN.test(value)) {
    return null;
  }
  return value.split(',').map((part) => Number.parseInt(part, 10));
};

const parseMeta = ({ text }: { readonly text: string }): Meta | null => {
  const match = META_LINE_PATTERN.exec(text.trim());
  if (match === null) {
    return null;
  }
  const body = match[1];
  if (body === undefined) {
    return null;
  }
  const tokens = body.split(' ');
  let area: ChangelogArea | null = null;
  let screen: ChangelogScreen | null = null;
  let image: string | null = null;
  let prs: ReadonlyArray<number> = [];
  const seenKeys = new Set<string>();
  for (const token of tokens) {
    const tokenMatch = META_TOKEN_PATTERN.exec(token);
    if (tokenMatch === null) {
      return null;
    }
    const key = tokenMatch[1];
    const value = tokenMatch[2];
    if (key === undefined || value === undefined || seenKeys.has(key)) {
      return null;
    }
    seenKeys.add(key);
    if (key === 'area') {
      if (!isChangelogArea(value)) {
        return null;
      }
      area = value;
      continue;
    }
    if (key === 'screen') {
      if (!isChangelogScreen(value)) {
        return null;
      }
      screen = value;
      continue;
    }
    if (key === 'image') {
      if (!IMAGE_NAME_PATTERN.test(value)) {
        return null;
      }
      image = value;
      continue;
    }
    if (key === 'pr') {
      const parsed = parsePrList({ value });
      if (parsed === null) {
        return null;
      }
      prs = parsed;
      continue;
    }
    return null;
  }
  if (area === null) {
    return null;
  }
  return { area, screen, image, prs };
};

type CursorState = { index: number };

type LinesParams = {
  readonly lines: ReadonlyArray<string>;
  readonly cursor: CursorState;
};

const peekLine = ({ lines, cursor }: LinesParams): string | null => {
  const line = lines[cursor.index];
  if (line === undefined) {
    return null;
  }
  return line;
};

const advance = ({ cursor }: { readonly cursor: CursorState }): void => {
  cursor.index += 1;
};

const isBlank = ({ text }: { readonly text: string }): boolean => text.trim().length === 0;

const isPictureOpenTag = ({ text }: { readonly text: string }): boolean =>
  /^<picture\b/i.test(text.trim());

const ANY_HEADING_PATTERN = /^#{1,6} /;

const isStructuralLine = ({ text }: { readonly text: string }): boolean => {
  if (ANY_HEADING_PATTERN.test(text)) {
    return true;
  }
  if (META_LINE_PATTERN.test(text.trim())) {
    return true;
  }
  if (isPictureOpenTag({ text })) {
    return true;
  }
  return text.startsWith('- ');
};

const skipBlankLines = ({ lines, cursor }: LinesParams): void => {
  while (true) {
    const line = peekLine({ lines, cursor });
    if (line === null || !isBlank({ text: line })) {
      break;
    }
    advance({ cursor });
  }
};

const skipPictureBlock = ({ lines, cursor }: LinesParams): void => {
  while (true) {
    const line = peekLine({ lines, cursor });
    if (line === null) {
      break;
    }
    advance({ cursor });
    if (/<\/picture>/i.test(line)) {
      break;
    }
  }
};

const skipIgnorable = ({ lines, cursor }: LinesParams): void => {
  while (true) {
    const line = peekLine({ lines, cursor });
    if (line === null) {
      break;
    }
    if (isBlank({ text: line })) {
      advance({ cursor });
      continue;
    }
    if (isPictureOpenTag({ text: line })) {
      skipPictureBlock({ lines, cursor });
      continue;
    }
    break;
  }
};

const takeParagraph = ({ lines, cursor }: LinesParams): string | null => {
  skipBlankLines({ lines, cursor });
  const first = peekLine({ lines, cursor });
  if (first === null || isStructuralLine({ text: first })) {
    return null;
  }
  const parts: string[] = [];
  while (true) {
    const current = peekLine({ lines, cursor });
    if (current === null || isBlank({ text: current }) || isStructuralLine({ text: current })) {
      break;
    }
    parts.push(current);
    advance({ cursor });
  }
  return parts.join(' ');
};

type ParseStrictParams = {
  readonly version: string;
  readonly lines: ReadonlyArray<string>;
};

const parseStrict = ({ version, lines }: ParseStrictParams): ReleaseEntry | null => {
  const cursor: CursorState = { index: 0 };
  const lead = takeParagraph({ lines, cursor });
  if (lead === null) {
    return null;
  }
  let oneWayFrom: string | null = null;
  const maybeOneWay = takeParagraph({ lines, cursor });
  if (maybeOneWay !== null) {
    const oneWayMatch = ONE_WAY_PATTERN.exec(maybeOneWay);
    if (oneWayMatch === null) {
      return null;
    }
    oneWayFrom = oneWayMatch[1] ?? null;
  }

  const features: ChangelogFeature[] = [];
  const improvements: ChangelogFeature[] = [];
  const fixes: ChangelogFix[] = [];
  const seenSections = new Set<'New' | 'Improved' | 'Fixed'>();

  skipIgnorable({ lines, cursor });
  while (peekLine({ lines, cursor }) !== null) {
    const line = peekLine({ lines, cursor });
    if (line === null) {
      break;
    }
    const sectionMatch = SECTION_PATTERN.exec(line);
    if (sectionMatch === null) {
      return null;
    }
    const sectionName = sectionMatch[1];
    if (sectionName !== 'New' && sectionName !== 'Improved' && sectionName !== 'Fixed') {
      return null;
    }
    if (seenSections.has(sectionName)) {
      return null;
    }
    seenSections.add(sectionName);
    advance({ cursor });
    skipIgnorable({ lines, cursor });

    if (sectionName === 'Fixed') {
      let fixCount = 0;
      while (true) {
        const fixLine = peekLine({ lines, cursor });
        if (fixLine === null || !fixLine.startsWith('- ')) {
          break;
        }
        const fixMatch = FIX_LINE_PATTERN.exec(fixLine);
        if (fixMatch === null) {
          return null;
        }
        const text = fixMatch[1];
        const metaText = fixMatch[2];
        if (text === undefined || metaText === undefined) {
          return null;
        }
        const meta = parseMeta({ text: metaText });
        if (meta === null) {
          return null;
        }
        fixes.push({ text, area: meta.area, prs: meta.prs });
        fixCount += 1;
        advance({ cursor });
        skipIgnorable({ lines, cursor });
      }
      if (fixCount === 0) {
        return null;
      }
      continue;
    }

    let entryCount = 0;
    while (true) {
      const entryLine = peekLine({ lines, cursor });
      if (entryLine === null) {
        break;
      }
      const titleMatch = ENTRY_TITLE_PATTERN.exec(entryLine);
      if (titleMatch === null) {
        break;
      }
      const title = titleMatch[1];
      if (title === undefined) {
        return null;
      }
      advance({ cursor });
      const metaLine = peekLine({ lines, cursor });
      if (metaLine === null) {
        return null;
      }
      const meta = parseMeta({ text: metaLine });
      if (meta === null) {
        return null;
      }
      advance({ cursor });
      const paragraphs: string[] = [];
      while (true) {
        const paragraph = takeParagraph({ lines, cursor });
        if (paragraph === null) {
          break;
        }
        paragraphs.push(paragraph);
      }
      if (paragraphs.length === 0) {
        return null;
      }
      skipIgnorable({ lines, cursor });
      const feature: ChangelogFeature = {
        title,
        area: meta.area,
        screen: meta.screen,
        image: meta.image,
        prs: meta.prs,
        paragraphs,
      };
      if (sectionName === 'New') {
        features.push(feature);
      }
      if (sectionName === 'Improved') {
        improvements.push(feature);
      }
      entryCount += 1;
    }
    if (entryCount === 0) {
      return null;
    }
  }

  if (seenSections.size === 0) {
    return null;
  }

  return {
    version,
    shape: 'v2',
    lead,
    oneWayFrom,
    sections: { new: features, improved: improvements, fixed: fixes },
    markdown: null,
    publishedAt: null,
  };
};

const asMarkdownRelease = ({
  version,
  body,
}: {
  readonly version: string;
  readonly body: string;
}): ReleaseEntry => ({
  version,
  shape: 'markdown',
  lead: null,
  oneWayFrom: null,
  sections: EMPTY_SECTIONS,
  markdown: body.trim(),
  publishedAt: null,
});

type ParseReleaseParams = {
  readonly version: string;
  readonly body: string;
};

const parseRelease = ({ version, body }: ParseReleaseParams): ReleaseEntry => {
  const lines = body.split('\n');
  const strict = parseStrict({ version, lines });
  if (strict !== null) {
    return strict;
  }
  return asMarkdownRelease({ version, body });
};

export type ParseChangelogParams = {
  readonly text: string;
};

export const parseChangelog = ({ text }: ParseChangelogParams): ReadonlyArray<ReleaseEntry> => {
  const lines = text.split('\n');
  const releases: ReleaseEntry[] = [];
  let currentVersion: string | null = null;
  let currentBody: string[] = [];

  const flush = (): void => {
    if (currentVersion === null) {
      return;
    }
    releases.push(parseRelease({ version: currentVersion, body: currentBody.join('\n') }));
  };

  lines.forEach((line) => {
    const headingMatch = HEADING_PATTERN.exec(line);
    if (headingMatch === null) {
      if (currentVersion !== null) {
        currentBody.push(line);
      }
      return;
    }
    flush();
    currentVersion = headingMatch[1] ?? null;
    currentBody = [];
  });
  flush();

  return releases;
};
