import { SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { START_FORM_KINDS, startShapeOfFormKind, type StartFormKind } from './startFormKinds';

type Props = {
  readonly kind: StartFormKind | null;
  readonly hasPresets: boolean;
  readonly isDisabled: boolean;
  readonly onPick: (kind: StartFormKind) => void;
};

type OptionsParams = {
  readonly hasPresets: boolean;
  readonly isDisabled: boolean;
};

const optionsOf = ({
  hasPresets,
  isDisabled,
}: OptionsParams): ReadonlyArray<SegmentedTabOption<StartFormKind>> =>
  START_FORM_KINDS.map((value) => {
    const isMissing = value === 'preset' && !hasPresets;
    return {
      value,
      label: START_KIND_COPY.kindTab[value],
      icon: START_KIND_COPY.shapes[startShapeOfFormKind({ kind: value })].icon,
      disabled: isDisabled || isMissing,
      ...(isMissing && { tooltip: START_KIND_COPY.noPresets }),
    };
  });

export const StartKindTabs = ({ kind, hasPresets, isDisabled, onPick }: Props) => (
  <SegmentedTabs<StartFormKind>
    ariaLabel={START_KIND_COPY.question}
    size="xs"
    value={kind}
    options={optionsOf({ hasPresets, isDisabled })}
    onChange={onPick}
  />
);
