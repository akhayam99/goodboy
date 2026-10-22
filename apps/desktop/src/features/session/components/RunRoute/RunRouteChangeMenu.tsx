import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, ROW_INTERACTIVE, cn, useDropdown, type MenuEntry } from '@goodboy/ui';
import type { Workflow } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { AppMenuList } from '../../../actions/AppMenuList';
import type { RunRouteChoice } from '../../startRun/changeRunRoute';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';

type Props = {
  readonly current: RunRouteChoice;
  readonly presets: ReadonlyArray<Workflow>;
  readonly isBusy: boolean;
  readonly onChoose: (choice: RunRouteChoice) => void;
  readonly onSessionDefault: () => void;
};

const NO_PRESET = 'none';

const SHAPE_OPTIONS = [
  { key: 'plan', label: RUN_ROUTE_COPY.shapes.plan },
  { key: 'lead', label: RUN_ROUTE_COPY.shapes.lead },
] as const;

const CLOSENESS_OPTIONS = [
  { key: 'follow', label: RUN_ROUTE_COPY.closeness.follow },
  { key: 'adapt', label: RUN_ROUTE_COPY.closeness.adapt },
] as const;

export const RunRouteChangeMenu = ({
  current,
  presets,
  isBusy,
  onChoose,
  onSessionDefault,
}: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-80',
    expectedWidth: 320,
    expectedHeight: 320,
  });

  const entries = useMemo((): ReadonlyArray<MenuEntry> => {
    const presetChecked = current.shape === 'plan' ? (current.presetId ?? NO_PRESET) : null;
    const shape: MenuEntry = {
      kind: 'radio',
      key: 'shape',
      label: RUN_ROUTE_COPY.runItAs,
      choices: SHAPE_OPTIONS.map((option) => ({
        id: option.key,
        label: option.label,
        isCurrent: option.key === current.shape,
      })),
      isDisabled: isBusy,
      onSelect: (key) =>
        onChoose({
          ...current,
          shape: key === 'lead' ? 'lead' : 'plan',
          presetId: key === current.shape ? current.presetId : null,
        }),
    };
    const preset: ReadonlyArray<MenuEntry> =
      presets.length > 0
        ? [
            {
              kind: 'radio',
              key: 'preset',
              label: RUN_ROUTE_COPY.startFrom,
              choices: [
                ...presets.map((option) => ({ id: option.id, label: option.name })),
                { id: NO_PRESET, label: RUN_ROUTE_COPY.noPreset },
              ].map((option) => ({ ...option, isCurrent: option.id === presetChecked })),
              isDisabled: isBusy,
              onSelect: (key) =>
                onChoose({
                  ...current,
                  shape: 'plan',
                  presetId:
                    key === NO_PRESET
                      ? null
                      : (presets.find((option) => option.id === key)?.id ?? null),
                }),
            },
          ]
        : [];
    const closeness: ReadonlyArray<MenuEntry> =
      current.shape === 'plan' && current.presetId !== null
        ? [
            {
              kind: 'radio',
              key: 'closeness',
              label: RUN_ROUTE_COPY.withPreset,
              choices: CLOSENESS_OPTIONS.map((option) => ({
                id: option.key,
                label: option.label,
                isCurrent: option.key === current.closeness,
              })),
              isDisabled: isBusy,
              onSelect: (key) =>
                onChoose({ ...current, closeness: key === 'follow' ? 'follow' : 'adapt' }),
            },
          ]
        : [];
    return [
      shape,
      ...preset,
      ...closeness,
      {
        kind: 'item',
        key: 'session-default',
        label: RUN_ROUTE_COPY.sessionDefault,
        isDisabled: isBusy,
        onSelect: onSessionDefault,
      },
    ];
  }, [current, presets, isBusy, onChoose, onSessionDefault]);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName="inline-flex"
      trigger={
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          disabled={isBusy}
          onClick={dropdown.toggle}
          className={cn(
            'inline-flex items-center gap-1 rounded-md py-0.5 text-muted-foreground',
            ROW_INTERACTIVE,
            dropdown.open && 'bg-selected text-foreground',
          )}
        >
          <span>{RUN_ROUTE_COPY.change}</span>
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        </button>
      }
    >
      <AppMenuList label={RUN_ROUTE_COPY.routeLabel} entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
