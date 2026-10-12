type RecordParams = {
  readonly terminalId: string;
};

let captured: Set<string> | null = null;

export const exitCapture = {
  begin: (): void => {
    captured = new Set();
  },
  record: ({ terminalId }: RecordParams): void => {
    captured?.add(terminalId);
  },
  end: (): ReadonlySet<string> => {
    const seen = captured ?? new Set<string>();
    captured = null;
    return seen;
  },
};
