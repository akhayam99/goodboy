import { POPOVER_WIDTH_CLASS, POPOVER_WIDTH_PX, useDropdown } from '@goodboy/ui';
import type { SessionId, WorkflowRun } from '@goodboy/types';
import { NAMES } from '../../../../shared/utils/names';
import { RunLimitFields } from './RunLimitFields';
import type { RunSettingWords } from './runSettingsOf';
import { SettingChip } from '../../../../shared/components/SettingChip';
import { useRunLimitDraft } from './useRunLimitDraft';

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly words: RunSettingWords;
};

const HELP = 'What this run may spend before it pauses. Applies when you press Enter or close.';

export const RunLimitSetting = ({ sessionId, run, words }: Props) => {
  const dropdown = useDropdown({
    expectedHeight: 240,
    expectedWidth: POPOVER_WIDTH_PX.standard,
    width: POPOVER_WIDTH_CLASS.standard,
  });
  const limit = useRunLimitDraft({ sessionId, run, isOpen: dropdown.open });
  return (
    <SettingChip
      dropdown={dropdown}
      label={NAMES.spendCap}
      words={words}
      help={HELP}
      error={limit.error}
    >
      <RunLimitFields run={run} limit={limit} />
    </SettingChip>
  );
};
