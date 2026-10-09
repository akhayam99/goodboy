import { Fragment, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import type { WorkflowAutonomy } from '@goodboy/types';
import { AnchoredPopover, IconButton, MenuItems, cn, useDropdown } from '@goodboy/ui';
import type { OverflowMenuItem } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { WORKFLOW_ROUTING_COPY } from '../../workflowRoutingCopy';
import { RunAutonomyItems } from './RunAutonomyItems';

type RoutingToggle = {
  readonly isOpen: boolean;
  readonly onToggle: () => void;
};

type AutonomyChoice = {
  readonly value: WorkflowAutonomy;
  readonly onChange: (autonomy: WorkflowAutonomy) => void;
};

type ApprovePlanItem = {
  readonly reason: string | null;
  readonly onApprove: () => void;
};

type Props = {
  readonly label: string;
  readonly autonomy?: AutonomyChoice | null;
  readonly routing?: RoutingToggle | null;
  readonly approvePlan?: ApprovePlanItem | null;
};

type Section = {
  readonly key: string;
  readonly node: ReactNode;
};

type RoutingParams = {
  readonly routing: RoutingToggle | null;
};

type ApproveParams = {
  readonly approvePlan: ApprovePlanItem | null;
};

const routingItems = ({ routing }: RoutingParams): ReadonlyArray<OverflowMenuItem> =>
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
        },
      ];

const approveItems = ({ approvePlan }: ApproveParams): ReadonlyArray<OverflowMenuItem> =>
  approvePlan === null
    ? []
    : [
        {
          kind: 'item',
          key: 'approve-plan',
          label: 'Approve plan',
          icon: Check,
          disabled: approvePlan.reason !== null,
          ...(approvePlan.reason !== null && { description: approvePlan.reason }),
          onClick: approvePlan.onApprove,
        },
      ];

export const RunControlMenu = ({
  label,
  autonomy = null,
  routing = null,
  approvePlan = null,
}: Props) => {
  const approve = approveItems({ approvePlan });
  const items = routingItems({ routing });
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-60',
    expectedWidth: 256,
    expectedHeight: 140,
  });

  const sections: ReadonlyArray<Section> = [
    ...(approve.length > 0
      ? [
          {
            key: 'approve',
            node: <MenuItems items={approve} onClose={dropdown.close} />,
          },
        ]
      : []),
    ...(autonomy === null
      ? []
      : [
          {
            key: 'autonomy',
            node: (
              <RunAutonomyItems
                autonomy={autonomy.value}
                onChange={(next) => {
                  dropdown.close();
                  if (next === autonomy.value) {
                    return;
                  }
                  autonomy.onChange(next);
                }}
              />
            ),
          },
        ]),
    ...(items.length > 0
      ? [{ key: 'routing', node: <MenuItems items={items} onClose={dropdown.close} /> }]
      : []),
  ];

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
          className={cn(dropdown.open && 'bg-muted')}
        />
      }
    >
      {sections.map((section, index) => (
        <Fragment key={section.key}>
          {index > 0 ? <div aria-hidden className="my-1 h-px bg-border-soft" /> : null}
          {section.node}
        </Fragment>
      ))}
    </AnchoredPopover>
  );
};
