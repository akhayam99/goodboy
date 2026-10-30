import type { SettingWords } from '../../../../shared/components/SettingChip/settingWords';
import { MODE_COPY, type PickerMode } from '../../../permissions/modeCopy';
import { START_KIND_COPY } from '../../startKind/startKindCopy';

type Params = {
  readonly mode: PickerMode;
  readonly workspaceMode: PickerMode;
  readonly workspaceName: string;
};

export const editsWordsOf = ({ mode, workspaceMode, workspaceName }: Params): SettingWords => {
  const own = MODE_COPY[mode].label;
  if (mode === workspaceMode) {
    return {
      value: own,
      source: `from ${workspaceName}`,
      chain: `From ${workspaceName}: ${own}.`,
    };
  }
  return {
    value: own,
    source: START_KIND_COPY.edits.thisSession,
    chain: `This session: ${own}. ${workspaceName}: ${MODE_COPY[workspaceMode].label}. The session wins.`,
  };
};
