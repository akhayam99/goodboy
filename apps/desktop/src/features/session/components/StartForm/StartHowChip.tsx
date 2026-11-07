import { ChoiceCards, POPOVER_WIDTH_CLASS, POPOVER_WIDTH_PX, useDropdown } from '@goodboy/ui';
import { SettingChip } from '../../../../shared/components/SettingChip';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { START_FORM_KINDS, startShapeOfFormKind, type StartFormKind } from './startFormKinds';

type Props = {
  readonly kind: StartFormKind;
  readonly hasPresets: boolean;
  readonly isDisabled: boolean;
  readonly onPick: (kind: StartFormKind) => void;
};

export const StartHowChip = ({ kind, hasPresets, isDisabled, onPick }: Props) => {
  const dropdown = useDropdown({
    expectedHeight: 300,
    expectedWidth: POPOVER_WIDTH_PX.standard,
    width: POPOVER_WIDTH_CLASS.standard,
  });
  return (
    <SettingChip
      dropdown={dropdown}
      label={START_KIND_COPY.how}
      words={{
        value: START_KIND_COPY.kindTab[kind],
        source: '',
        chain: '',
        isChanged: kind !== 'auto',
      }}
      help={START_KIND_COPY.pickLine}
      error={null}
    >
      <ChoiceCards<StartFormKind>
        isHintWrapped
        ariaLabel={START_KIND_COPY.question}
        className="sm:grid-cols-1"
        options={START_FORM_KINDS.map((value) => {
          const isMissing = value === 'preset' && !hasPresets;
          return {
            value,
            label: START_KIND_COPY.kindTab[value],
            hint: isMissing ? START_KIND_COPY.noPresets : START_KIND_COPY.kindLine[value],
            icon: START_KIND_COPY.shapes[startShapeOfFormKind({ kind: value })].icon,
            disabled: isDisabled || isMissing,
          };
        })}
        value={kind}
        onChange={(next) => {
          onPick(next);
          dropdown.close();
        }}
      />
    </SettingChip>
  );
};
