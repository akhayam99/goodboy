import type { AutoLevel, LeadPermissions } from '@goodboy/core/auto';
import { Button, Chip, FieldRow, SegmentedTabs } from '@goodboy/ui';
import { RUN_AUTONOMY_OPTIONS } from '../../workflows/runAutonomy';
import { leadDetailsDifferOf } from './leadDetailsDifferOf';
import { LEAD_LEVEL_COPY } from './leadLevelCopy';

type PickParams = {
  readonly level: AutoLevel;
};

type Props = {
  readonly permissions: LeadPermissions;
  readonly error: string | null;
  readonly isDisabled: boolean;
  readonly onPick: (params: PickParams) => void;
};

export const LeadLevelRow = ({ permissions, error, isDisabled, onPick }: Props) => {
  const { level } = permissions;
  const differ = leadDetailsDifferOf({ permissions });
  const isCustom = differ > 0;
  return (
    <FieldRow
      label={LEAD_LEVEL_COPY.menu}
      layout="stacked"
      help={
        <>
          {LEAD_LEVEL_COPY.help({ level, differ })}
          {error === null ? null : (
            <span role="alert" className="text-danger">
              {' '}
              {error}
            </span>
          )}
        </>
      }
      marker={
        isCustom ? (
          <>
            <Chip tone="neutral" kind="state" emphasis="subtle" label={LEAD_LEVEL_COPY.custom} />
            <Button
              variant="quiet"
              size="xs"
              intent="neutral"
              disabled={isDisabled}
              aria-label={LEAD_LEVEL_COPY.reset({ level })}
              onClick={() => onPick({ level })}
            >
              Reset
            </Button>
          </>
        ) : null
      }
    >
      <SegmentedTabs<AutoLevel>
        size="sm"
        ariaLabel={LEAD_LEVEL_COPY.menu}
        value={isCustom ? null : level}
        options={RUN_AUTONOMY_OPTIONS.map((option) => ({
          value: option.key,
          label: option.label,
          tooltip: LEAD_LEVEL_COPY.line({ level: option.key }),
          disabled: isDisabled,
        }))}
        onChange={(next) => onPick({ level: next })}
      />
    </FieldRow>
  );
};
