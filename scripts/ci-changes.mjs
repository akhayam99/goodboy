import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WEBSITE_PATHS_READ_BY_TESTS = [
  'website/src/components/Logo.tsx',
  'website/src/styles.css',
  'website/public/favicon.svg',
  'website/scripts/build-brand-assets.mjs',
];

const INERT_PATTERNS = [
  /^docs\/(?!changelog(?:\/|$))/,
  /^website\//,
  /^\.github\/[^/]+\.png$/,
  /^\.github\/pull_request_template\.md$/,
];

export const isInertPath = ({ path }) =>
  !WEBSITE_PATHS_READ_BY_TESTS.includes(path) &&
  INERT_PATTERNS.some((pattern) => pattern.test(path));

export const decideTests = ({ eventName, paths }) => {
  if (eventName !== 'pull_request') return true;
  if (paths === null || paths.length === 0) return true;
  return !paths.every((path) => isInertPath({ path }));
};

const readChangedPaths = () => {
  try {
    const output = execFileSync('git', ['diff', '--name-only', '--no-renames', 'HEAD^1', 'HEAD'], {
      encoding: 'utf8',
    });
    return output.split('\n').filter((line) => line.length > 0);
  } catch {
    return null;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const eventName = process.env.GITHUB_EVENT_NAME ?? '';
  const paths = eventName === 'pull_request' ? readChangedPaths() : [];
  const tests = decideTests({ eventName, paths });
  const summary = `event=${eventName} changed=${paths === null ? 'unknown' : paths.length} tests=${tests}`;
  console.log(summary);
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) appendFileSync(outputFile, `tests=${tests}\n`);
}
