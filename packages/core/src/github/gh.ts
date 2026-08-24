export type GhResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type GhRunOptions = {
  cwd?: string;
  token?: string;
  workspaceId?: string;
  projectId?: string;
  timeoutMs?: number;
};

export type GhRunner = {
  run(args: ReadonlyArray<string>, opts?: GhRunOptions): Promise<GhResult>;
};

export const DEFAULT_GH_TIMEOUT_MS = 8_000;

export class GhCliError extends Error {
  readonly stderr: string;
  readonly exitCode: number;
  constructor(message: string, stderr: string, exitCode: number) {
    super(message);
    this.name = 'GhCliError';
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export class GhJsonParseError extends Error {
  readonly raw: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = 'GhJsonParseError';
    this.raw = raw;
  }
}

export type GhDetectResult = {
  available: boolean;
  version?: string;
};

export const detect = async (runner: GhRunner): Promise<GhDetectResult> => {
  try {
    const res = await runner.run(['--version']);
    if (res.exitCode !== 0) {
      return { available: false };
    }
    const match = res.stdout.match(/gh version (\S+)/);
    return { available: true, version: match?.[1] };
  } catch {
    return { available: false };
  }
};

export const runJson = async <T>(
  runner: GhRunner,
  args: ReadonlyArray<string>,
  opts?: GhRunOptions,
): Promise<T> => {
  const res = await runner.run(args, opts);
  if (res.exitCode !== 0) {
    throw new GhCliError(
      `gh ${args.join(' ')} exited with ${res.exitCode}`,
      res.stderr,
      res.exitCode,
    );
  }
  try {
    return JSON.parse(res.stdout) as T;
  } catch (err) {
    throw new GhJsonParseError(
      `failed to parse JSON from gh: ${err instanceof Error ? err.message : String(err)}`,
      res.stdout,
    );
  }
};
