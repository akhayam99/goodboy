import { isDestructiveScript } from '../suggestions/signals/isDestructiveScript';

export type CommandSource = 'script' | 'check-log' | 'agent';

type Params = {
  readonly source: CommandSource;
  readonly scriptId: string | null;
  readonly scriptName: string | null;
};

export const commandRunOf = ({ source, scriptId, scriptName }: Params): 'run' | 'type' => {
  if (source !== 'script' || scriptId === null || scriptName === null) {
    return 'type';
  }
  if (isDestructiveScript({ name: scriptName })) {
    return 'type';
  }
  return 'run';
};
