import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FIRST_LINE = /^First failure: (.+)$/m;
const COUNT_LINE = /^Failures while open: (\d+)$/m;

export const nextIssueBody = ({ previous, message, runUrl, at }) => {
  const first = previous?.match(FIRST_LINE)?.[1] ?? `${at} ${runUrl}`;
  const count = Number(previous?.match(COUNT_LINE)?.[1] ?? 0) + 1;
  return [
    message,
    '',
    `Latest failure: ${at} ${runUrl}`,
    `First failure: ${first}`,
    `Failures while open: ${count}`,
    '',
    'This body is rewritten on every failure instead of adding a comment. Close the issue once the job is green again; the next failure opens a new one.',
  ].join('\n');
};

const gh = ({ args }) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

const summarize = ({ line }) => {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
  }
};

const runCli = () => {
  const { LABEL, TITLE, MESSAGE, RUN_URL } = process.env;
  if ([LABEL, TITLE, MESSAGE, RUN_URL].some((value) => value === undefined || value === '')) {
    console.error('report-ci-issue: LABEL, TITLE, MESSAGE and RUN_URL are required');
    process.exit(1);
  }
  try {
    gh({ args: ['label', 'create', LABEL, '--description', TITLE, '--color', process.env.COLOR ?? 'd93f0b'] });
  } catch {
    console.log(`label ${LABEL} already exists`);
  }
  const at = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const existing = gh({
    args: ['issue', 'list', '--label', LABEL, '--state', 'open', '--limit', '1', '--json', 'number', '--jq', '.[0].number // empty'],
  });
  if (existing === '') {
    const body = nextIssueBody({ previous: null, message: MESSAGE, runUrl: RUN_URL, at });
    const url = gh({ args: ['issue', 'create', '--label', LABEL, '--title', TITLE, '--body', body] });
    summarize({ line: `${MESSAGE} Opened ${url}` });
    return;
  }
  const previous = gh({ args: ['issue', 'view', existing, '--json', 'body', '--jq', '.body'] });
  const body = nextIssueBody({ previous, message: MESSAGE, runUrl: RUN_URL, at });
  gh({ args: ['issue', 'edit', existing, '--body', body] });
  summarize({ line: `${MESSAGE} Updated issue #${existing} in place.` });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
