import { AnchoredPopover, IconButton, MenuItems, cn, useDropdown } from '@goodboy/ui';
import type { OverflowMenuItem } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { WORKFLOW_ROUTING_COPY } from '../../workflowRoutingCopy';
import { RunAutonomyItems } from './RunAutonomyItems';

type RoutingToggle = {
  readonly isOpen: boolean;
  readonly onToggle: () => void;
};

type Props = {
  readonly label: string;
  readonly autoRun: boolean;
  readonly routing?: RoutingToggle | null;
  readonly onAutoRun: (autoRun: boolean) => void;
};

const routingItems = ({ routing }: { readonly routing: RoutingToggle | null }) =>
  routing === null
    ? []
    : [
        {
          kind: 'item',
          key: 'routing',
          label: routing.isOpen
            ? `Hide ${WORKFLOW_ROUTING_COPY.sectionLabel.toLowerCase()}`
            : WORKFLOW_ROUTING_COPY.sectionLabel,
          icon: CONCEPT_ICONS.providers,
          onClick: routing.onToggle,
        } satisfies OverflowMenuItem,
      ];

export const RunControlMenu = ({ label, autoRun, routing = null, onAutoRun }: Props) => {
  const items = routingItems({ routing });
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-64',
    expectedWidth: 256,
    expectedHeight: 140,
  });

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={label}
      anchorClassName="shrink-0"
      className="py-1"
      trigger={
        <IconButton
          variant="ghost"
          icon={CONCEPT_ICONS.more}
          iconSize={ICON_SIZE.row}
          label={label}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className={cn('size-7', dropdown.open && 'bg-muted')}
        />
      }
    >
      <RunAutonomyItems
        autoRun={autoRun}
        onChange={(next) => {
          dropdown.close();
          if (next === autoRun) {
            return;
          }
          onAutoRun(next);
        }}
      />
      {items.length === 0 ? null : (
        <>
          <div aria-hidden className="my-1 h-px bg-border-soft" />
          <MenuItems items={items} onClose={dropdown.close} />
        </>
      )}
    </AnchoredPopover>
  );
};
