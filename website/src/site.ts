const REPO = 'https://github.com/akhayam99/goodboy';
const BLOB = `${REPO}/blob/main`;
const POLICY = 'https://www.iubenda.com/privacy-policy/46359357';

export const SITE = {
  origin: 'https://goodboy-ai.dev',
  repo: REPO,
  releases: `${REPO}/releases`,
  releaseDownloads: `${REPO}/releases/download`,
  latestApi: 'https://api.github.com/repos/akhayam99/goodboy/releases/latest',
  features: '/features',
  howItWorks: '/#two-ways',
  issues: `${REPO}/issues`,
  newIssue: `${REPO}/issues/new`,
  featureGuide: `${BLOB}/FEATURES.md`,
  featureDoc: (area: string) => `${BLOB}/docs/features/${area}.md`,
  gettingStarted: `${REPO}#install`,
  changelog: `${BLOB}/CHANGELOG.md`,
  security: `${BLOB}/SECURITY.md`,
  privacy: POLICY,
  cookies: `${POLICY}/cookie-policy`,
  brew: 'brew install --cask akhayam99/tap/goodboy',
  x: 'https://x.com/GoodboyWorks',
} as const;
