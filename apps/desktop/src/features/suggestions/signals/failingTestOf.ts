export type FailingTest = {
  readonly file: string | null;
  readonly name: string | null;
};

type Params = {
  readonly log: string;
};

const FILE_PATH = /^[\w@][\w@./-]*\.(?:test|spec)\.[cm]?[jt]sx?$|^[\w./-]*test_\w+\.py$/;

const TEST_FILE_IN_LINE =
  /(?:FAIL|FAILED|failed|✗|×|❯)\s+(?:\S+\s+)?((?:[\w@.-]+\/)*[\w@.-]+\.(?:test|spec)\.[cm]?[jt]sx?)/;

const PYTEST_LINE = /FAILED\s+((?:[\w.-]+\/)*test_\w+\.py)(?:::(\w+))?/;

const GO_LINE = /--- FAIL:\s+(Test\w+)/;

const CARGO_LINE = /^test\s+([\w:]+)\s+\.\.\.\s+FAILED/;

type LineParams = {
  readonly line: string;
};

const lineWithFile = ({ line }: LineParams): FailingTest | null => {
  const python = PYTEST_LINE.exec(line);
  if (python !== null && python[1] !== undefined) {
    return { file: python[1], name: python[2] ?? null };
  }
  const javascript = TEST_FILE_IN_LINE.exec(line);
  const file = javascript?.[1];
  if (file !== undefined && FILE_PATH.test(file)) {
    return { file, name: null };
  }
  return null;
};

const lineWithName = ({ line }: LineParams): FailingTest | null => {
  const go = GO_LINE.exec(line);
  if (go !== null && go[1] !== undefined) {
    return { file: null, name: go[1] };
  }
  const cargo = CARGO_LINE.exec(line);
  if (cargo !== null && cargo[1] !== undefined) {
    return { file: null, name: cargo[1] };
  }
  return null;
};

export const failingTestOf = ({ log }: Params): FailingTest | null => {
  const lines = log.replace(/\u001B\[[0-9;]*m/g, '').split('\n');
  for (const line of lines) {
    const found = lineWithFile({ line }) ?? lineWithName({ line });
    if (found !== null) {
      return found;
    }
  }
  return null;
};
