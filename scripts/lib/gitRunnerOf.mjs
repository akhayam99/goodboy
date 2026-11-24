import { spawnSync } from 'node:child_process';

export const gitRunnerOf =
  ({ cwd }) =>
  ({ args }) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    return { status: result.status, stdout: (result.stdout ?? '').trim() };
  };
