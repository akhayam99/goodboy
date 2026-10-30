import { ChevronDown } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  ICON_SIZE,
  POPOVER_WIDTH_CLASS,
  POPOVER_WIDTH_PX,
  PopoverBody,
  cn,
  useDropdown,
} from '@goodboy/ui';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import { RoutingPickerBody } from '../../../../shared/components/RoutingPicker/RoutingPickerBody';
import { recommendationSummary } from '../../../../shared/components/RoutingPicker/recommendationSummary';
import { openSettings } from '../../../settings/openSettings';
import { RUN_MODEL_COPY } from '../../startRun/runModelCopy';
import type { RunModelView } from './useRunModel';

type Props = {
  readonly model: RunModelView;
  readonly label?: string;
  readonly isDisabled: boolean;
};

export const RunModelChip = ({ model, label = RUN_MODEL_COPY.label, isDisabled }: Props) => {
  const { effective, suggestion, isPinned, connectedProviders, pick } = model;
  const menuLabel = RUN_MODEL_COPY.forThisRun({ name: model.label });
  const settingsSection = model.slot.kind === 'orchestrator' ? 'workflow_orchestrator' : undefined;
  const dropdown = useDropdown({
    align: 'start',
    disabled: isDisabled,
    width: POPOVER_WIDTH_CLASS.wide,
    expectedWidth: POPOVER_WIDTH_PX.wide,
    expectedHeight: 520,
  });
  const summary = recommendationSummary({
    provider: effective.provider,
    model: effective.model,
    effort: effective.effort,
  });
  const state = isPinned ? RUN_MODEL_COPY.pinned : RUN_MODEL_COPY.auto;
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={menuLabel}
      anchorClassName="inline-flex"
      trigger={
        <Button
          size="xs"
          variant="secondary"
          disabled={isDisabled}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          aria-label={`${label}: ${summary}, ${state}`}
          data-setting-chip={label}
          data-run-model={isPinned ? 'pinned' : 'auto'}
          onClick={dropdown.toggle}
          className={cn('max-w-72 justify-start', dropdown.open && 'bg-selected')}
        >
          <span className="shrink-0 text-muted-foreground">{label}</span>
          <span className="flex min-w-0 items-center text-foreground">
            <RoutingLabel
              provider={effective.provider}
              model={effective.model}
              effort={effective.effort}
            />
          </span>
          <span className="shrink-0 text-faint-foreground">{`· ${state}`}</span>
          <ChevronDown
            size={ICON_SIZE.row}
            aria-hidden
            className="shrink-0 text-faint-foreground"
          />
        </Button>
      }
    >
      <PopoverBody>
        <RoutingPickerBody
          connectedProviders={connectedProviders}
          provider={effective.provider}
          model={effective.model}
          effort={{ editable: true, value: effective.effort }}
          onClose={dropdown.close}
          recommendation={{ ...suggestion, reason: RUN_MODEL_COPY.reason }}
          recommendationKind="auto"
          overridden={isPinned}
          onChange={(route) => pick(route.provider === '' ? null : route)}
        />
        <div className="flex px-3 py-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              dropdown.close();
              openSettings({
                scope: 'providers',
                ...(settingsSection !== undefined && { section: settingsSection }),
              });
            }}
          >
            {RUN_MODEL_COPY.changeDefault}
          </Button>
        </div>
      </PopoverBody>
    </AnchoredPopover>
  );
};
