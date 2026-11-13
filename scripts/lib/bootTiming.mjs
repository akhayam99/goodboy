const PHASE_METRICS = ['window-created', 'webview-attached', 'ready'];

export const parseLogLine = ({ line }) => {
  const [stamp, launchId, phase, detail] = line.trim().split(/\s+/);
  const at = Number(stamp);
  if (!Number.isFinite(at) || launchId === undefined || phase === undefined) {
    return null;
  }
  return { at, launchId, phase, detail: detail ?? '' };
};

export const parseMarks = ({ detail }) =>
  Object.fromEntries(
    detail
      .split(',')
      .map((token) => token.split('='))
      .filter(
        ([name, value]) => name !== '' && value !== undefined && Number.isFinite(Number(value)),
      )
      .map(([name, value]) => [name, Number(value)]),
  );

export const launchOf = ({ lines, pid }) => {
  const entries = lines
    .map((line) => parseLogLine({ line }))
    .filter((entry) => entry !== null && entry.launchId.endsWith(`-${pid}`));
  const start = entries.find((entry) => entry.phase === 'process-start');
  const ready = entries.find((entry) => entry.phase === 'ready');
  const marksEntry = entries.find((entry) => entry.phase === 'marks');
  if (start === undefined || ready === undefined) {
    return null;
  }
  const metrics = {};
  for (const phase of PHASE_METRICS) {
    const entry = entries.find((candidate) => candidate.phase === phase);
    if (entry !== undefined) {
      metrics[`process-to-${phase}`] = entry.at - start.at;
    }
  }
  const { ms } = parseMarks({ detail: ready.detail.replace(/,ok$/, '') });
  if (ms !== undefined) {
    metrics['boot-ms'] = ms;
  }
  if (marksEntry !== undefined) {
    for (const [name, value] of Object.entries(parseMarks({ detail: marksEntry.detail }))) {
      metrics[`mark-${name}`] = value;
    }
  }
  return { launchId: start.launchId, hasMarks: marksEntry !== undefined, metrics };
};

export const percentile = ({ values, p }) => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
};

export const summarize = ({ launches }) => {
  const names = [...new Set(launches.flatMap((launch) => Object.keys(launch.metrics)))];
  return names.map((name) => {
    const values = launches.flatMap((launch) => launch.metrics[name] ?? []);
    return {
      name,
      runs: values.length,
      median: percentile({ values, p: 50 }),
      p95: percentile({ values, p: 95 }),
    };
  });
};

export const formatReport = ({ label, summary }) => {
  const width = Math.max(4, ...summary.map((row) => row.name.length));
  const header = `${label}\n${'metric'.padEnd(width)}  runs  median  p95`;
  const rows = summary.map(
    (row) =>
      `${row.name.padEnd(width)}  ${String(row.runs).padStart(4)}  ${String(row.median).padStart(6)}  ${String(row.p95).padStart(3)}`,
  );
  return [header, ...rows].join('\n');
};
