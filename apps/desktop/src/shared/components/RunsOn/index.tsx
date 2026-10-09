import { useShallow } from 'zustand/react/shallow';
import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, PopoverBody, cn, useDropdown } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import type { AgentKindRouting } from '../../../features/session/agent-kind';
import { RoutingPickerBody } from '../RoutingPicker/RoutingPickerBody';
import { SUGGESTED_LABEL } from '../RoutingPicker/autoRecommendationCopy';
import { routingLabelParts, routingNameText } from '../RoutingPicker/routingSummary';
import { ICON_SIZE } from '../conceptIcons';

type Props = {
  readonly suggested: AgentKindRouting;
  readonly override: AgentKindRouting | null;
  readonly onChange: (next: AgentKindRouting | null) => void;
  readonly disabled?: boolean;
  readonly className?: string;
};

const RUNS_ON_LABEL = 'Runs on';

export const RunsOn = ({ suggested, override, onChange, disabled = false, className }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    expectedHeight: 420,
    expectedWidth: 360,
    width: 'w-[22.5rem] max-w-[calc(100vw-2rem)]',
    disabled,
  });
  const connectedProviders = useAppStore(
    useShallow((state) =>
      state.providers.filter((provider) => provider.connection === 'connected').map(({ id }) => id),
    ),
  );
  const routing = override ?? suggested;
  const label = routingLabelParts(routing);
  const name = routingNameText(label);

  return (
    <div
      data-testid="runs-on"
      className={cn(
        'flex min-w-0 items-center gap-0.5 text-label text-muted-foreground',
        className,
      )}
    >
      <span className="min-w-0 truncate">
        {RUNS_ON_LABEL} <span className="text-foreground">{name}</span>
        {label.detail.map((part) => ` · ${part}`).join('')} ·
      </span>
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel={`${RUNS_ON_LABEL} ${name}`}
        className="flex max-h-[calc(100vh-1rem)] flex-col bg-subtle"
        anchorClassName="flex shrink-0"
        trigger={
          <button
            type="button"
            onClick={dropdown.toggle}
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            className="inline-flex items-center gap-0.5 rounded-md px-1 text-label text-foreground transition-colors hover:bg-hover disabled:opacity-60"
          >
            Change
            <ChevronDown size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
          </button>
        }
      >
        <PopoverBody>
          <RoutingPickerBody
            connectedProviders={connectedProviders}
            onClose={dropdown.close}
            recommendation={{ ...suggested, label: SUGGESTED_LABEL }}
            overridden={override !== null}
            onReset={() => onChange(null)}
            provider={routing.provider}
            model={routing.model}
            effort={{ editable: true, value: routing.effort }}
            onChange={(route) => {
              if (route.provider === '') {
                onChange(null);
                return;
              }
              onChange({ provider: route.provider, model: route.model, effort: route.effort });
            }}
          />
        </PopoverBody>
      </AnchoredPopover>
    </div>
  );
};
