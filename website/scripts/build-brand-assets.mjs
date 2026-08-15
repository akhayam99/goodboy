import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const WEBSITE_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..');
const REPOSITORY_DIRECTORY = resolve(WEBSITE_DIRECTORY, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const readSource = (relativePath) =>
  readFileSync(resolve(REPOSITORY_DIRECTORY, relativePath), 'utf8');

const requireMatch = ({ source, pattern, description }) => {
  const match = source.match(pattern);
  if (match !== null) {
    return match;
  }
  throw new Error(`Could not find ${description}`);
};

const extractBraceBlock = ({ source, startIndex, description }) => {
  const openIndex = source.indexOf('{', startIndex);
  if (openIndex === -1) {
    throw new Error(`Could not find opening brace for ${description}`);
  }
  const characters = source.slice(openIndex);
  const closingOffset = characters.split('').reduce(
    (state, character, index) => {
      if (state.closingOffset !== -1) {
        return state;
      }
      const depth = character === '{'
        ? state.depth + 1
        : character === '}'
          ? state.depth - 1
          : state.depth;
      return {
        depth,
        closingOffset: depth === 0 ? index : -1,
      };
    },
    { depth: 0, closingOffset: -1 },
  ).closingOffset;
  if (closingOffset === -1) {
    throw new Error(`Could not find closing brace for ${description}`);
  }
  return characters.slice(0, closingOffset + 1);
};

const extractQuotedValues = ({ source, description }) => {
  const values = [...source.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  if (values.length > 0) {
    return values;
  }
  throw new Error(`Could not find literal members for ${description}`);
};

const parseSocialFormats = (brandSource) => {
  const section = requireMatch({
    source: brandSource,
    pattern: /## Social formats\s+([\s\S]*?)(?=\n##\s|$)/,
    description: 'the Social formats section in docs/brand.md',
  })[1];
  const rows = section
    .split('\n')
    .filter((line) => /^\|/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter(([surface, size]) => surface !== 'Surface' && !/^-+$/.test(surface) && size !== undefined)
    .map(([surface, size, keepClear]) => {
      const dimensions = requireMatch({
        source: size,
        pattern: /(\d+)x(\d+)/,
        description: `dimensions for ${surface} in docs/brand.md`,
      });
      const scale = /\b2x\b/i.test(size) ? 2 : 1;
      return {
        surface,
        width: Number(dimensions[1]),
        height: Number(dimensions[2]),
        scale,
        keepClear,
      };
    });
  if (rows.length === 5) {
    return rows;
  }
  throw new Error(`Expected five Social formats rows, found ${rows.length}`);
};

const parseProviderIds = (providerRegistrySource) => {
  const arraySource = requireMatch({
    source: providerRegistrySource,
    pattern: /export const PROVIDER_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/,
    description: 'PROVIDER_IDS in provider-registry.ts',
  })[1];
  return extractQuotedValues({ source: arraySource, description: 'PROVIDER_IDS' });
};

const parseProviderBrand = ({ providerBrandSource, providerIds }) => {
  const declarationIndex = providerBrandSource.indexOf('export const PROVIDER_BRAND');
  if (declarationIndex === -1) {
    throw new Error('Could not find PROVIDER_BRAND in provider-brand.ts');
  }
  const block = extractBraceBlock({
    source: providerBrandSource,
    startIndex: declarationIndex,
    description: 'PROVIDER_BRAND',
  });
  const entries = [...block.matchAll(
    /([a-z][a-z0-9]*):\s*\{\s*icon:\s*([A-Za-z][A-Za-z0-9]*),\s*cssVar:\s*['"]([^'"]+)['"]\s*\}/g,
  )].reduce(
    (brands, match) => ({
      ...brands,
      [match[1]]: { iconName: match[2], cssVar: match[3] },
    }),
    {},
  );
  return providerIds.map((id) => {
    const entry = entries[id];
    if (entry !== undefined) {
      return { id, ...entry };
    }
    throw new Error(`Could not find PROVIDER_BRAND entry for ${id}`);
  });
};

const extractIconPath = ({ iconSource, componentName }) => {
  const declaration = `export const ${componentName}:`;
  const declarationIndex = iconSource.indexOf(declaration);
  if (declarationIndex === -1) {
    throw new Error(`Could not find ${componentName} in brandIcons.tsx`);
  }
  const blockEnd = iconSource.indexOf(`${componentName}.displayName`, declarationIndex);
  if (blockEnd === -1) {
    throw new Error(`Could not find the end of ${componentName} in brandIcons.tsx`);
  }
  const block = iconSource.slice(declarationIndex, blockEnd);
  return requireMatch({
    source: block,
    pattern: /<path\s+d=["']([^"']+)["']\s*\/>/,
    description: `path data for ${componentName} in brandIcons.tsx`,
  })[1];
};

const extractCssBlock = ({ stylesSource, selector }) => {
  const selectorIndex = stylesSource.indexOf(selector);
  if (selectorIndex === -1) {
    throw new Error(`Could not find ${selector} in styles.css`);
  }
  return extractBraceBlock({
    source: stylesSource,
    startIndex: selectorIndex,
    description: selector,
  });
};

const extractCssValue = ({ cssSource, variableName }) =>
  requireMatch({
    source: cssSource,
    pattern: new RegExp(`${variableName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*:\\s*([^;]+);`),
    description: `${variableName} in the light theme`,
  })[1].trim();

const resolveBrands = ({ brands, iconSource, lightThemeSource }) =>
  brands.map(({ id, iconName, cssVar }) => ({
    id,
    path: extractIconPath({ iconSource, componentName: iconName }),
    color: extractCssValue({ cssSource: lightThemeSource, variableName: cssVar }),
  }));

const createMascot = ({ className, mascotBase64 }) =>
  `<i class="${className}" style="-webkit-mask: url(data:image/png;base64,${mascotBase64}) no-repeat center / contain"></i>`;

const createLockupHtml = ({ mascotBase64, tagline = '' }) => `
  <div class="lockup">
    ${createMascot({ className: 'mascot', mascotBase64 })}
    <div class="lockup-copy">
      <span>Goodboy</span>
      ${tagline === '' ? '' : `<small>${tagline}</small>`}
    </div>
  </div>`;

const createBaseHtml = ({ width, height, accent, bodyClass, content, extraCss = '' }) => `<!doctype html>
<meta charset="utf-8">
<style>
  @page { size: ${width}px ${height}px; margin: 0 }
  * { margin: 0; padding: 0; box-sizing: border-box }
  html, body { width: ${width}px; height: ${height}px }
  body { background: #fff; color: #101113; font-family: "Avenir Next", "Avenir", -apple-system, BlinkMacSystemFont, sans-serif; overflow: hidden }
  .mascot { display: block; background: ${accent} }
  ${extraCss}
</style>
<body class="${bodyClass}">${content}</body>`;

const createOgHtml = ({ format, accent, mascotBase64, providerBrands, date }) => {
  const marks = providerBrands.map(({ id, path, color }) =>
    `<svg aria-label="${id}" width="30" height="30" viewBox="0 0 24 24" fill="${color}"><path d="${path}"/></svg>`,
  ).join('');
  const content = `
    <div class="brand">${createMascot({ className: 'mascot', mascotBase64 })}<span>Goodboy</span></div>
    <h1>Stop <em>re&#8209;explaining yourself.</em></h1>
    <p class="sub">Describe a task once. Goodboy decides which agent goes next, on the plans you already pay for.</p>
    <div class="foot">
      <span class="dom">goodboy-ai.dev</span>
      <span class="marks-wrap"><span class="marks">${marks}</span><small>providers as of ${date}</small></span>
      <span class="note">free and open source</span>
    </div>`;
  return createBaseHtml({
    width: format.width,
    height: format.height,
    accent,
    bodyClass: 'og',
    content,
    extraCss: `
      body { padding: 68px 76px; display: flex; flex-direction: column; position: relative }
      body:before { content: ""; position: absolute; top: -280px; right: -220px; width: 780px; height: 780px; border-radius: 50%; background: radial-gradient(circle, color-mix(in oklch, ${accent} 16%, transparent), transparent 62%) }
      .brand { display: flex; align-items: center; gap: 14px; position: relative }
      .brand .mascot { width: 54px; height: 54px }
      .brand span { font-size: 38px; font-weight: 600; letter-spacing: -0.015em }
      h1 { margin-top: auto; font-size: 88px; font-weight: 500; line-height: 1.04; letter-spacing: -0.02em; position: relative }
      h1 em { font-style: normal; color: ${accent} }
      .sub { margin-top: 26px; font-size: 30px; line-height: 1.35; color: #495057; max-width: 940px; position: relative }
      .foot { margin-top: auto; padding-top: 40px; display: flex; align-items: center; gap: 22px; position: relative }
      .dom { font-size: 24px; font-weight: 600 }
      .marks-wrap { display: flex; flex-direction: column; align-items: center; gap: 7px }
      .marks { display: flex; align-items: center; gap: 14px }
      .marks-wrap small { color: #66707a; font-size: 12px; letter-spacing: 0.02em }
      .note { font-size: 22px; color: #66707a; margin-left: auto }
    `,
  });
};

const createAvatarHtml = ({ format, accent, mascotBase64 }) => createBaseHtml({
  width: format.width,
  height: format.height,
  accent,
  bodyClass: 'avatar',
  content: createMascot({ className: 'mascot', mascotBase64 }),
  extraCss: `
    body { display: grid; place-items: center; padding: 18% }
    .mascot { width: 60vh; height: 60vh }
  `,
});

const createBannerHtml = ({ format, accent, mascotBase64, variant }) => {
  const isXHeader = variant === 'x-header';
  const tagline = isXHeader ? 'Your agents, in the right order.' : '';
  return createBaseHtml({
    width: format.width,
    height: format.height,
    accent,
    bodyClass: variant,
    content: createLockupHtml({ mascotBase64, tagline }),
    extraCss: `
      body { display: flex; align-items: center; justify-content: flex-end; padding: ${isXHeader ? '9% 10% 9% 35%' : '8% 9% 8% 34%'} }
      .lockup { display: flex; align-items: center; gap: ${isXHeader ? '34px' : '24px'} }
      .mascot { width: ${isXHeader ? '138px' : '104px'}; height: ${isXHeader ? '138px' : '104px'}; flex: none }
      .lockup-copy { display: flex; flex-direction: column; gap: 10px }
      .lockup-copy span { font-size: ${isXHeader ? '86px' : '68px'}; font-weight: 600; letter-spacing: -0.025em; line-height: 1 }
      .lockup-copy small { color: #495057; font-size: 30px; white-space: nowrap }
    `,
  });
};

const outputPathFor = (surface) => surface === 'og-image'
  ? resolve(WEBSITE_DIRECTORY, 'public/og-image.png')
  : resolve(WEBSITE_DIRECTORY, `public/brand/${surface.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`);

const createHtmlFor = ({ format, accent, mascotBase64, providerBrands, date }) => {
  if (format.surface === 'og-image') {
    return createOgHtml({ format, accent, mascotBase64, providerBrands, date });
  }
  if (format.surface === 'X avatar') {
    return createAvatarHtml({ format, accent, mascotBase64 });
  }
  const variants = {
    'X header': 'x-header',
    'LinkedIn company cover': 'linkedin-company-cover',
    'LinkedIn profile background': 'linkedin-profile-background',
  };
  const variant = variants[format.surface];
  if (variant !== undefined) {
    return createBannerHtml({ format, accent, mascotBase64, variant });
  }
  throw new Error(`No brand asset layout exists for ${format.surface}`);
};

const renderFormat = ({ format, html }) => {
  const outputPath = outputPathFor(format.surface);
  const temporaryPath = resolve(
    SCRIPT_DIRECTORY,
    `.tmp-${format.surface.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`,
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  try {
    writeFileSync(temporaryPath, html);
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      `--force-device-scale-factor=${format.scale}`,
      `--window-size=${format.width},${format.height}`,
      `--screenshot=${outputPath}`,
      pathToFileURL(temporaryPath).href,
    ]);
    console.log('rendered', outputPath);
  } finally {
    if (existsSync(temporaryPath)) {
      unlinkSync(temporaryPath);
    }
  }
};

const brandSource = readSource('docs/brand.md');
const providerRegistrySource = readSource('packages/types/src/provider-registry.ts');
const providerBrandSource = readSource(
  'apps/desktop/src/features/providers/components/provider-brand.ts',
);
const iconSource = readSource('packages/ui/src/components/brandIcons.tsx');
const desktopStylesSource = readSource('apps/desktop/src/styles.css');
const websiteStylesSource = readSource('website/src/styles.css');
const mascotBase64 = readFileSync(resolve(WEBSITE_DIRECTORY, 'src/assets/mascot.png')).toString(
  'base64',
);

const formats = parseSocialFormats(brandSource);
const providerIds = parseProviderIds(providerRegistrySource);
const providerBrandEntries = parseProviderBrand({ providerBrandSource, providerIds });
const lightThemeSource = extractCssBlock({
  stylesSource: desktopStylesSource,
  selector: "html[data-theme='light']",
});
const providerBrands = resolveBrands({
  brands: providerBrandEntries,
  iconSource,
  lightThemeSource,
});
const accent = extractCssValue({ cssSource: websiteStylesSource, variableName: '--accent' });
const date = new Date().toISOString().slice(0, 10);

formats.forEach((format) => {
  const html = createHtmlFor({ format, accent, mascotBase64, providerBrands, date });
  renderFormat({ format, html });
});
