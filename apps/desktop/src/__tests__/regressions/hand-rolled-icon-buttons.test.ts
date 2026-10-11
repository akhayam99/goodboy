// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  nonZero,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'hand-rolled-icon-buttons.baseline.json';

const COMPONENT_OPENER = /^<[A-Z]/;

const ICON_PROPS = /\s(?:size=|aria-hidden)/;

const braceEnd = ({ text, from }: { readonly text: string; readonly from: number }): number => {
  let depth = 0;
  for (let cursor = from; cursor < text.length; cursor += 1) {
    const char = text.charAt(cursor);
    depth += char === '{' ? 1 : char === '}' ? -1 : 0;
    if (depth === 0) {
      return cursor;
    }
  }
  return -1;
};

const tagEnd = ({ text, from }: { readonly text: string; readonly from: number }): number => {
  let depth = 0;
  for (let cursor = from; cursor < text.length; cursor += 1) {
    const char = text.charAt(cursor);
    depth += char === '{' ? 1 : char === '}' ? -1 : 0;
    if (char === '>' && depth === 0 && text.charAt(cursor - 1) !== '=') {
      return cursor;
    }
  }
  return -1;
};

const isIconTag = ({ tag }: { readonly tag: string }): boolean =>
  COMPONENT_OPENER.test(tag) && tag.endsWith('/>') && ICON_PROPS.test(tag);

const topLevelParts = ({ body }: { readonly body: string }): ReadonlyArray<string> => {
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    const char = body.charAt(cursor);
    if (/\s/.test(char)) {
      cursor += 1;
      continue;
    }
    const end =
      char === '<' ? tagEnd({ text: body, from: cursor }) : braceEnd({ text: body, from: cursor });
    if (char !== '<' && char !== '{') {
      return [...parts, 'text'];
    }
    if (end === -1) {
      return [...parts, 'broken'];
    }
    parts.push(body.slice(cursor, end + 1));
    cursor = end + 1;
  }
  return parts;
};

const iconTagsIn = ({ expression }: { readonly expression: string }): ReadonlyArray<string> => {
  const tags: string[] = [];
  let cursor = expression.indexOf('<');
  while (cursor !== -1) {
    const end = tagEnd({ text: expression, from: cursor });
    if (end === -1) {
      return [];
    }
    tags.push(expression.slice(cursor, end + 1));
    cursor = expression.indexOf('<', end + 1);
  }
  return tags;
};

const isIconOnly = ({ body }: { readonly body: string }): boolean => {
  const parts = topLevelParts({ body });
  const only = parts[0];
  if (parts.length !== 1 || only === undefined) {
    return false;
  }
  if (only.startsWith('<')) {
    return isIconTag({ tag: only });
  }
  const tags = iconTagsIn({ expression: only });
  return tags.length > 0 && tags.every((tag) => isIconTag({ tag }));
};

const bodiesOf = ({ text }: { readonly text: string }): ReadonlyArray<string> =>
  [...text.matchAll(/<button(?=[\s>])/g)].flatMap((match) => {
    const open = tagEnd({ text, from: match.index });
    const end = text.indexOf('</button>', open);
    return open === -1 || text.charAt(open - 1) === '/' || end === -1
      ? []
      : [text.slice(open + 1, end)];
  });

const countHandRolled = ({ text }: { readonly text: string }): number =>
  bodiesOf({ text }).filter((body) => isIconOnly({ body })).length;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources()
        .filter(({ path }) => !path.startsWith('packages/ui/'))
        .map(({ path, text }) => [path, countHandRolled({ text })]),
    ),
  });

describe('an icon-only button is an IconButton, not a hand-rolled button', () => {
  it('counts a button whose only child is an icon', () => {
    expect(
      countHandRolled({ text: '<button type="button"><X size={12} aria-hidden /></button>' }),
    ).toBe(1);
    expect(
      countHandRolled({
        text: '<button type="button">\n  <CONCEPT_ICONS.agents size={12} />\n</button>',
      }),
    ).toBe(1);
    expect(
      countHandRolled({
        text: '<button type="button">{isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>',
      }),
    ).toBe(1);
  });

  it('leaves a button that carries text, a second child or a component alone', () => {
    expect(countHandRolled({ text: '<button type="button"><X size={12} />Close</button>' })).toBe(
      0,
    );
    expect(
      countHandRolled({
        text: '<button type="button"><X size={12} /><span>Close</span></button>',
      }),
    ).toBe(0);
    expect(countHandRolled({ text: '<IconButton icon={X} label="Close" />' })).toBe(0);
    expect(countHandRolled({ text: '<button type="button">{label}</button>' })).toBe(0);
    expect(countHandRolled({ text: '<button type="button"><Avatar name={name} /></button>' })).toBe(
      0,
    );
  });

  it('adds no hand-rolled icon button beyond the baseline, which only falls', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      [
        'A button whose only child is an icon is an IconButton: it carries the tooltip,',
        'the aria-label, the size, the focus ring and the busy state the same way',
        'everywhere. Use IconButton (or a wrapper such as RefreshIconButton). The',
        'baseline only falls.',
        grown.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
