import type { LiveTerminal } from './terminal';

type Params = {
  readonly terminal: Pick<LiveTerminal, 'pid' | 'foregroundPid'>;
};

export const isBusyTerminal = ({ terminal }: Params): boolean =>
  terminal.pid !== null &&
  terminal.foregroundPid !== null &&
  terminal.pid !== terminal.foregroundPid;
