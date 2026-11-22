import { Checkbox, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import type { MountId, SessionProjectMount } from '@goodboy/types';
import { FilterButton } from '../../../../shared/components/FilterButton';
import { NAMES } from '../../../../shared/utils/names';

type ChangeParams = {
  readonly mountIds: ReadonlySet<MountId>;
};

type Props = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly selected: ReadonlySet<MountId>;
  readonly onChange: (params: ChangeParams) => void;
};

type ToggleParams = {
  readonly mountId: MountId;
};

const ROW_PX = 28;

const PADDING_PX = 16;

const MAX_HEIGHT_PX = 420;

type LabelParams = {
  readonly mount: SessionProjectMount;
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

const projectLabelOf = ({ mount, mounts }: LabelParams): string =>
  mounts.filter((other) => other.mountName === mount.mountName).length > 1
    ? `${mount.mountName} · ${mount.branch}`
    : mount.mountName;

export const ActivityProjectFilter = ({ mounts, selected, onChange }: Props) => {
  const toggle = ({ mountId }: ToggleParams) => {
    const next = new Set(selected);
    if (next.has(mountId)) {
      next.delete(mountId);
      onChange({ mountIds: next });
      return;
    }
    next.add(mountId);
    onChange({ mountIds: next });
  };
  return (
    <FilterButton
      label={NAMES.activityProjectFilter}
      popoverLabel={NAMES.activityProjectFilter}
      activeCount={selected.size}
      popoverHeight={Math.min(MAX_HEIGHT_PX, PADDING_PX + mounts.length * ROW_PX)}
      facets={
        <div role="group" aria-label={NAMES.projects} className="flex flex-col px-1">
          {mounts.map((mount) => {
            const isChecked = selected.has(mount.mountId);
            const label = projectLabelOf({ mount, mounts });
            return (
              <Checkbox
                key={mount.mountId}
                checked={isChecked}
                onChange={() => toggle({ mountId: mount.mountId })}
                ariaLabel={label}
                className={cn('flex min-h-7 w-full rounded-md pl-1 pr-2', ROW_INTERACTIVE)}
                label={
                  <span
                    data-activity-project=""
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      isChecked ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {label}
                  </span>
                }
              />
            );
          })}
        </div>
      }
    />
  );
};
