import { lastCommandOf } from './commandTracker';

type Params = {
  readonly terminalId: string;
  readonly foregroundCommands: ReadonlyMap<string, string>;
};

export const terminalCommandOf = ({ terminalId, foregroundCommands }: Params): string | null =>
  foregroundCommands.get(terminalId) ?? lastCommandOf({ terminalId });
