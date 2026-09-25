const DECLARATION = /(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g;

const COMMENT = new RegExp('/[*][\\s\\S]*?[*]/', 'g');

const blockAfter = ({ css, opener }: { readonly css: string; readonly opener: string }): string => {
  const start = css.indexOf(opener);
  if (start === -1) {
    return '';
  }
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') {
      depth += 1;
    }
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(open + 1, index);
      }
    }
  }
  return '';
};

const declarations = ({ block }: { readonly block: string }): ReadonlyMap<string, string> =>
  new Map(
    [...block.replace(COMMENT, '').matchAll(DECLARATION)].map(
      (match) => [String(match[1]), String(match[2]).replace(/\s+/g, ' ').trim()] as const,
    ),
  );

export const documentTokens = ({ styles }: { readonly styles: string }): string => {
  const merged = new Map([
    ...declarations({ block: blockAfter({ css: styles, opener: '@theme' }) }),
    ...declarations({ block: blockAfter({ css: styles, opener: "html[data-theme='light'] {" }) }),
  ]);
  const lines = [...merged].map(([name, value]) => `  ${name}: ${value};`);
  return [':root {', ...lines, '}', ''].join('\n');
};
