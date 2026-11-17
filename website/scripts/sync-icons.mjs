import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const WEBSITE_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..');
const REPOSITORY_DIRECTORY = resolve(WEBSITE_DIRECTORY, '..');

const OUTPUT_PATH = resolve(WEBSITE_DIRECTORY, 'src/mocks/generated/icons.tsx');
const BRAND_SOURCES_PATH = resolve(WEBSITE_DIRECTORY, 'src/components/brandIcons.source.json');
const APP_BRAND_PATH = resolve(REPOSITORY_DIRECTORY, 'packages/ui/src/components/brandIcons.tsx');
const COPILOT_ICON_PATH = resolve(
  REPOSITORY_DIRECTORY,
  'packages/ui/src/components/CopilotIcon.tsx',
);
const APP_SOURCE_DIRECTORIES = [
  resolve(REPOSITORY_DIRECTORY, 'apps/desktop/src'),
  resolve(REPOSITORY_DIRECTORY, 'packages/ui/src'),
];
const APP_ICONS_DIRECTORY = resolve(REPOSITORY_DIRECTORY, 'packages/ui/src/icons');
const APP_ICONS_INDEX_PATH = resolve(APP_ICONS_DIRECTORY, 'index.ts');
const APP_ICON_EXPORT = /^export \{ (\w+)(?: as (\w+))? \} from '\.\/generated\/(\w+)';$/gm;
const APP_GLYPH_DRAWING = /drawing: (\{[\s\S]*?\n {2}\}),\n\}\);/;

const SOURCE_DIRECTORY = resolve(WEBSITE_DIRECTORY, 'src');
const ICON_IMPORT =
  /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'(?:\.\.?\/)+(?:mocks\/)?(?:generated\/)?icons'/g;

const APP_BRAND_EXPORTS = {
  ClaudeIcon: 'anthropic',
  OpenAIIcon: 'codex',
  CursorIcon: 'cursor',
  GeminiIcon: 'gemini',
  OpencodeIcon: 'opencode',
  OpenrouterIcon: 'openrouter',
  MoonshotIcon: 'moonshot',
  GithubIcon: 'github',
  GitlabIcon: 'gitlab',
  BitbucketIcon: 'bitbucket',
  LinearIcon: 'linear',
  JiraIcon: 'jira',
  SentryIcon: 'sentry',
  SlackIcon: 'slack',
};

const PROVIDER_DRIFT_ALLOWED = ['gemini', 'moonshot'];

const IS_CHECK = process.argv.includes('--check');

const failures = [];

const fail = (message) => failures.push(message);

const loadAppGlyphs = () =>
  new Map(
    [...readFileSync(APP_ICONS_INDEX_PATH, 'utf8').matchAll(APP_ICON_EXPORT)].map((match) => [
      match[2] ?? match[1],
      match[3],
    ]),
  );

const readDrawing = ({ appGlyphs, name }) => {
  const file = appGlyphs.get(name);
  const source = readFileSync(resolve(APP_ICONS_DIRECTORY, 'generated', `${file}.ts`), 'utf8');
  const drawing = source.match(APP_GLYPH_DRAWING);
  if (drawing === null) {
    throw new Error(`Could not read the drawing of ${name} in generated/${file}.ts`);
  }
  return new Function(`return ${drawing[1]};`)();
};

const listWebsiteFiles = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) {
      return listWebsiteFiles(path);
    }
    return /\.tsx?$/.test(entry) && path !== OUTPUT_PATH ? [path] : [];
  });

const readUsedNames = ({ appGlyphs }) =>
  [
    ...new Set(
      listWebsiteFiles(SOURCE_DIRECTORY).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(ICON_IMPORT)].flatMap((match) =>
          match[1]
            .split(',')
            .map((part) => part.trim().replace(/^type\s+/, ''))
            .filter((name) => appGlyphs.has(name)),
        ),
      ),
    ),
  ].sort();

const readCopilotPath = () => {
  const source = readFileSync(COPILOT_ICON_PATH, 'utf8');
  const paths = [...source.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);
  if (paths.length === 0) {
    throw new Error('Could not find the app glyph CopilotIcon');
  }
  return paths.join(' ');
};

const readAppBrandPaths = () => {
  const source = readFileSync(APP_BRAND_PATH, 'utf8');
  return Object.fromEntries([
    ['copilot', readCopilotPath()],
    ...Object.entries(APP_BRAND_EXPORTS).map(([exportName, id]) => {
      const match = source.match(
        new RegExp(`export const ${exportName}\\b[\\s\\S]*?<path d="([^"]+)"`),
      );
      if (match === null) {
        throw new Error(`Could not find the app glyph ${exportName}`);
      }
      return [id, match[1]];
    }),
  ]);
};

const literal = (value) => JSON.stringify(value).replace(/'/g, "\\'").replace(/"/g, "'");

const drawingLiteral = (drawing) => {
  const entries = [`regular: ${literal(drawing.regular)}`];
  if (drawing.fill !== undefined) {
    entries.push(`fill: ${literal(drawing.fill)}`);
  }
  if (drawing.duotone !== undefined) {
    entries.push(
      `duotone: { shade: ${literal(drawing.duotone.shade)}, line: ${literal(drawing.duotone.line)} }`,
    );
  }
  return `{ ${entries.join(', ')} }`;
};

