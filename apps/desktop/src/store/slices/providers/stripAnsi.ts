const ANSI_RE = /\x1B\[[0-?]*[ -/]*[@-~]/g;

type Params = {
  readonly text: string;
};

export const stripAnsi = ({ text }: Params): string => text.replace(ANSI_RE, '');
