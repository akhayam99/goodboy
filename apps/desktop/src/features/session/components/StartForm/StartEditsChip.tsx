import { ChoiceCards, POPOVER_WIDTH_CLASS, POPOVER_WIDTH_PX, useDropdown } from '@goodboy/ui';
import { modeSupportFor } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { SettingChip } from '../../../../shared/components/SettingChip';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { MODE_COPY, PICKER_MODES, type PickerMode } from '../../../permissions/modeCopy';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { editsWordsOf } from './editsWordsOf';

type PickParams = {
  readonly next: PickerMode;
};

type Props = {
  readonly value: PickerMode;
  readonly workspaceMode: PickerMode;
  readonly workspaceName: string;
  readonly provider: ProviderId | null;
  readonly isDisabled: boolean;
  readonly onPick: (params: PickParams) => void;
};

type UnavailableParams = {
  readonly provider: ProviderId | null;
  readonly mode: PickerMode;
};

const unavailableReasonOf = ({ provider, mode }: UnavailableParams): string | null => {
  if (provider === null) {
    return null;
  }
  const support = modeSupportFor({ provider, mode });
  if (support.support !== 'fallback' || support.reason === null) {
    return null;
  }
  return `Not available on ${PROVIDER_LABEL[provider]}: ${support.reason}`;
};

export const StartEditsChip = ({
  value,
  workspaceMode,
  workspaceName,
  provider,
  isDisabled,
  onPick,
}: Props) => {
  const dropdown = useDropdown({
    expectedHeight: 300,
    expectedWidth: POPOVER_WIDTH_PX.standard,
    width: POPOVER_WIDTH_CLASS.standard,
  });
  return (
    <SettingChip
      dropdown={dropdown}
      label={START_KIND_COPY.edits.label}
      words={editsWordsOf({ mode: value, workspaceMode, workspaceName })}
      help={START_KIND_COPY.edits.help}
      error={null}
    >
      <ChoiceCards<PickerMode>
        isHintWrapped
        ariaLabel={START_KIND_COPY.edits.label}
        className="sm:grid-cols-1"
        options={PICKER_MODES.map((mode) => {
          const reason = unavailableReasonOf({ provider, mode });
          return {
            value: mode,
            label: MODE_COPY[mode].label,
            hint: reason ?? MODE_COPY[mode].promise,
            icon: MODE_COPY[mode].icon,
            disabled: isDisabled || reason !== null,
          };
        })}
        value={value}
        onChange={(next) => {
          onPick({ next });
          dropdown.close();
        }}
      />
    </SettingChip>
  );
};