const buildSource = ({ appGlyphs, brandPaths, names }) => {
  const iconLines = names.map(
    (name) =>
      `export const ${name} = glyph({ drawing: ${drawingLiteral(readDrawing({ appGlyphs, name }))} });`,
  );
  const brandLines = Object.keys(brandPaths)
    .sort()
    .map((id) => `  ${id}: ${literal(brandPaths[id])},`);

  return `import { createElement, type ReactElement, type SVGProps } from 'react';

export type IconWeight = 'regular' | 'bold' | 'fill' | 'duotone';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  readonly color?: string;
  readonly size?: number;
  readonly weight?: IconWeight;
};

export type IconComponent = (props: IconProps) => ReactElement;

type GlyphDrawing = {
  readonly regular: string;
  readonly fill?: string;
  readonly duotone?: { readonly shade: string; readonly line: string };
};

type PathsParams = {
  readonly drawing: GlyphDrawing;
  readonly weight: IconWeight;
  readonly color: string;
};

type GlyphParams = {
  readonly drawing: GlyphDrawing;
};

const BOLD_STROKE_WIDTH = 8;

const pathsOf = ({ drawing, weight, color }: PathsParams): ReactElement[] => {
  if (weight === 'bold') {
    return [
      createElement('path', {
        key: 'bold',
        d: drawing.regular,
        stroke: color,
        strokeWidth: BOLD_STROKE_WIDTH,
        strokeLinejoin: 'round',
      }),
    ];
  }
  if (weight === 'fill' && drawing.fill != null) {
    return [createElement('path', { key: 'fill', d: drawing.fill })];
  }
  if (weight === 'duotone' && drawing.duotone != null) {
    return [
      createElement('path', { key: 'shade', d: drawing.duotone.shade, opacity: '0.2' }),
      createElement('path', { key: 'line', d: drawing.duotone.line }),
    ];
  }
  return [createElement('path', { key: 'regular', d: drawing.regular })];
};

const glyph =
  ({ drawing }: GlyphParams): IconComponent =>
  ({ color = 'currentColor', size = 24, weight = 'regular', ...rest }) =>
    createElement(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        width: size,
        height: size,
        fill: color,
        viewBox: '0 0 256 256',
        'aria-hidden': true,
        focusable: false,
        ...rest,
      },
      pathsOf({ drawing, weight, color }),
    );

${iconLines.join('\n')}

export const APP_BRAND_PATHS = {
${brandLines.join('\n')}
} as const;

export type AppBrandId = keyof typeof APP_BRAND_PATHS;

type AppBrandProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  readonly brand: AppBrandId;
  readonly size?: number;
};

export const AppBrandIcon = ({ brand, size = 16, ...rest }: AppBrandProps) =>
  createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      'aria-hidden': true,
      focusable: false,
      ...rest,
    },
    createElement('path', { d: APP_BRAND_PATHS[brand] }),
  );
`;
};

const formatSource = async (source) => {
  const requireFromRepository = createRequire(resolve(REPOSITORY_DIRECTORY, 'package.json'));
  const prettier = requireFromRepository('prettier');
  const options = (await prettier.resolveConfig(OUTPUT_PATH)) ?? {};
  return prettier.format(source, { ...options, filepath: OUTPUT_PATH });
};

const listSourceFiles = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist') {
      return [];
    }
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) {
      return listSourceFiles(path);
    }
    return /\.tsx?$/.test(entry) ? [path] : [];
  });

const checkNamesInApp = ({ names }) => {
  const imported = new Set(
    APP_SOURCE_DIRECTORIES.flatMap(listSourceFiles).flatMap((file) =>
      [
        ...readFileSync(file, 'utf8').matchAll(
          /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'(?:@goodboy\/ui\/|(?:\.{1,2}\/)+)icons'/g,
        ),
      ].flatMap((match) =>
        match[1].split(',').map(
          (part) =>
            part
              .trim()
              .replace(/^type\s+/, '')
              .split(/\s+as\s+/)[0],
        ),
      ),
    ),
  );
  names
    .filter((name) => !imported.has(name))
    .forEach((name) => fail(`icons: ${name} is no longer imported by the app`));
};

const checkBrandSources = ({ brandPaths }) => {
  const sources = JSON.parse(readFileSync(BRAND_SOURCES_PATH, 'utf8'));
  sources.forEach((source) => {
    const appPath = brandPaths[source.id];
    if (appPath === undefined) {
      fail(`icons: provider ${source.id} has no app glyph`);
      return;
    }
    const isSame = appPath === source.path;
    const isAllowed = PROVIDER_DRIFT_ALLOWED.includes(source.id);
    if (!isSame && !isAllowed) {
      fail(`icons: provider ${source.id} differs between brandIcons.source.json and the app`);
    }
    if (isSame && isAllowed) {
      fail(
        `icons: provider ${source.id} now matches the app, remove it from PROVIDER_DRIFT_ALLOWED`,
      );
    }
  });
};

const main = async () => {
  if (!existsSync(APP_BRAND_PATH)) {
    throw new Error(`Missing ${APP_BRAND_PATH}`);
  }
  const appGlyphs = loadAppGlyphs();
  const brandPaths = readAppBrandPaths();
  const names = readUsedNames({ appGlyphs });
  const expected = await formatSource(buildSource({ appGlyphs, brandPaths, names }));

  checkNamesInApp({ names });
  checkBrandSources({ brandPaths });

  if (IS_CHECK) {
    const current = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, 'utf8') : '';
    if (current !== expected) {
      fail('icons: mocks/generated/icons.tsx is out of date, run node scripts/sync-icons.mjs');
    }
  } else {
    writeFileSync(OUTPUT_PATH, expected);
  }

  if (failures.length > 0) {
    failures.forEach((message) => console.error(message));
    process.exit(1);
  }
  console.log(
    IS_CHECK
      ? `icons ok: ${names.length} phosphor glyphs, ${Object.keys(brandPaths).length} brand glyphs`
      : `icons written: ${names.length} phosphor glyphs, ${Object.keys(brandPaths).length} brand glyphs`,
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
