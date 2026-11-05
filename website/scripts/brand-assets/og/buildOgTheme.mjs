import { extractIconPath } from '../readers/extractIconPath.mjs';
import { resolveBrands } from '../readers/resolveBrands.mjs';

const OG_TOOLS = [
  'GithubIcon',
  'GitlabIcon',
  'BitbucketIcon',
  'LinearIcon',
  'JiraIcon',
  'SentryIcon',
  'SlackIcon',
];

export const buildOgTheme = ({
  websiteDarkValue,
  providerBrandEntries,
  iconSource,
  desktopDarkSource,
}) => ({
  stage: `linear-gradient(160deg, ${websiteDarkValue('--g-stage-a')} 0%, ${websiteDarkValue('--g-stage-b')} 46%, ${websiteDarkValue('--g-stage-c')} 100%)`,
  foreground: websiteDarkValue('--t1'),
  secondary: websiteDarkValue('--t2'),
  muted: websiteDarkValue('--t3'),
  accent: websiteDarkValue('--accent'),
  tileRing: websiteDarkValue('--tile-ring'),
  providerBrands: resolveBrands({
    brands: providerBrandEntries,
    iconSource,
    themeSource: desktopDarkSource,
  }),
  toolBrands: OG_TOOLS.map((iconName) => ({
    id: iconName.replace('Icon', '').toLowerCase(),
    path: extractIconPath({ iconSource, componentName: iconName }),
    color: websiteDarkValue('--t1'),
  })),
});
