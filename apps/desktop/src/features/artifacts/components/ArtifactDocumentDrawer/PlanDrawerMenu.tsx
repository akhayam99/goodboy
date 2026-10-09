import { ArrowUpRight, Copy, Maximize2, Minimize2 } from 'lucide-react';
import { OverflowMenu, type OverflowMenuItem } from '@goodboy/ui';

type Props = {
  readonly isExpanded: boolean;
  readonly onOpenInArtifacts: () => void;
  readonly onToggleExpanded: () => void;
  readonly onCopy: (() => void) | null;
};

export const PlanDrawerMenu = ({
  isExpanded,
  onOpenInArtifacts,
  onToggleExpanded,
  onCopy,
}: Props) => {
  const items: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'artifacts',
      label: 'Open in Artifacts',
      icon: ArrowUpRight,
      onClick: onOpenInArtifacts,
    },
    {
      kind: 'item',
      key: 'expand',
      label: isExpanded ? 'Collapse' : 'Expand',
      icon: isExpanded ? Minimize2 : Maximize2,
      onClick: onToggleExpanded,
    },
    ...(onCopy === null
      ? []
      : [
          {
            kind: 'item' as const,
            key: 'copy',
            label: 'Copy markdown',
            icon: Copy,
            onClick: onCopy,
          },
        ]),
  ];

  return <OverflowMenu items={items} label="More plan actions" size="control" />;
};
