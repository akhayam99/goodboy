import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appStylesPath = resolve(
  new URL('../../apps/desktop/src/styles.css', import.meta.url).pathname,
);
const outputPath = resolve(
  new URL('../src/mocks/generated/app-tokens.css', import.meta.url).pathname,
);
const checkOnly = process.argv.includes('--check');

const AGENT_TOKEN_NAMES = [
  'generic',
  'scout',
  'planner',
  'implementer',
  'debugger',
  'tester',
  'reviewer',
  'pr-reviewer',
  'docs',
  'report',
  'resolver',
  'rewriter',
  'scribe',
  'wireframe',
];

const TONE_NAMES = ['primary', 'info', 'success', 'warning', 'danger', 'merged', 'draft'];

const TONE_STEP_NAMES = TONE_NAMES.flatMap((tone) => [
  `${tone}-wash`,
  `${tone}-subtle`,
  `${tone}-edge`,
  `${tone}-solid`,
  `${tone}-solid-hover`,
  `on-${tone}`,
]);

const STATE_TOKEN_NAMES = [
  'border',
  'primary',
  'success',
  'info',
  'warning',
  'danger',
  'merged',
  'draft',
  'faint-foreground',
  'muted-foreground',
  'border-soft',
  'border-control',
  'fill',
  ...TONE_STEP_NAMES,
  ...Array.from({ length: 8 }, (_, index) => `identity-${index + 1}`),
  'provider-anthropic',
  'provider-cursor',
  'provider-codex',
  'provider-gemini',
  'provider-copilot',
  'provider-opencode',
  'provider-openrouter',
  'provider-moonshot',
  'provider-jira',
  'provider-bitbucket',
  'provider-linear',
  'provider-sentry',
  'provider-gitlab',
  'provider-github',
  'provider-slack',
  'syntax-keyword',
  'syntax-string',
  'syntax-number',
  'syntax-comment',
  'syntax-function',
  'syntax-type',
  'syntax-constant',
  'syntax-property',
  'syntax-operator',
  'syntax-punctuation',
  'syntax-tag',
  'syntax-regex',
];

const readTheme = ({ source, start, end }) => {
  const declarations = new Map();
  const block = source.slice(start, end);
  const declarationPattern = /--([\w-]+):\s*([^;]+);/g;
  for (const match of block.matchAll(declarationPattern)) {
    declarations.set(match[1], match[2].trim());
  }
  return declarations;
};

const getThemes = ({ source }) => {
  const themeStart = source.indexOf('@theme');
  const themeEnd = source.indexOf('\n}', themeStart) + 2;
  const lightStart = source.indexOf("html[data-theme='light']");
  const lightBlockStart = source.indexOf('{', lightStart) + 1;
  const lightEnd = source.indexOf('\n}', lightBlockStart) + 2;
  const dark = readTheme({ source, start: themeStart, end: themeEnd });
  const light = readTheme({ source, start: lightBlockStart, end: lightEnd });
  return {
    dark,
    light: new Map([...dark, ...light]),
  };
};

const resolveValue = ({ theme, property, seen }) => {
  const value = theme.get(property);
  if (value === undefined) {
    throw new Error(`Missing app token: --${property}`);
  }
  if (seen.includes(property)) {
    throw new Error(`Circular app token: --${property}`);
  }
  return value.replace(/var\(--([\w-]+)\)/g, (_reference, name) =>
    resolveValue({ theme, property: name, seen: [...seen, property] }),
  );
};

const getValue = ({ theme, name }) => resolveValue({ theme, property: `color-${name}`, seen: [] });

const renderTheme = ({ selector, theme }) => {
  const lines = [`${selector} {`];
  for (const name of AGENT_TOKEN_NAMES) {
    lines.push(`  --g-agent-${name}: ${getValue({ theme, name: `agent-${name}` })};`);
  }
  for (const name of STATE_TOKEN_NAMES) {
    lines.push(`  --g-${name}: ${getValue({ theme, name })};`);
  }
  lines.push('}');
  return lines.join('\n');
};

const render = ({ themes }) =>
  `${renderTheme({ selector: ':root', theme: themes.light })}\n\n${renderTheme({ selector: ":root[data-theme='dark']", theme: themes.dark })}\n`;

const main = async () => {
  const source = await readFile(appStylesPath, 'utf8');
  const themes = getThemes({ source });
  const expected = render({ themes });
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (checkOnly) {
    if (current !== expected) {
      throw new Error(
        'website/src/mocks/generated/app-tokens.css is out of sync with apps/desktop/src/styles.css',
      );
    }
    return;
  }
  await writeFile(outputPath, expected);
};

await main();
