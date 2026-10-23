import type { WorkflowAutonomy } from '@goodboy/types';
import type { SettingWords } from '../../shared/components/SettingChip/settingWords';
import { runAutonomyOf, type RunAutonomyOption } from './runAutonomy';

type Params = {
  readonly own: RunAutonomyOption;
  readonly workspaceName: string;
  readonly workspaceAutonomy: WorkflowAutonomy;
};

export const asksWordsOf = ({ own, workspaceName, workspaceAutonomy }: Params): SettingWords => {
  const inherited = runAutonomyOf({ autoRun: false, autonomy: workspaceAutonomy });
  if (own.key === inherited.key) {
    return {
      value: own.label,
      source: `from ${workspaceName}`,
      chain: `From ${workspaceName}: ${own.label}.`,
    };
  }
  return {
    value: own.label,
    source: 'this run',
    chain: `This run: ${own.label}. ${workspaceName}: ${inherited.label}. The run wins.`,
  };
};
