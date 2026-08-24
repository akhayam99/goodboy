import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const WEBSITE_DIRECTORY = resolve(SCRIPT_DIRECTORY, '..');
const REPOSITORY_DIRECTORY = resolve(WEBSITE_DIRECTORY, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TAURI_CLI = resolve(REPOSITORY_DIRECTORY, 'apps/desktop/node_modules/.bin/tauri');
const DESKTOP_ICONS_DIRECTORY = resolve(REPOSITORY_DIRECTORY, 'apps/desktop/src-tauri/icons');

const FAVICON_CANVAS_PX = 32;
const FAVICON_GLYPH_PX = 256;
const APP_ICON_PX = 1024;
const ICNS_HEADER_BYTES = 8;
const TILE_RADIUS_RATIO = 0.28;
const MARK_SCALE = 0.76;
const APP_ICON_MARK_SCALE_EXCEPTION = 0.66;
const DEV_ICON_CONTENT_RATIO = 0.8125;
const DEV_ICON_CORNER_RADIUS_RATIO = 0.2237;
const DEV_ICON_FILES = ['icon.png', '32x32.png', '128x128.png', '128x128@2x.png'];
const PNG_WIDTH_OFFSET_BYTES = 16;

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
      const depth =
        character === '{' ? state.depth + 1 : character === '}' ? state.depth - 1 : state.depth;
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
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .filter(
      ([surface, size]) => surface !== 'Surface' && !/^-+$/.test(surface) && size !== undefined,
    )
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
  const entries = [
    ...block.matchAll(
      /([a-z][a-z0-9]*):\s*\{\s*icon:\s*([A-Za-z][A-Za-z0-9]*),\s*cssVar:\s*['"]([^'"]+)['"]\s*\}/g,
    ),
  ].reduce(
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

const encodeSrgbChannel = (value) => {
  const clamped = Math.min(1, Math.max(0, value));
  const encoded = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255)
    .toString(16)
    .padStart(2, '0');
};

const oklchToHex = ({ lightness, chroma, hue }) => {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.29148555 * b) ** 3;
  const red = 4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short;
  const green = -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short;
  const blue = -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short;
  return `#${encodeSrgbChannel(red)}${encodeSrgbChannel(green)}${encodeSrgbChannel(blue)}`;
};

const toHexColor = (color) => {
  if (color.startsWith('#')) {
    return color;
  }
  const match = requireMatch({
    source: color,
    pattern: /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/,
    description: `a hex or oklch color, received "${color}"`,
  });
  return oklchToHex({
    lightness: Number(match[1]),
    chroma: Number(match[2]),
    hue: Number(match[3]),
  });
};

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

const createBaseHtml = ({
  width,
  height,
  accent,
  bodyClass,
  content,
  extraCss = '',
}) => `<!doctype html>
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
  const marks = providerBrands
    .map(
      ({ id, path, color }) =>
        `<svg aria-label="${id}" width="30" height="30" viewBox="0 0 24 24" fill="${color}"><path d="${path}"/></svg>`,
    )
    .join('');
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

const createAvatarHtml = ({ format, accent, mascotBase64 }) =>
  createBaseHtml({
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

const createFaviconGlyphHtml = ({ mascotBase64 }) => `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box }
  html, body { width: ${FAVICON_GLYPH_PX}px; height: ${FAVICON_GLYPH_PX}px; background: transparent; overflow: hidden }
  .mascot { display: block; width: 100%; height: 100%; background: #fff; -webkit-mask: url(data:image/png;base64,${mascotBase64}) no-repeat center / contain }
</style>
<body><i class="mascot"></i></body>`;

const createFaviconSvg = ({ tileColor, glyphBase64 }) => {
  const markSize = FAVICON_CANVAS_PX * MARK_SCALE;
  const markInset = (FAVICON_CANVAS_PX - markSize) / 2;
  const tileRadius = FAVICON_CANVAS_PX * TILE_RADIUS_RATIO;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FAVICON_CANVAS_PX} ${FAVICON_CANVAS_PX}">
  <rect width="${FAVICON_CANVAS_PX}" height="${FAVICON_CANVAS_PX}" rx="${tileRadius}" fill="${tileColor}"/>
  <image x="${markInset}" y="${markInset}" width="${markSize}" height="${markSize}" href="data:image/png;base64,${glyphBase64}"/>
</svg>
`;
};

