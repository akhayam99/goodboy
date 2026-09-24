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

export class GhJsonShapeError extends GhJsonParseError {
  readonly expected: GhJsonShape;
  constructor(message: string, raw: string, expected: GhJsonShape) {
    super(message, raw);
    this.name = 'GhJsonShapeError';
    this.expected = expected;
  }
}

export type GhJsonShape = 'object' | 'array';

type RunJsonParams = {
  readonly runner: GhRunner;
  readonly args: ReadonlyArray<string>;
  readonly opts?: GhRunOptions;
  readonly shape: GhJsonShape;
};

const parseStdout = ({ stdout }: { readonly stdout: string }): unknown => {
  try {
    return JSON.parse(stdout);
  } catch (err) {
    throw new GhJsonParseError(
      `failed to parse JSON from gh: ${err instanceof Error ? err.message : String(err)}`,
      stdout,
    );
  }
};

const shapeOf = ({ value }: { readonly value: unknown }): GhJsonShape | null => {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'object' && value !== null) {
    return 'object';
  }
  return null;
};

export const runJson = async <T>({ runner, args, opts, shape }: RunJsonParams): Promise<T> => {
  const res = await runner.run(args, opts);
  if (res.exitCode !== 0) {
    throw new GhCliError(
      `gh ${args.join(' ')} exited with ${res.exitCode}`,
      res.stderr,
      res.exitCode,
    );
  }
  const parsed = parseStdout({ stdout: res.stdout });
  const actual = shapeOf({ value: parsed });
  if (actual !== shape) {
    throw new GhJsonShapeError(
      `gh ${args.join(' ')} returned ${actual ?? typeof parsed}, expected ${shape}`,
      res.stdout,
      shape,
    );
  }
  return parsed as T;
};
