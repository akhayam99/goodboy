import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export class GitError extends Error {
  constructor(
    message: string,
    public readonly stderr?: string,
  ) {
    super(message);
    this.name = 'GitError';
  }
}

export async function git(
  cwd: string,
  args: ReadonlyArray<string>,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await exec('git', [...args], { cwd });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    const error = err as NodeJS.ErrnoException & { stderr?: string };
    throw new GitError(`git ${args.join(' ')} failed: ${error.message}`.trim(), error.stderr);
  }
}
