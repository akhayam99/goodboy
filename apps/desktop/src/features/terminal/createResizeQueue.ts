type TerminalSize = {
  readonly cols: number;
  readonly rows: number;
};

type Params = {
  readonly send: (size: TerminalSize) => Promise<unknown>;
};

type SameParams = {
  readonly a: TerminalSize | null;
  readonly b: TerminalSize;
};

const isSameSize = ({ a, b }: SameParams): boolean =>
  a !== null && a.cols === b.cols && a.rows === b.rows;

export const createResizeQueue = ({ send }: Params) => {
  let sent: TerminalSize | null = null;
  let pending: TerminalSize | null = null;
  let isSending = false;

  const flush = (): void => {
    if (isSending || pending === null) {
      return;
    }
    const next = pending;
    pending = null;
    if (isSameSize({ a: sent, b: next })) {
      return;
    }
    isSending = true;
    void send(next).then(
      () => {
        sent = next;
        isSending = false;
        flush();
      },
      () => {
        sent = null;
        isSending = false;
        flush();
      },
    );
  };

  return {
    push: ({ cols, rows }: TerminalSize): void => {
      pending = { cols, rows };
      flush();
    },
  };
};