const createAppIconHtml = ({ tileColor, mascotBase64 }) => `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box }
  html, body { width: ${APP_ICON_PX}px; height: ${APP_ICON_PX}px; background: ${tileColor}; overflow: hidden }
  body { display: grid; place-items: center }
  .mascot { display: block; width: ${APP_ICON_PX * APP_ICON_MARK_SCALE_EXCEPTION}px; height: ${APP_ICON_PX * APP_ICON_MARK_SCALE_EXCEPTION}px; background: #fff; -webkit-mask: url(data:image/png;base64,${mascotBase64}) no-repeat center / contain }
</style>
<body><i class="mascot"></i></body>`;

const createDevIconHtml = ({ tileColor, mascotBase64, canvasPx }) => {
  const contentPx = canvasPx * DEV_ICON_CONTENT_RATIO;
  const markPx = contentPx * APP_ICON_MARK_SCALE_EXCEPTION;
  return `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box }
  html, body { width: ${canvasPx}px; height: ${canvasPx}px; background: transparent; overflow: hidden }
  body { display: grid; place-items: center }
  .tile { width: ${contentPx}px; height: ${contentPx}px; border-radius: ${contentPx * DEV_ICON_CORNER_RADIUS_RATIO}px; background: ${tileColor}; display: grid; place-items: center }
  .mascot { display: block; width: ${markPx}px; height: ${markPx}px; background: #fff; -webkit-mask: url(data:image/png;base64,${mascotBase64}) no-repeat center / contain }
</style>
<body><div class="tile"><i class="mascot"></i></div></body>`;
};

const renderDevIcon = ({ name, tileColor, mascotBase64, temporaryIconsDirectory }) => {
  const outputPath = resolve(temporaryIconsDirectory, name);
  const canvasPx = readFileSync(outputPath).readUInt32BE(PNG_WIDTH_OFFSET_BYTES);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const temporaryHtmlPath = resolve(tmpdir(), `goodboy-dev-icon-${slug}-${process.pid}.html`);
  try {
    writeFileSync(temporaryHtmlPath, createDevIconHtml({ tileColor, mascotBase64, canvasPx }));
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      '--force-device-scale-factor=1',
      `--window-size=${canvasPx},${canvasPx}`,
      `--screenshot=${outputPath}`,
      pathToFileURL(temporaryHtmlPath).href,
    ]);
  } finally {
    if (existsSync(temporaryHtmlPath)) {
      unlinkSync(temporaryHtmlPath);
    }
  }
};

const icnsChunkDigests = (buffer) => {
  const digests = [];
  let cursor = ICNS_HEADER_BYTES;
  while (cursor + ICNS_HEADER_BYTES <= buffer.length) {
    const type = buffer.toString('ascii', cursor, cursor + 4);
    const length = buffer.readUInt32BE(cursor + 4);
    if (length < ICNS_HEADER_BYTES) {
      throw new Error(`Malformed icns chunk "${type}" of length ${length}`);
    }
    const payload = buffer.subarray(cursor + ICNS_HEADER_BYTES, cursor + length);
    digests.push(`${type}:${createHash('sha256').update(payload).digest('hex')}`);
    cursor += length;
  }
  return digests.sort();
};

const carriesSameIcons = ({ name, current, next }) => {
  if (!name.endsWith('.icns')) {
    return current.equals(next);
  }
  return icnsChunkDigests(current).join() === icnsChunkDigests(next).join();
};

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

