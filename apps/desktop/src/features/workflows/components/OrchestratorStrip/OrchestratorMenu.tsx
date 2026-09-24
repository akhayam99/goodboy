import { useEffect, useState } from 'react';
import { CircleStop } from 'lucide-react';
import {
  AnchoredPopover,
  IconButton,
  InlineConfirm,
  MenuItems,
  cn,
  useDropdown,
} from '@goodboy/ui';
import type { OverflowMenuItem } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { WORKFLOW_ROUTING_COPY } from '../../workflowRoutingCopy';

type Props = {
  readonly canStopNow: boolean;
  readonly hasRouting: boolean;
  readonly isRoutingOpen: boolean;
  readonly onToggleRouting: () => void;
  readonly onStopNow: () => void;
};

const LABEL = 'Orchestrator actions';

export const OrchestratorMenu = ({
  canStopNow,
  hasRouting,
  isRoutingOpen,
  onToggleRouting,
  onStopNow,
}: Props) => {
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-72',
    expectedWidth: 288,
    expectedHeight: 140,
  });
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (dropdown.open) {
      return;
    }
    setIsConfirming(false);
  }, [dropdown.open]);

  if (!canStopNow && !hasRouting) {
    return null;
  }

  const routingItem: OverflowMenuItem = {
    kind: 'item',
    key: 'routing',
    label: isRoutingOpen
      ? `Hide ${WORKFLOW_ROUTING_COPY.sectionLabel.toLowerCase()}`
      : WORKFLOW_ROUTING_COPY.sectionLabel,
    icon: CONCEPT_ICONS.providers,
    onClick: () => {
      onToggleRouting();
      dropdown.close();
    },
  };
  const stopItem: OverflowMenuItem = {
    kind: 'item',
    key: 'stop',
    label: 'Stop now',
    icon: CircleStop,
    destructive: true,
    onClick: () => setIsConfirming(true),
  };
  const items = [...(hasRouting ? [routingItem] : []), ...(canStopNow ? [stopItem] : [])];

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={LABEL}
      anchorClassName="shrink-0"
      className="py-1"
      trigger={
        <IconButton
          variant="ghost"
          icon={CONCEPT_ICONS.more}
          iconSize={ICON_SIZE.row}
          label={LABEL}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className={cn('size-7', dropdown.open && 'bg-muted')}
        />
      }
    >
      {isConfirming ? (
        <InlineConfirm
          role="danger"
          icon={<CircleStop size={ICON_SIZE.control} aria-hidden />}
          title="Stop now?"
          description="The step in flight is cancelled and marked skipped. Everything it already wrote is kept."
          confirmLabel="Stop now"
          surface="plain"
          onConfirm={() => {
            dropdown.close();
            onStopNow();
          }}
          onCancel={() => setIsConfirming(false)}
        />
      ) : (
        <MenuItems items={items} onClose={() => undefined} />
      )}
    </AnchoredPopover>
  );
};
