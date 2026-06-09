import type {
  DiffHunk,
  DiffHunkLine,
  FileDiff,
  FileDiffStatus,
  PullRequestDiff,
} from '@goodboy/types';
import type { GhRunner } from './gh';
import { GhCliError } from './gh';

type MutableFile = {
  path: string;
  oldPath?: string;
  status: FileDiffStatus;
  additions: number;
  deletions: number;
  binary: boolean;
  hunks: DiffHunk[];
};

const FILE_HEADER = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export const parseUnifiedDiff = (diff: string): ReadonlyArray<FileDiff> => {
  const lines = diff.split('\n');
  const files: MutableFile[] = [];
  let current: MutableFile | null = null;
  let hunk: {
    header: string;
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: DiffHunkLine[];
  } | null = null;
  let oldCursor = 0;
  let newCursor = 0;

  const flushHunk = () => {
    if (current && hunk) {
      current.hunks.push({
        header: hunk.header,
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        newStart: hunk.newStart,
        newLines: hunk.newLines,
        lines: hunk.lines,
      });
    }
    hunk = null;
  };

  for (const line of lines) {
    const fileMatch = line.match(FILE_HEADER);
    if (fileMatch) {
      flushHunk();
      if (current) files.push(current);
      const oldPath = fileMatch[1];
      const newPath = fileMatch[2];
      if (!oldPath || !newPath) continue;
      current = {
        path: newPath,
        oldPath: oldPath === newPath ? undefined : oldPath,
        status: 'modified',
        additions: 0,
        deletions: 0,
        binary: false,
        hunks: [],
      };
      continue;
    }
    if (!current) continue;

    if (line.startsWith('new file mode')) current.status = 'added';
    else if (line.startsWith('deleted file mode')) current.status = 'deleted';
    else if (line.startsWith('rename from')) {
      current.status = 'renamed';
      current.oldPath = line.slice('rename from '.length);
    } else if (line.startsWith('rename to')) {
      current.path = line.slice('rename to '.length);
    } else if (line.startsWith('Binary files')) {
      current.binary = true;
    }

    const hunkMatch = line.match(HUNK_HEADER);
    if (hunkMatch && hunkMatch[1] && hunkMatch[3]) {
      flushHunk();
      const oldStart = Number.parseInt(hunkMatch[1], 10);
      const oldLines = hunkMatch[2] ? Number.parseInt(hunkMatch[2], 10) : 1;
      const newStart = Number.parseInt(hunkMatch[3], 10);
      const newLines = hunkMatch[4] ? Number.parseInt(hunkMatch[4], 10) : 1;
      hunk = {
        header: line,
        oldStart,
        oldLines,
        newStart,
        newLines,
        lines: [],
      };
      oldCursor = oldStart;
      newCursor = newStart;
      continue;
    }

    if (!hunk) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      hunk.lines.push({ kind: 'add', oldLine: null, newLine: newCursor, text: line.slice(1) });
      current.additions += 1;
      newCursor += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      hunk.lines.push({ kind: 'del', oldLine: oldCursor, newLine: null, text: line.slice(1) });
      current.deletions += 1;
      oldCursor += 1;
    } else if (line.startsWith(' ')) {
      hunk.lines.push({
        kind: 'context',
        oldLine: oldCursor,
        newLine: newCursor,
        text: line.slice(1),
      });
      oldCursor += 1;
      newCursor += 1;
    } else if (line.startsWith('\\ No newline')) {
    }
  }

  flushHunk();
  if (current) files.push(current);
  return files;
};

export const fetchPrDiff = async (
  runner: GhRunner,
  repo: string,
  prNumber: number,
  opts: { cwd?: string; token?: string; workspaceId?: string } = {},
): Promise<PullRequestDiff> => {
  const res = await runner.run(['pr', 'diff', String(prNumber), '--repo', repo], opts);
  if (res.exitCode !== 0) {
    throw new GhCliError(`gh pr diff exited with ${res.exitCode}`, res.stderr, res.exitCode);
  }
  return {
    prNumber,
    files: parseUnifiedDiff(res.stdout),
  };
};
