import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const WEBSITE_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..');
const REPOSITORY_DIRECTORY = resolve(WEBSITE_DIRECTORY, '..');

const OUTPUT_PATH = resolve(WEBSITE_DIRECTORY, 'src/components/mocks/icons.tsx');
const BRAND_SOURCES_PATH = resolve(WEBSITE_DIRECTORY, 'src/components/brandIcons.source.json');
const APP_BRAND_PATH = resolve(REPOSITORY_DIRECTORY, 'packages/ui/src/components/brandIcons.tsx');
const APP_SOURCE_DIRECTORIES = [
  resolve(REPOSITORY_DIRECTORY, 'apps/desktop/src'),
  resolve(REPOSITORY_DIRECTORY, 'packages/ui/src'),
];
const LUCIDE_RESOLVE_ROOT = resolve(REPOSITORY_DIRECTORY, 'apps/desktop/package.json');

const SOURCE_DIRECTORY = resolve(WEBSITE_DIRECTORY, 'src');
const ICON_IMPORT = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'(?:\.\.?\/)+(?:mocks\/)?icons'/g;

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

const loadLucide = () => {
  const requireFromApp = createRequire(LUCIDE_RESOLVE_ROOT);
  const packageJsonPath = requireFromApp.resolve('lucide-react/package.json');
  const packageDirectory = dirname(packageJsonPath);
  const version = JSON.parse(readFileSync(packageJsonPath, 'utf8')).version;
  const indexSource = readFileSync(resolve(packageDirectory, 'dist/esm/lucide-react.mjs'), 'utf8');
  const files = new Map(
    [...indexSource.matchAll(/^export \{([^}]*)\} from '\.\/icons\/([\w-]+\.mjs)';$/gm)].flatMap(
      (match) => [...match[1].matchAll(/default as (\w+)/g)].map((alias) => [alias[1], match[2]]),
    ),
  );
  return { packageDirectory, version, files };
};

const readNodes = (source) => {
  const data = source.match(/const __iconData = (\{[\s\S]*?\n\});\n/);
  if (data !== null) {
    return new Function(`return ${data[1]};`)().node;
  }
  const legacy = source.match(/const __iconNode = (\[[\s\S]*?\]);\nconst /);
  if (legacy !== null) {
    return new Function(`return ${legacy[1]};`)();
  }
  return null;
};

const readIconNode = ({ lucide, name }) => {
  const file = lucide.files.get(name);
  if (file === undefined) {
    throw new Error(`lucide-react ${lucide.version} has no icon named ${name}`);
  }
  const source = readFileSync(resolve(lucide.packageDirectory, 'dist/esm/icons', file), 'utf8');
  const nodes = readNodes(source);
  if (nodes === null) {
    throw new Error(`Could not read the icon node of ${name}`);
  }
  return nodes.map(([tag, attributes]) => {
    const { key: _key, ...rest } = attributes;
    return [tag, rest];
  });
};

const listWebsiteFiles = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) {
      return listWebsiteFiles(path);
    }
    return /\.tsx?$/.test(entry) && path !== OUTPUT_PATH ? [path] : [];
  });

const readUsedNames = ({ lucide }) =>
  [
    ...new Set(
      listWebsiteFiles(SOURCE_DIRECTORY).flatMap((file) =>
        [...readFileSync(file, 'utf8').matchAll(ICON_IMPORT)].flatMap((match) =>
          match[1]
            .split(',')
            .map((part) => part.trim().replace(/^type\s+/, ''))
            .filter((name) => lucide.files.has(name)),
        ),
      ),
    ),
  ].sort();

const readAppBrandPaths = () => {
  const source = readFileSync(APP_BRAND_PATH, 'utf8');
  return Object.fromEntries(
    Object.entries(APP_BRAND_EXPORTS).map(([exportName, id]) => {
      const match = source.match(
        new RegExp(`export const ${exportName}\\b[\\s\\S]*?<path d="([^"]+)"`),
      );
      if (match === null) {
        throw new Error(`Could not find the app glyph ${exportName}`);
      }
      return [id, match[1]];
    }),
  );
};

const literal = (value) => JSON.stringify(value).replace(/'/g, "\\'").replace(/"/g, "'");

const objectLiteral = (attributes) =>
  `{ ${Object.entries(attributes)
    .map(([key, value]) => `${/^[a-zA-Z_]\w*$/.test(key) ? key : literal(key)}: ${literal(value)}`)
    .join(', ')} }`;

const buildSource = ({ lucide, brandPaths, names }) => {
  const iconLines = names.map((name) => {
    const nodes = readIconNode({ lucide, name });
    const body = nodes.map(
      ([tag, attributes]) => `[${literal(tag)}, ${objectLiteral(attributes)}]`,
    );
    return `export const ${name} = createIcon([${body.join(', ')}]);`;
  });
  const brandLines = Object.keys(brandPaths)
    .sort()
    .map((id) => `  ${id}: ${literal(brandPaths[id])},`);

  return `import { createElement, type ReactElement, type SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  readonly size?: number;
  readonly strokeWidth?: number;
};

export type IconComponent = (props: IconProps) => ReactElement;

type IconNode = readonly (readonly [string, Record<string, string>])[];

const createIcon =
  (nodes: IconNode): IconComponent =>
  ({ size = 24, strokeWidth = 2, ...rest }) =>
    createElement(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: false,
        ...rest,
      },
      nodes.map(([tag, attributes], index) => createElement(tag, { ...attributes, key: index })),
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
          /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'lucide-react'/g,
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
  const lucide = loadLucide();
  const brandPaths = readAppBrandPaths();
  const names = readUsedNames({ lucide });
  const expected = await formatSource(buildSource({ lucide, brandPaths, names }));

  checkNamesInApp({ names });
  checkBrandSources({ brandPaths });

  if (IS_CHECK) {
    const current = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, 'utf8') : '';
    if (current !== expected) {
      fail('icons: mocks/icons.tsx is out of date, run node scripts/sync-icons.mjs');
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
      ? `icons ok: ${names.length} lucide icons, ${Object.keys(brandPaths).length} app glyphs`
      : `icons written: ${names.length} lucide icons, ${Object.keys(brandPaths).length} app glyphs`,
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
