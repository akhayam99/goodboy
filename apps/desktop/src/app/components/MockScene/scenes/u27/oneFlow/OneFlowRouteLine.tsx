import { Check, ChevronDown } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  ICON_SIZE,
  MenuItems,
  useDropdown,
  type OverflowMenuItem,
} from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { ONE_FLOW_COPY, type OneFlowCloseness, type OneFlowShape } from './oneFlowCopy';
import { PRESET_NAME } from './oneFlowSeed';

export type OneFlowRoute = Readonly<{
  shape: OneFlowShape;
  closeness: OneFlowCloseness | null;
  choice: string;
  why: string;
}>;

type Props = {
  readonly route: OneFlowRoute;
};

const noop = () => undefined;

type PickParams = {
  readonly key: string;
  readonly label: string;
  readonly isCurrent: boolean;
};

const pickOf = ({ key, label, isCurrent }: PickParams): OverflowMenuItem => ({
  kind: 'item',
  key,
  label,
  onClick: noop,
  ...(isCurrent ? { icon: Check, iconClassName: 'text-foreground' } : {}),
});

type ItemsParams = {
  readonly route: OneFlowRoute;
};

const itemsOf = ({ route }: ItemsParams): ReadonlyArray<OverflowMenuItem> => {
  const hasPreset = route.closeness !== null;
  return [
    { kind: 'header', key: 'shape', label: ONE_FLOW_COPY.shapeHeader },
    pickOf({ key: 'plan', label: ONE_FLOW_COPY.shapes.plan, isCurrent: route.shape === 'plan' }),
    pickOf({ key: 'lead', label: ONE_FLOW_COPY.shapes.lead, isCurrent: route.shape === 'lead' }),
    { kind: 'header', key: 'preset', label: ONE_FLOW_COPY.presetHeader },
    pickOf({ key: 'fix-layout', label: PRESET_NAME, isCurrent: hasPreset }),
    pickOf({ key: 'no-preset', label: ONE_FLOW_COPY.noPreset, isCurrent: !hasPreset }),
    ...(hasPreset
      ? [
          { kind: 'header', key: 'closeness', label: ONE_FLOW_COPY.closenessHeader } as const,
          pickOf({
            key: 'follow',
            label: ONE_FLOW_COPY.closeness.follow,
            isCurrent: route.closeness === 'follow',
          }),
          pickOf({
            key: 'adapt',
            label: ONE_FLOW_COPY.closeness.adapt,
            isCurrent: route.closeness === 'adapt',
          }),
        ]
      : []),
    { kind: 'separator', key: 'end' },
    { kind: 'item', key: 'remember', label: ONE_FLOW_COPY.remember, onClick: noop },
  ];
};

export const OneFlowRouteLine = ({ route }: Props) => {
  const dropdown = useDropdown({ align: 'end', width: 'min-w-64', expectedHeight: 320 });
  const Icon = route.shape === 'plan' ? CONCEPT_ICONS.orchestrator : CONCEPT_ICONS.auto;
  return (
    <div
      role="group"
      aria-label={ONE_FLOW_COPY.routeLabel}
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-ui text-muted-foreground"
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="text-foreground">{route.choice}</span>
      <span aria-hidden className="text-faint-foreground">
        ·
      </span>
      <span className="min-w-0">{route.why}</span>
      <span data-one-flow-change="" className="flex">
        <AnchoredPopover
          dropdown={dropdown}
          role="menu"
          ariaLabel={ONE_FLOW_COPY.routeLabel}
          className="py-1"
          trigger={
            <Button
              variant="ghost"
              size="sm"
              aria-haspopup="menu"
              aria-expanded={dropdown.open}
              onClick={dropdown.toggle}
            >
              {ONE_FLOW_COPY.change}
              <ChevronDown size={ICON_SIZE.control} aria-hidden />
            </Button>
          }
        >
          <MenuItems items={itemsOf({ route })} onClose={dropdown.close} />
        </AnchoredPopover>
      </span>
    </div>
  );
};
