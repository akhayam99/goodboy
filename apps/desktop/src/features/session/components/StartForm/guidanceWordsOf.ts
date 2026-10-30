import type { SettingWords } from '../../../../shared/components/SettingChip/settingWords';
import { START_KIND_COPY } from '../../startKind/startKindCopy';

type Params = {
  readonly text: string;
  readonly workspaceText: string;
  readonly workspaceName: string;
};

const COPY = START_KIND_COPY.guidance;

export const guidanceWordsOf = ({ text, workspaceText, workspaceName }: Params): SettingWords => {
  const own = text.replace(/\s+/g, ' ').trim();
  const isDefault = text.trim() === workspaceText.trim();
  const value = own === '' ? COPY.noneValue : own;
  if (isDefault) {
    return {
      value,
      source: own === '' ? '' : COPY.fromWorkspace({ name: workspaceName }),
      chain:
        own === ''
          ? COPY.chainEmpty({ name: workspaceName })
          : COPY.chainDefault({ name: workspaceName }),
    };
  }
  return {
    value,
    source: COPY.thisRun,
    chain: COPY.chainOwn({ name: workspaceName }),
  };
};
