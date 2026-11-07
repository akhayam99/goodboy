// @vitest-environment node
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { RETIRED_NAMES } from './retiredNames';
import { COPY_PROPS } from './copyProps';
import { scanCopy } from './scanCopy';
import type { CopyString } from './scanCopySource';

const BASELINE_PATH = join(__dirname, 'copy-budget.baseline.json');
const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

const MAX_WORDS = 13;
const LONG_PROPS: ReadonlySet<string> = new Set(['description', 'hint', 'help', 'meta', 'body']);
const SENTENCE_PROPS: ReadonlySet<string> = new Set([
  'description',
  'hint',
  'help',
  'body',
  'tooltip',
]);
const POSITION_PHRASE =
  /\b(shows? up here|lands? here|land here|appears? here|(?:is|are) (?:kept|listed|recorded|shown) here|moves? to the left|moves? to the right|above|below)\b/i;
const FIRST_PERSON = /\b(I|I'm|I'll|I've|we|we're|we'll|our|let's)\b|\b(?:We|Our|Let's)\b/;
const OPTION_PROPS: ReadonlySet<string> = new Set([
  'label',
  'actionLabel',
  'confirmLabel',
  'shortLabel',
  'short',
  'aria-label',
  'ariaLabel',
]);
const OPTION_FIRST_PERSON = /\b(?:my|me|myself)\b/i;
const BUTTON_RETRY = /\btry (?:the push )?again\b/i;
const WAITING_TITLE = /\b(?:waiting for you|waits on you|waiting for your (?:OK|answer))\b/i;
const TITLE_PROPS: ReadonlySet<string> = new Set(['title', 'label', 'word', 'short', 'phrase']);
const BRAND_LOWERCASE = ['pnpm', 'npm', 'gh', 'git'];

type Rule = {
  readonly id: string;
  readonly fix: string;
  readonly matches: (copy: CopyString) => boolean;
};

const inCopyProp = (copy: CopyString): boolean => copy.prop !== null && COPY_PROPS.has(copy.prop);

const RULES: ReadonlyArray<Rule> = [
  {
    id: 'long-help',
    fix: `cut to ${MAX_WORDS} words or fewer; one fact per line`,
    matches: (copy) =>
      copy.prop !== null && LONG_PROPS.has(copy.prop) && copy.text.split(/\s+/).length > MAX_WORDS,
  },
  {
    id: 'position-phrase',
    fix: 'drop the position phrase; the layout says where it is',
    matches: (copy) => POSITION_PHRASE.test(copy.text),
  },
  {
    id: 'first-person',
    fix: 'say what the app shows, not who says it',
    matches: (copy) =>
      (inCopyProp(copy) && FIRST_PERSON.test(copy.text)) ||
      (copy.prop !== null && OPTION_PROPS.has(copy.prop) && OPTION_FIRST_PERSON.test(copy.text)),
  },
  {
    id: 'lowercase-start',
    fix: 'open the sentence with a capital',
    matches: (copy) =>
      copy.prop !== null &&
      SENTENCE_PROPS.has(copy.prop) &&
      copy.hasLeadingExpression !== true &&
      /^[a-z]/.test(copy.text) &&
      !BRAND_LOWERCASE.some((brand) => copy.text.startsWith(`${brand} `)),
  },
  ...RETIRED_NAMES.map((retired): Rule => ({
    id: `retired-${retired.id}`,
    fix: `say "${retired.use}" instead`,
    matches: (copy) => {
      if (retired.id === 'try-again' && copy.prop !== null && OPTION_PROPS.has(copy.prop)) {
        return BUTTON_RETRY.test(copy.text);
      }
      if (
        retired.id === 'waiting-for-you-title' &&
        copy.prop !== null &&
        TITLE_PROPS.has(copy.prop)
      ) {
        return WAITING_TITLE.test(copy.text);
      }
      return retired.pattern.test(copy.text);
    },
  })),
];

type Counts = Record<string, Record<string, number>>;

const measure = (): Counts => {
  const strings = scanCopy();
  return Object.fromEntries(
    RULES.map((rule) => [
      rule.id,
      strings.filter(rule.matches).reduce<Record<string, number>>((byPath, copy) => {
        byPath[copy.path] = (byPath[copy.path] ?? 0) + 1;
        return byPath;
      }, {}),
    ]),
  );
};

const sorted = (counts: Counts): Counts =>
  Object.fromEntries(
    Object.entries(counts).map(([id, byPath]) => [
      id,
      Object.fromEntries(Object.entries(byPath).sort(([a], [b]) => a.localeCompare(b))),
    ]),
  );

const readBaseline = (): Counts => JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));

