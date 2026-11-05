import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderAppIcons } from './brand-assets/icons/renderAppIcons.mjs';
import { renderFavicon } from './brand-assets/icons/renderFavicon.mjs';
import { buildOgTheme } from './brand-assets/og/buildOgTheme.mjs';
import { WEBSITE_DIRECTORY } from './brand-assets/paths.mjs';
import { extractCssBlock } from './brand-assets/readers/extractCssBlock.mjs';
import { extractCssValue } from './brand-assets/readers/extractCssValue.mjs';
import { parseProviderBrand } from './brand-assets/readers/parseProviderBrand.mjs';
import { parseProviderIds } from './brand-assets/readers/parseProviderIds.mjs';
import { parseSocialFormats } from './brand-assets/readers/parseSocialFormats.mjs';
import { readSource } from './brand-assets/readers/readSource.mjs';
import { toHexColor } from './brand-assets/readers/toHexColor.mjs';
import { createHtmlFor } from './brand-assets/social/createHtmlFor.mjs';
import { renderFormat } from './brand-assets/social/renderFormat.mjs';
import { slugFor } from './brand-assets/social/slugFor.mjs';

const brandSource = readSource('docs/brand.md');
const providerRegistrySource = readSource('packages/types/src/provider-registry.ts');
const providerBrandSource = readSource(
  'apps/desktop/src/features/providers/components/provider-brand.ts',
);
const iconSource = readSource('packages/ui/src/components/brandIcons.tsx');
const desktopStylesSource = readSource('apps/desktop/src/styles.css');
const websiteStylesSource = readSource('website/src/styles/base.css');
const mascotBase64 = readFileSync(resolve(WEBSITE_DIRECTORY, 'src/assets/mascot.png')).toString(
  'base64',
);

const formats = parseSocialFormats(brandSource);
const providerIds = parseProviderIds(providerRegistrySource);
const providerBrandEntries = parseProviderBrand({ providerBrandSource, providerIds });
const accent = extractCssValue({ cssSource: websiteStylesSource, variableName: '--accent' });
const websiteDarkSource = extractCssBlock({
  stylesSource: websiteStylesSource,
  selector: ":root[data-theme='dark']",
});
const desktopDarkSource = extractCssBlock({
  stylesSource: desktopStylesSource,
  selector: '@theme',
});
const websiteDarkValue = (variableName) =>
  extractCssValue({ cssSource: websiteDarkSource, variableName });
const ogTheme = buildOgTheme({
  websiteDarkValue,
  providerBrandEntries,
  iconSource,
  desktopDarkSource,
});
const tileColor = toHexColor(
  extractCssValue({ cssSource: websiteStylesSource, variableName: '--brand-tile' }),
);
const desktopTileColor = toHexColor(
  extractCssValue({ cssSource: desktopStylesSource, variableName: '--color-brand' }),
);

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
  const html = createHtmlFor({
    format,
    accent,
    tileColor,
    mascotBase64,
    ogTheme,
  });
  renderFormat({ format, html });
});

if (isRequested('favicon')) {
  renderFavicon({ tileColor, mascotBase64 });
}

if (isRequested('app-icon')) {
  renderAppIcons({ tileColor, mascotBase64 });
}
