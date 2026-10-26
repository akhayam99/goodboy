import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ASSET_PATTERN = /(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g;
const HEADROOM = 1.05;
const MEGABYTE = 1_048_576;

export const initialAssets = ({ html }) =>
  [...html.matchAll(ASSET_PATTERN)].map((match) => match[1]);

export const measureBundle = ({ distDirectory, read = (path) => readFileSync(path) }) => {
  const html = read(resolve(distDirectory, 'index.html')).toString('utf8');
  const files = initialAssets({ html });
  let rawBytes = 0;
  let gzipBytes = 0;
  for (const file of files) {
    const content = read(resolve(distDirectory, file));
    rawBytes += content.length;
    gzipBytes += gzipSync(content, { level: 9 }).length;
  }
  return { files, rawBytes, gzipBytes };
};

export const evaluateBudget = ({ measured, budget }) => {
  const failures = [];
  if (measured.files.length === 0) {
    failures.push('no initial js or css file was found in index.html, so nothing was measured');
  }
  if (measured.rawBytes > budget.rawBytes) {
    failures.push(`initial js and css is ${measured.rawBytes} bytes, budget ${budget.rawBytes}`);
  }
  if (measured.gzipBytes > budget.gzipBytes) {
    failures.push(`initial gzip is ${measured.gzipBytes} bytes, budget ${budget.gzipBytes}`);
  }
  return { isWithinBudget: failures.length === 0, failures };
};

export const suggestedBudget = ({ measured }) => ({
  rawBytes: Math.ceil(measured.rawBytes * HEADROOM),
  gzipBytes: Math.ceil(measured.gzipBytes * HEADROOM),
});

const megabytes = ({ bytes }) => (bytes / MEGABYTE).toFixed(2);

export const summaryTable = ({ measured, budget }) =>
  [
    '### Bundle weight',
    '',
    '| | now | budget |',
    '| --- | --- | --- |',
    `| initial load, js and css | ${megabytes({ bytes: measured.rawBytes })} MB | ${megabytes({ bytes: budget.rawBytes })} MB |`,
    `| initial load, gzip | ${megabytes({ bytes: measured.gzipBytes })} MB | ${megabytes({ bytes: budget.gzipBytes })} MB |`,
    `| files counted | ${measured.files.length} | |`,
    '',
  ].join('\n');

const argumentOf = ({ name, fallback }) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const distDirectory = resolve(argumentOf({ name: '--dist', fallback: 'apps/desktop/dist' }));
  const budgetPath = resolve(argumentOf({ name: '--budget', fallback: 'bundle-budget.json' }));
  let measured = null;
  try {
    measured = measureBundle({ distDirectory });
  } catch (error) {
    console.error(`::error title=bundle weight::could not read ${distDirectory}: ${error.message}`);
    process.exit(1);
  }
  if (process.argv.includes('--suggest')) {
    console.log(JSON.stringify(suggestedBudget({ measured }), null, 2));
    process.exit(0);
  }
  const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
  const { isWithinBudget, failures } = evaluateBudget({ measured, budget });
  const table = summaryTable({ measured, budget });
  console.log(table);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
  }
  for (const failure of failures) {
    console.error(`::error title=bundle weight::${failure}`);
  }
  process.exit(isWithinBudget ? 0 : 1);
}
