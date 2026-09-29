// @vitest-environment node
import { spawnSync } from 'child_process';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const PACKAGES = ['core', 'db', 'types', 'ui'];

type DryTask = {
  readonly taskId: string;
  readonly dependencies: ReadonlyArray<string>;
};

const readTypecheckGraph = (): ReadonlyMap<string, ReadonlyArray<string>> => {
  const run = spawnSync('pnpm', ['exec', 'turbo', 'run', 'typecheck', '--dry=json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, TURBO_TELEMETRY_DISABLED: '1', TURBO_NO_UPDATE_NOTIFIER: '1' },
    maxBuffer: 32 * 1024 * 1024,
    timeout: 60_000,
  });
  const json = run.stdout.slice(run.stdout.indexOf('{'));
  const tasks = (JSON.parse(json) as { readonly tasks: ReadonlyArray<DryTask> }).tasks;
  return new Map(tasks.map((task) => [task.taskId, task.dependencies]));
};

const reachableFrom = ({
  graph,
  start,
}: {
  readonly graph: ReadonlyMap<string, ReadonlyArray<string>>;
  readonly start: string;
}): ReadonlySet<string> => {
  const seen = new Set<string>();
  const queue = [start];
  for (const id of queue) {
    for (const next of graph.get(id) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
};

describe('turbo typecheck graph', () => {
  const graph = readTypecheckGraph();

  it('ties the desktop typecheck hash to every package it imports', () => {
    const reached = reachableFrom({ graph, start: '@goodboy/desktop#typecheck' });

    for (const name of PACKAGES) {
      expect(reached.has(`@goodboy/${name}#transit`)).toBe(true);
    }
  });

  it('does not make one typecheck wait for another', () => {
    for (const [taskId, dependencies] of graph) {
      if (taskId.endsWith('#typecheck')) {
        expect(dependencies.filter((id) => id.endsWith('#typecheck'))).toEqual([]);
      }
    }
  });
});
