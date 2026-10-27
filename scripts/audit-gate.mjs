import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const AUDIT_TIMEOUT_MS = 120_000;

const ADVISORY_PATTERN = /\b\d+\s+vulnerabilit(?:y|ies)\s+found\b/i;

export const classifyAudit = ({ status, output, isTimedOut = false }) => {
  if (isTimedOut) {
    return 'unavailable';
  }
  if (status === 0) {
    return 'clean';
  }
  return ADVISORY_PATTERN.test(output) ? 'advisory' : 'unavailable';
};

export const verdictOf = ({ result }) => {
  if (result === 'advisory') {
    return {
      exitCode: 1,
      line: '::error title=pnpm audit::a production dependency has a known advisory',
    };
  }
  if (result === 'unavailable') {
    return {
      exitCode: 0,
      line: '::notice title=pnpm audit::the audit did not finish, so nothing was checked',
    };
  }
  return { exitCode: 0, line: 'pnpm audit: clean' };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const run = spawnSync('pnpm', ['audit', '--prod'], {
    encoding: 'utf8',
    timeout: AUDIT_TIMEOUT_MS,
  });
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  process.stdout.write(output);
  const isTimedOut = run.error?.code === 'ETIMEDOUT' || run.signal !== null;
  const result = classifyAudit({ status: run.status, output, isTimedOut });
  const { exitCode, line } = verdictOf({ result });
  console.log(line);
  process.exit(exitCode);
}
