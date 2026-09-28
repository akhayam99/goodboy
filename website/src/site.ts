const REPO = 'https://github.com/akhayam99/goodboy';
const BLOB = `${REPO}/blob/main`;
const POLICY = 'https://www.iubenda.com/privacy-policy/46359357';

export const SITE = {
  repo: REPO,
  releases: `${REPO}/releases`,
  latest: `${REPO}/releases/latest`,
  linux: `${REPO}/releases`,
  issues: `${REPO}/issues`,
  newIssue: `${REPO}/issues/new`,
  featureGuide: `${BLOB}/FEATURES.md`,
  gettingStarted: `${REPO}#install`,
  changelog: `${BLOB}/CHANGELOG.md`,
  security: `${BLOB}/SECURITY.md`,
  privacy: POLICY,
  cookies: `${POLICY}/cookie-policy`,
  brew: 'brew install --cask akhayam99/tap/goodboy',
} as const;
