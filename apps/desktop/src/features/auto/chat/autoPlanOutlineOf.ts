const STEP_PREFIX_RE = /^\d+[.)] /;
const BARE_FILE_RE = /^[\w-]+\.[a-z]{1,5}$/;
const PATH_RE = /^[\w@./-]+$/;
const MAX_OUTLINE_STEPS = 4;
const MAX_STEP_CHARS = 90;

export type AutoPlanOutline = Readonly<{
  steps: ReadonlyArray<string>;
  stepCount: number;
  fileCount: number;
  riskCount: number;
}>;

type Params = {
  readonly sourceText: string;
};

type SectionParams = {
  readonly lines: ReadonlyArray<string>;
  readonly name: string;
};

type TextParams = {
  readonly text: string;
};

type Heading = Readonly<{ depth: number; title: string }>;

const headingOf = ({ text }: TextParams): Heading | null => {
  let depth = 0;
  while (depth < text.length && text.charAt(depth) === '#') {
    depth += 1;
  }
  if (depth === 0 || depth > 6 || text.charAt(depth) !== ' ') {
    return null;
  }
  return { depth, title: text.slice(depth).trim() };
};

const sectionOf = ({ lines, name }: SectionParams): ReadonlyArray<string> => {
  const body: string[] = [];
  let level = 0;
  for (const line of lines) {
    const heading = headingOf({ text: line });
    if (heading !== null) {
      if (level > 0 && heading.depth <= level) {
        break;
      }
      if (level === 0 && heading.title.toLowerCase() === name) {
        level = heading.depth;
      }
      continue;
    }
    if (level > 0) {
      body.push(line);
    }
  }
  return body;
};

const outlineStepOf = ({ text }: TextParams): string => {
  const plain = text.replaceAll('*', '').replaceAll('`', '').trim();
  return plain.length > MAX_STEP_CHARS ? `${plain.slice(0, MAX_STEP_CHARS).trimEnd()}...` : plain;
};

const isFileToken = ({ text }: TextParams): boolean =>
  (text.includes('/') && PATH_RE.test(text)) || BARE_FILE_RE.test(text);

export const autoPlanOutlineOf = ({ sourceText }: Params): AutoPlanOutline | null => {
  const lines = sourceText.split('\n');
  const parts = sectionOf({ lines, name: 'parts' });
  const steps = parts
    .filter((line) => STEP_PREFIX_RE.test(line))
    .map((line) => line.slice(line.indexOf(' ') + 1).trim());
  if (steps.length === 0) {
    return null;
  }
  const files = new Set(
    parts
      .join('\n')
      .split('`')
      .filter((_, index) => index % 2 === 1)
      .filter((token) => isFileToken({ text: token })),
  );
  const riskCount = sectionOf({ lines, name: 'risks' }).filter(
    (line) => line.startsWith('- ') || line.startsWith('* '),
  ).length;
  return {
    steps: steps.slice(0, MAX_OUTLINE_STEPS).map((step) => outlineStepOf({ text: step })),
    stepCount: steps.length,
    fileCount: files.size,
    riskCount,
  };
};
