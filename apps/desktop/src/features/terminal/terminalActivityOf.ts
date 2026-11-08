export type TerminalActivity = {
  readonly tone: 'running' | 'passed' | 'failed';
  readonly text: string;
};

export type TerminalExit = {
  readonly code: number;
  readonly command: string | null;
};

type Params = {
  readonly tabIds: ReadonlyArray<string>;
  readonly busyIds: ReadonlySet<string>;
  readonly exits: ReadonlyMap<string, TerminalExit>;
  readonly commands: ReadonlyMap<string, string>;
};

const endedText = ({ command, code }: TerminalExit): string => {
  if (code === 0) {
    return command === null ? 'Passed' : `${command} passed`;
  }
  return command === null ? `Failed, exit ${code}` : `${command} failed, exit ${code}`;
};

export const terminalActivityOf = ({
  tabIds,
  busyIds,
  exits,
  commands,
}: Params): TerminalActivity | null => {
  const running = tabIds.find((id) => busyIds.has(id));
  if (running !== undefined) {
    return { tone: 'running', text: commands.get(running) ?? 'Running a command' };
  }
  const ended = tabIds.flatMap((id) => {
    const exit = exits.get(id);
    return exit === undefined ? [] : [exit];
  });
  const shown = ended.find((exit) => exit.code !== 0) ?? ended[0];
  if (shown === undefined) {
    return null;
  }
  return {
    tone: shown.code === 0 ? 'passed' : 'failed',
    text: endedText(shown),
  };
};
