import { ListFilter } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  Divider,
  PopoverFooter,
  SegmentedTabs,
  cn,
  tintClasses,
  useDropdown,
  type SegmentedTabOption,
} from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../../shared/components/conceptIcons';
import {
  ACTIVITY_GROUPS,
  ACTIVITY_PRESET_LABEL,
  activityToggleLabel,
  type ActivityCounts,
  type ActivityFilter,
  type ActivityPreset,
  type ActivityToggle,
} from '../../../../../timeline/activityFilter';
import { ActivityFilterGroup } from './ActivityFilterGroup';

const PANEL_LABEL = 'Activity filter';

const PANEL_WIDTH = 640;

const PANEL_EXPECTED_HEIGHT = 340;

const SUMMARY_NAME_LIMIT = 3;

const HIDDEN_NAMES = new Intl.ListFormat('en', { type: 'conjunction' });

type PresetOption = ActivityPreset | 'custom';

const PRESET_ORDER: ReadonlyArray<ActivityPreset> = ['everything', 'work', 'needsYou'];

const CUSTOM_OPTION: SegmentedTabOption<PresetOption> = { value: 'custom', label: 'Custom' };

type Props = {
  readonly filter: ActivityFilter;
  readonly hidden: ReadonlyArray<ActivityToggle>;
  readonly preset: ActivityPreset | null;
  readonly counts: ActivityCounts;
  readonly visibleCount: number;
  readonly totalCount: number;
  readonly onToggle: (params: {
    readonly toggle: ActivityToggle;
    readonly enabled: boolean;
  }) => void;
  readonly onPreset: (params: { readonly preset: ActivityPreset }) => void;
};

type SummaryParams = {
  readonly hidden: ReadonlyArray<ActivityToggle>;
  readonly preset: ActivityPreset | null;
};

const summaryOf = ({ hidden, preset }: SummaryParams): string => {
  if (preset === 'needsYou') {
    return 'Only what needs you is showing';
  }
  if (hidden.length === 0) {
    return 'Everything is showing';
  }
  if (hidden.length > SUMMARY_NAME_LIMIT) {
    return `${hidden.length} kinds of rows are hidden`;
  }
  const names = HIDDEN_NAMES.format(hidden.map((toggle) => activityToggleLabel({ toggle })));
  return `${names} ${hidden.length === 1 ? 'is' : 'are'} hidden`;
};

const triggerDetailOf = ({ hidden, preset }: SummaryParams): string | null => {
  if (preset === 'needsYou') {
    return ACTIVITY_PRESET_LABEL.needsYou;
  }
  return hidden.length === 0 ? null : `${hidden.length} hidden`;
};

export const ActivityFilterPanel = ({
  filter,
  hidden,
  preset,
  counts,
  visibleCount,
  totalCount,
  onToggle,
  onPreset,
}: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: PANEL_EXPECTED_HEIGHT,
    expectedWidth: PANEL_WIDTH,
    width: 'w-[40rem] max-w-[calc(100vw-2rem)]',
  });
  const { open, toggle } = dropdown;
  const detail = triggerDetailOf({ hidden, preset });
  const presetOptions: ReadonlyArray<SegmentedTabOption<PresetOption>> = [
    ...PRESET_ORDER.map((value) => ({ value, label: ACTIVITY_PRESET_LABEL[value] })),
    ...(preset === null ? [CUSTOM_OPTION] : []),
  ];

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={PANEL_LABEL}
      className="bg-elevated"
      anchorClassName="flex"
      trigger={
        <button
          type="button"
          onClick={toggle}
          aria-label="Filter the activity feed"
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            detail === null
              ? 'text-muted-foreground hover:text-foreground'
              : cn('text-foreground ring-1 ring-inset', tintClasses('primary').ringStrong),
            open && 'bg-selected',
          )}
        >
          <ListFilter size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          Filter
          {detail === null ? null : <span className="text-faint-foreground">{detail}</span>}
        </button>
      }
    >
      <div className="@container flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs<PresetOption>
            size="sm"
            ariaLabel="Filter presets"
            options={presetOptions}
            value={preset ?? 'custom'}
            onChange={(value) => {
              if (value === 'custom') {
                return;
              }
              onPreset({ preset: value });
            }}
          />
          <span className="text-2xs tabular-nums text-muted-foreground">
            {`Showing ${visibleCount} of ${totalCount} rows`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 @[34rem]:grid-cols-3">
          {ACTIVITY_GROUPS.map((group) => (
            <ActivityFilterGroup
              key={group.id}
              label={group.label}
              categories={group.categories}
              filter={filter}
              counts={counts}
              onToggle={onToggle}
            />
          ))}
        </div>
      </div>
      <Divider />
      <PopoverFooter className="flex min-h-9 items-center gap-2 px-3 py-1">
        <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
          {summaryOf({ hidden, preset })}
        </span>
        {preset === 'everything' ? null : (
          <Button variant="ghost" size="sm" onClick={() => onPreset({ preset: 'everything' })}>
            Show everything
          </Button>
        )}
      </PopoverFooter>
    </AnchoredPopover>
  );
};
