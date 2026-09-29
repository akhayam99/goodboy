import { fileURLToPath } from 'node:url';

const REQUIRED_JOBS = ['changes', 'checks', 'test-desktop', 'test-packages'];
const SKIPPABLE_JOBS = ['test-desktop', 'test-packages'];

export const evaluateGate = ({ needs }) => {
  const failures = [];
  const changesResult = needs.changes?.result;
  if (changesResult !== 'success') {
    failures.push(`changes: ${changesResult ?? 'missing'}, expected success`);
  }
  const testsSkippedByChanges =
    changesResult === 'success' && needs.changes.outputs?.tests === 'false';
  for (const job of REQUIRED_JOBS) {
    if (job === 'changes') continue;
    const result = needs[job]?.result;
    if (result === 'success') continue;
    if (result === 'skipped' && SKIPPABLE_JOBS.includes(job) && testsSkippedByChanges) continue;
    failures.push(`${job}: ${result ?? 'missing'}`);
  }
  return { ok: failures.length === 0, failures };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let needs = null;
  try {
    needs = JSON.parse(process.env.NEEDS ?? '');
  } catch {
    console.error('gate: NEEDS is not valid JSON');
    process.exit(1);
  }
  const { ok, failures } = evaluateGate({ needs });
  for (const job of REQUIRED_JOBS) console.log(`${job}: ${needs[job]?.result ?? 'missing'}`);
  if (!ok) {
    for (const failure of failures) console.error(`gate red: ${failure}`);
    process.exit(1);
  }
  console.log('gate green');
}
