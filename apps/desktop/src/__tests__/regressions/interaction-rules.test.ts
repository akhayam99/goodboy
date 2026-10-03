// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import {
  ACTION_VERBS,
  CHOICE_OVERFLOW_LABEL,
  CHOICE_SEGMENT_LIMIT,
} from '../../shared/lib/interactionRules';

const SRC = join(__dirname, '..', '..');

const SKIPPED: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'target',
  'gen',
  'MockScene',
]);

const walk = (directory: string): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
};

const isProduct = (path: string): boolean => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path);

const sources = (): ReadonlyArray<readonly [string, string]> =>
  [...walk(SRC), ...walk(join(SRC, '..', '..', '..', 'packages', 'ui', 'src'))]
    .filter(isProduct)
    .map(
      (path) =>
        [
          relative(join(SRC, '..', '..', '..'), path)
            .split(sep)
            .join('/'),
          readFileSync(path, 'utf8'),
        ] as const,
    );

const BRACES = String.raw`\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}`;

const BUTTON_PATTERN = new RegExp(
  String.raw`<(Button|button)\b((?:[^<>{}]|${BRACES})*)>([\s\S]*?)</\1>`,
  'g',
);

type VerbButton = {
  readonly path: string;
  readonly tag: string;
  readonly verb: string;
  readonly variant: string | null;
};

const withoutTags = (children: string): string => {
  const kept: Array<string> = [];
  const opens: Array<number> = [];
  for (const char of children) {
    if (char === '<') {
      opens.push(kept.length);
      kept.push(char);
      continue;
    }
    const open = char === '>' ? opens.pop() : undefined;
    if (open !== undefined) {
      kept.length = open;
      continue;
    }
    kept.push(char);
  }
  return kept.join('');
};

const textOf = (children: string): string => withoutTags(children).replace(/\s+/g, ' ').trim();

const variantOf = (attrs: string): string | null => {
  const literal = /\bvariant="(\w+)"/.exec(attrs);
  if (literal !== null) {
    return literal[1] ?? null;
  }
  return /\bvariant=\{/.test(attrs) ? 'dynamic' : 'primary';
};

const verbButtons = (): ReadonlyArray<VerbButton> => {
  const verbs = new Set(ACTION_VERBS.map((entry) => entry.verb));
  return sources().flatMap(([path, text]) =>
    Array.from(text.matchAll(BUTTON_PATTERN)).flatMap((match): ReadonlyArray<VerbButton> => {
      const label = textOf(match[3] ?? '');
      return verbs.has(label)
        ? [{ path, tag: match[1] ?? '', verb: label, variant: variantOf(match[2] ?? '') }]
        : [];
    }),
  );
};

describe('one button variant per verb', () => {
  it('finds the verb buttons, never an empty sweep', () => {
    const found = verbButtons();
    expect(found.length).toBeGreaterThan(15);
    for (const entry of ACTION_VERBS) {
      expect(found.some((button) => button.verb === entry.verb)).toBe(true);
    }
  });

  it.each(ACTION_VERBS.filter((entry) => entry.variant !== null))(
    '$verb always renders as the $variant variant',
    ({ verb, variant }) => {
      const off = verbButtons()
        .filter((button) => button.verb === verb && button.variant !== variant)
        .map((button) => `${button.path} (${button.variant})`);

      expect(off).toEqual([]);
    },
  );

  it('never draws a verb with a hand-made button', () => {
    const pinned = new Set(
      ACTION_VERBS.filter((entry) => entry.variant !== null).map((entry) => entry.verb),
    );
    const raw = verbButtons()
      .filter((button) => button.tag === 'button' && pinned.has(button.verb))
      .map((button) => `${button.path} (${button.verb})`);

    expect(raw).toEqual([]);
  });

  it('gives every verb one meaning', () => {
    expect(new Set(ACTION_VERBS.map((entry) => entry.verb)).size).toBe(ACTION_VERBS.length);
    expect(new Set(ACTION_VERBS.map((entry) => entry.meaning)).size).toBe(ACTION_VERBS.length);
  });
});

const OPTIONS_PATTERN = /(?:SegmentedTabOption<[^=]*?>>\s*=\s*|options=\{)\[/g;

const balancedArray = ({
  text,
  start,
}: {
  readonly text: string;
  readonly start: number;
}): string => {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (char === '[') {
      depth += 1;
    }
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }
  return '';
};

type OptionList = {
  readonly path: string;
  readonly count: number;
  readonly body: string;
};

const segmentedOptionLists = (): ReadonlyArray<OptionList> =>
  sources()
    .filter(([, text]) => text.includes('SegmentedTab'))
    .flatMap(([path, text]) =>
      Array.from(text.matchAll(OPTIONS_PATTERN)).map((match) => {
        const body = balancedArray({ text, start: match.index + match[0].length - 1 });
        return { path, count: (body.match(/\{\s*value:/g) ?? []).length, body };
      }),
    );

describe('a choice of a value is a segmented control up to four options, a list after', () => {
  it('finds the option lists, never an empty sweep', () => {
    expect(segmentedOptionLists().length).toBeGreaterThan(10);
  });

  it('keeps every segmented control within the limit', () => {
    const over = segmentedOptionLists()
      .filter((list) => list.count > CHOICE_SEGMENT_LIMIT)
      .map((list) => `${list.path} (${list.count})`);

    expect(over).toEqual([]);
  });

  it('never hides an option behind a More segment', () => {
    const more = segmentedOptionLists()
      .filter((list) =>
        new RegExp(String.raw`label:\s*['"]${CHOICE_OVERFLOW_LABEL}['"]`).test(list.body),
      )
      .map((list) => list.path);

    expect(more).toEqual([]);
  });
});

describe('keys that submit come from the registry', () => {
  it('has no hand-written Cmd or Ctrl plus Enter check', () => {
    const handmade = sources()
      .filter(([path]) => path.startsWith('apps/desktop/src/'))
      .filter(([path]) => !path.startsWith('apps/desktop/src/shared/keyboard/'))
      .filter(([, text]) =>
        /\.key === 'Enter' && \(\w+\.metaKey \|\| \w+\.ctrlKey\)|\(\w+\.metaKey \|\| \w+\.ctrlKey\) && \w+\.key === 'Enter'/.test(
          text,
        ),
      )
      .map(([path]) => path);

    expect(handmade).toEqual([]);
  });

  it('prints no submit hint by hand', () => {
    const handmade = sources()
      .filter(([, text]) => /formatCombo\('cmd\+Enter'\)/.test(text))
      .map(([path]) => path);

    expect(handmade).toEqual([
      'apps/desktop/src/features/palette/components/CommandsMode/PreviewHints.tsx',
    ]);
  });
});