const slugFor = (surface) => surface.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const outputPathFor = (surface) =>
  surface === 'og-image'
    ? resolve(WEBSITE_DIRECTORY, 'public/og-image.png')
    : resolve(WEBSITE_DIRECTORY, `public/brand/${slugFor(surface)}.png`);

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
    tmpdir(),
    `goodboy-brand-${slugFor(format.surface)}-${process.pid}.html`,
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  try {
    writeFileSync(temporaryPath, html);
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
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

const renderAppIcons = ({ tileColor, mascotBase64 }) => {
  if (!existsSync(TAURI_CLI)) {
    throw new Error(`The Tauri CLI is missing at ${TAURI_CLI}. Run pnpm install first.`);
  }
  const temporaryHtmlPath = resolve(tmpdir(), `goodboy-app-icon-${process.pid}.html`);
  const temporaryPngPath = resolve(tmpdir(), `goodboy-app-icon-${process.pid}.png`);
  const temporaryIconsDirectory = resolve(tmpdir(), `goodboy-app-icons-${process.pid}`);
  try {
    writeFileSync(temporaryHtmlPath, createAppIconHtml({ tileColor, mascotBase64 }));
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${APP_ICON_PX},${APP_ICON_PX}`,
      `--screenshot=${temporaryPngPath}`,
      pathToFileURL(temporaryHtmlPath).href,
    ]);
    mkdirSync(temporaryIconsDirectory, { recursive: true });
    execFileSync(TAURI_CLI, ['icon', temporaryPngPath, '-o', temporaryIconsDirectory], {
      stdio: 'ignore',
    });
    DEV_ICON_FILES.forEach((name) =>
      renderDevIcon({ name, tileColor, mascotBase64, temporaryIconsDirectory }),
    );
    const stale = readdirSync(DESKTOP_ICONS_DIRECTORY)
      .filter((name) => existsSync(resolve(temporaryIconsDirectory, name)))
      .filter(
        (name) =>
          !carriesSameIcons({
            name,
            current: readFileSync(resolve(DESKTOP_ICONS_DIRECTORY, name)),
            next: readFileSync(resolve(temporaryIconsDirectory, name)),
          }),
      );
    if (stale.length === 0) {
      console.log('the desktop icons already match the live brand tile, no change needed');
      return;
    }
    stale.forEach((name) => {
      writeFileSync(
        resolve(DESKTOP_ICONS_DIRECTORY, name),
        readFileSync(resolve(temporaryIconsDirectory, name)),
      );
    });
    console.log('rendered', stale.length, 'desktop icons in', DESKTOP_ICONS_DIRECTORY);
  } finally {
    if (existsSync(temporaryHtmlPath)) {
      unlinkSync(temporaryHtmlPath);
    }
    if (existsSync(temporaryPngPath)) {
      unlinkSync(temporaryPngPath);
    }
    rmSync(temporaryIconsDirectory, { recursive: true, force: true });
  }
};

const renderFavicon = ({ tileColor, mascotBase64 }) => {
  const outputPath = resolve(WEBSITE_DIRECTORY, 'public/favicon.svg');
  const temporaryHtmlPath = resolve(tmpdir(), `goodboy-favicon-glyph-${process.pid}.html`);
  const temporaryPngPath = resolve(tmpdir(), `goodboy-favicon-glyph-${process.pid}.png`);
  try {
    writeFileSync(temporaryHtmlPath, createFaviconGlyphHtml({ mascotBase64 }));
    execFileSync(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      '--force-device-scale-factor=1',
      `--window-size=${FAVICON_GLYPH_PX},${FAVICON_GLYPH_PX}`,
      `--screenshot=${temporaryPngPath}`,
      pathToFileURL(temporaryHtmlPath).href,
    ]);
    const svgSource = createFaviconSvg({
      tileColor,
      glyphBase64: readFileSync(temporaryPngPath).toString('base64'),
    });
    if (existsSync(outputPath) && readFileSync(outputPath, 'utf8') === svgSource) {
      console.log('favicon.svg already matches the live brand tile, no change needed');
      return;
    }
    writeFileSync(outputPath, svgSource);
    console.log('rendered', outputPath);
  } finally {
    if (existsSync(temporaryHtmlPath)) {
      unlinkSync(temporaryHtmlPath);
    }
    if (existsSync(temporaryPngPath)) {
      unlinkSync(temporaryPngPath);
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
const tileColor = toHexColor(
  extractCssValue({ cssSource: websiteStylesSource, variableName: '--brand-tile' }),
);
const desktopTileColor = toHexColor(
  extractCssValue({ cssSource: desktopStylesSource, variableName: '--color-brand' }),
);
const date = new Date().toISOString().slice(0, 10);

if (tileColor !== desktopTileColor) {
  throw new Error(
    `The brand tile must be one colour everywhere: --brand-tile is ${tileColor}, --color-brand is ${desktopTileColor}`,
  );
}

const GENERATED_SURFACES = ['favicon', 'app-icon'];

const requestedSurface = process.argv[2] ?? '';
const isRequested = (slug) => requestedSurface === '' || requestedSurface === slug;
const selectedFormats = formats.filter((format) => isRequested(slugFor(format.surface)));
const knownSurfaces = [...formats.map((format) => slugFor(format.surface)), ...GENERATED_SURFACES];

if (requestedSurface !== '' && !knownSurfaces.includes(requestedSurface)) {
  throw new Error(
    `Unknown surface "${requestedSurface}". Known surfaces: ${knownSurfaces.join(', ')}`,
  );
}

selectedFormats.forEach((format) => {
  const html = createHtmlFor({ format, accent, mascotBase64, providerBrands, date });
  renderFormat({ format, html });
});

if (isRequested('favicon')) {
  renderFavicon({ tileColor, mascotBase64 });
}

if (isRequested('app-icon')) {
  renderAppIcons({ tileColor, mascotBase64 });
}
