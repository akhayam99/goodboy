import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const appStylesPath = resolve(new URL('../../apps/desktop/src/styles.css', import.meta.url).pathname);
const outputPath = resolve(new URL('../src/components/mocks/app-tokens.css', import.meta.url).pathname);
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

const STATE_TOKEN_NAMES = [
  'border',
  'primary',
  'on-tone',
  'success',
  'info',
  'warning',
  'danger',
  'merged',
  'draft',
  'faint-foreground',
  'muted-foreground',
  'border-soft',
  'fill',
  ...Array.from({ length: 8 }, (_, index) => `identity-${index + 1}`),
  'provider-anthropic',
  'provider-cursor',
  'provider-codex',
  'provider-gemini',
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
  const declarationPattern = /--color-([\w-]+):\s*([^;]+);/g;
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
  return {
    dark: readTheme({ source, start: themeStart, end: themeEnd }),
    light: readTheme({ source, start: lightBlockStart, end: lightEnd }),
  };
};

const getValue = ({ theme, name }) => {
  const value = theme.get(name);
  if (value === undefined) {
    throw new Error(`Missing app token: --color-${name}`);
  }
  return value;
};

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

const render = ({ themes }) => `${renderTheme({ selector: ':root', theme: themes.light })}\n\n${renderTheme({ selector: ":root[data-theme='dark']", theme: themes.dark })}\n`;

const main = async () => {
  const source = await readFile(appStylesPath, 'utf8');
  const themes = getThemes({ source });
  const expected = render({ themes });
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (checkOnly) {
    if (current !== expected) {
      throw new Error('website/src/components/mocks/app-tokens.css is out of sync with apps/desktop/src/styles.css');
    }
    return;
  }
  await writeFile(outputPath, expected);
};

await main();
