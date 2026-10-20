// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { nonZero, openingTags, productSources, type FileCounts } from './scanControls';

const TOOLTIP_NAMES: ReadonlyArray<string> = ['Tooltip', 'OptionalTooltip'];

const FACT_JOIN = / · |joinFacts\(|\.join\(/;

const GREY_TEXT = /text-(?:faint|muted)-foreground/;

const JSX_START = /^\(?\s*</;

const CARD_VARIANT = /\svariant=(?:"card"|\{'card'\})/;

type TagAttributeParams = {
  readonly tag: string;
  readonly attribute: string;
};

const attributeValue = ({ tag, attribute }: TagAttributeParams): string | undefined => {
  let depth = 0;
  for (let cursor = 0; cursor < tag.length; cursor += 1) {
    const char = tag.charAt(cursor);
    depth += char === '{' ? 1 : char === '}' ? -1 : 0;
    if (depth !== 0 || !/\s/.test(char) || !tag.slice(cursor + 1).startsWith(`${attribute}=`)) {
      continue;
    }
    const start = cursor + 1 + attribute.length + 1;
    if (tag.charAt(start) === '"') {
      return tag.slice(start + 1, tag.indexOf('"', start + 1));
    }
    let inner = 0;
    for (let end = start; end < tag.length; end += 1) {
      inner += tag.charAt(end) === '{' ? 1 : tag.charAt(end) === '}' ? -1 : 0;
      if (inner === 0) {
        return tag.slice(start + 1, end);
      }
    }
  }
  return undefined;
};

type DeclarationParams = {
  readonly text: string;
  readonly name: string;
};

const declarationOf = ({ text, name }: DeclarationParams): string | undefined => {
  const match = new RegExp(`\\b(?:const|let)\\s+${name}\\b[^=\\n]*=\\s*`).exec(text);
  if (match === null) {
    return undefined;
  }
  const rest = text.slice(match.index + match[0].length);
  const end = rest.search(/;[ \t]*\n/);
  const blank = rest.indexOf('\n\n');
  const stop = [end, blank].filter((index) => index !== -1);
  return stop.length === 0 ? rest : rest.slice(0, Math.min(...stop));
};

type ContentParams = {
  readonly text: string;
  readonly content: string;
};

const expandContent = ({ text, content }: ContentParams): string => {
  const trimmed = content.trim();
  if (!/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
    return trimmed;
  }
  return declarationOf({ text, name: trimmed }) ?? trimmed;
};

const countTooltip = ({ text, tag }: { readonly text: string; readonly tag: string }): number => {
  const content = attributeValue({ tag, attribute: 'content' });
  const body = content === undefined ? '' : expandContent({ text, content });
  return [
    JSX_START.test(body.trim()),
    FACT_JOIN.test(body),
    GREY_TEXT.test(body),
    CARD_VARIANT.test(tag),
  ].filter(Boolean).length;
};

const countKinds = ({ text }: { readonly text: string }): number =>
  TOOLTIP_NAMES.flatMap((name) => openingTags({ text, name })).reduce(
    (sum, tag) => sum + countTooltip({ text, tag }),
    0,
  );

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources().map(({ path, text }) => [path, countKinds({ text })]),
    ),
  });

describe('a tooltip is a one line label or a FactCard, never a hand built card', () => {
  it('counts JSX content, joined facts, grey text, and the card variant', () => {
    expect(countKinds({ text: '<Tooltip content="Open the session"><X /></Tooltip>' })).toBe(0);
    expect(countKinds({ text: '<Tooltip content={t}><X /></Tooltip>' })).toBe(0);
    expect(countKinds({ text: '<Tooltip content={<div>Harborline</div>}><X /></Tooltip>' })).toBe(
      1,
    );
    expect(
      countKinds({ text: '<OptionalTooltip content={`${a} · ${b}`}><X /></OptionalTooltip>' }),
    ).toBe(1);
    expect(countKinds({ text: '<Tooltip content={[a, b].join(", ")}><X /></Tooltip>' })).toBe(1);
    expect(
      countKinds({
        text: '<Tooltip content={<p className="text-faint-foreground">{a}</p>}><X /></Tooltip>',
      }),
    ).toBe(2);
    expect(countKinds({ text: '<Tooltip content="Open" variant="card"><X /></Tooltip>' })).toBe(1);
    expect(countKinds({ text: '<Section content="Open" variant="card" />' })).toBe(0);
  });

  it('follows a content variable declared in the same file', () => {
    const joined =
      'const tip = [a, b].join(" · ");\n\nconst x = <Tooltip content={tip}><X /></Tooltip>;';
    const jsx =
      'const tip = (\n  <div className="text-muted-foreground">x</div>\n);\n\nreturn <Tooltip content={tip}><X /></Tooltip>;';

    expect(countKinds({ text: joined })).toBe(1);
    expect(countKinds({ text: jsx })).toBe(2);
  });

  it('finds no hand built tooltip in product code', () => {
    const found = Object.entries(measure()).map(([path, count]) => `${path}: ${count}`);
    expect(
      found,
      [
        'A tooltip is one sentence or a FactCard. One sentence stays in Tooltip as a plain',
        'string. Two facts or more go to FactCard as data (title, state, up to six facts).',
        'Text that is already visible needs no tooltip, or TruncatedText when it is cut.',
        'Never join facts with a separator, never pass JSX, never grey the text inside.',
        found.join('\n'),
      ].join('\n'),
    ).toEqual([]);
  });
});