describe('on-screen copy stays short and plain', () => {
  it.each(['Sync and try again', 'Try the push again'])(
    'catches the retry phrase inside a button: %s',
    (text) => {
      const rule = RULES.find(({ id }) => id === 'retired-try-again');
      expect(rule?.matches({ path: 'Harborline.tsx', line: 1, prop: 'label', text })).toBe(true);
      expect(
        rule?.matches({
          path: 'Harborline.tsx',
          line: 1,
          prop: 'body',
          text: `Check it. ${text}.`,
        }),
      ).toBe(false);
    },
  );

  it('catches a counted waiting title and leaves a reason sentence alone', () => {
    const rule = RULES.find(({ id }) => id === 'retired-waiting-for-you-title');
    expect(
      rule?.matches({ path: 'Harborline.ts', line: 1, prop: 'word', text: '3 waiting for you' }),
    ).toBe(true);
    expect(
      rule?.matches({
        path: 'Harborline.ts',
        line: 1,
        prop: 'sentence',
        text: 'The agent is waiting for your answer.',
      }),
    ).toBe(false);
  });

  it.each(['Move my work', 'Help me', 'Resolve myself'])(
    'catches first person in an option: %s',
    (text) => {
      const rule = RULES.find(({ id }) => id === 'first-person');
      expect(rule?.matches({ path: 'Harborline.ts', line: 1, prop: 'label', text })).toBe(true);
    },
  );

  const measured = measure();

  if (IS_UPDATING) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted(measured), null, 2)}\n`);
  }

  it('adds no long, positional, first-person, lowercase or retired copy outside the baseline', () => {
    const baseline = readBaseline();
    const grown = RULES.flatMap((rule) =>
      Object.entries(measured[rule.id] ?? {}).flatMap(([path, count]) => {
        const allowed = baseline[rule.id]?.[path] ?? 0;
        return count > allowed
          ? [`  - ${rule.id} ${path}: ${count} (baseline ${allowed}), ${rule.fix}`]
          : [];
      }),
    );

    if (grown.length > 0) {
      throw new Error(
        `Copy budget grew. docs/tone-of-voice.md lists the rules. A cleanup that lowers a ` +
          `count is regenerated by the baseline owner with GOODBOY_UPDATE_BASELINE=1.\n\n${grown.join('\n')}`,
      );
    }
    expect(grown).toEqual([]);
  });

  it.each([
    'Finished sessions appear here: what shipped.',
    'Create the pull request, it appears here',
    'Plans and reports are kept here.',
    'Issues assigned to you are listed here.',
    'Plans and pull requests are recorded here.',
    'Pull requests are shown here.',
    'The reply shows up here.',
  ])('the position phrase knows "%s"', (text) => {
    expect(POSITION_PHRASE.test(text)).toBe(true);
  });

  it.each([
    'This file is too large to show here. Open it to see it.',
    'Plans, reports and wireframes from this session become artifacts.',
    'Files that differ from main are listed when they change.',
  ])('the position phrase leaves "%s" alone', (text) => {
    expect(POSITION_PHRASE.test(text)).toBe(false);
  });

  it.runIf(process.env.RATCHET_CLOSE === '1')(
    'has no baseline count above what is measured',
    () => {
      const baseline = readBaseline();
      const stale = Object.entries(baseline).flatMap(([id, byPath]) =>
        Object.entries(byPath).flatMap(([path, allowed]) => {
          const count = measured[id]?.[path] ?? 0;
          return count < allowed ? [`${id} ${path}: baseline ${allowed}, now ${count}`] : [];
        }),
      );

      expect(stale).toEqual([]);
    },
  );
});
