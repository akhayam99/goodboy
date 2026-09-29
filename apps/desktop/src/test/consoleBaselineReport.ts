import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { toEntryId, type ConsoleBaseline, type ConsoleBaselineEntry } from './consoleKey';

const BASELINE_PATH = join(import.meta.dirname, 'console-baseline.json');
const IS_UPDATING = process.env['GOODBOY_UPDATE_CONSOLE_BASELINE'] === '1';
const IS_SEEDING = process.env['GOODBOY_SEED_CONSOLE_BASELINE'] === '1';

type ReportLine = { file: string; message?: string; ran?: boolean };

const isReportLine = (value: unknown): value is ReportLine =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { file?: unknown }).file === 'string';

const readBaseline = (): ReadonlyArray<ConsoleBaselineEntry> => {
  if (!existsSync(BASELINE_PATH)) {
    return [];
  }
  const parsed: ConsoleBaseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return parsed.entries;
};

const readReport = (path: string): ReadonlyArray<ReportLine> =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line): unknown => JSON.parse(line))
    .filter(isReportLine);

const sortEntries = (entries: ReadonlyArray<ConsoleBaselineEntry>): ConsoleBaselineEntry[] =>
  [...entries].sort((a, b) => toEntryId(a).localeCompare(toEntryId(b)));

export const setup = (): void => {
  if (!IS_UPDATING || process.env['GOODBOY_CONSOLE_REPORT'] !== undefined) {
    return;
  }
  const reportDir = mkdtempSync(join(tmpdir(), 'goodboy-console-'));
  const reportPath = join(reportDir, 'report.jsonl');
  writeFileSync(reportPath, '');
  process.env['GOODBOY_CONSOLE_REPORT'] = reportPath;
};

export const teardown = (): void => {
  const reportPath = process.env['GOODBOY_CONSOLE_REPORT'];
  if (!IS_UPDATING || reportPath === undefined || !existsSync(reportPath)) {
    return;
  }
  try {
    const lines = readReport(reportPath);
    const ranFiles = new Set(lines.map((line) => line.file));
    const recorded = new Map<string, ConsoleBaselineEntry>();
    lines.forEach(({ file, message }) => {
      if (message === undefined) {
        return;
      }
      recorded.set(toEntryId({ file, message }), { file, message });
    });
    const existing = readBaseline();
    const existingIds = new Set(existing.map(toEntryId));
    const grown = [...recorded.entries()].filter(([id]) => !existingIds.has(id));
    if (grown.length > 0 && !IS_SEEDING) {
      throw new Error(
        `the console baseline only shrinks. New unexpected console output (fix the cause instead):\n${grown
          .map(([, entry]) => `${entry.file}: ${entry.message}`)
          .join('\n')}`,
      );
    }
    const kept = IS_SEEDING ? existing : existing.filter((entry) => !ranFiles.has(entry.file));
    const merged = new Map(
      [...kept, ...recorded.values()].map((entry) => [toEntryId(entry), entry]),
    );
    const next = sortEntries([...merged.values()]);
    writeFileSync(BASELINE_PATH, `${JSON.stringify({ entries: next }, null, 2)}\n`);
  } finally {
    rmSync(dirname(reportPath), { recursive: true, force: true });
  }
};
