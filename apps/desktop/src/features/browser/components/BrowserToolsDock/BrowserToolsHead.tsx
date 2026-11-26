import type { ReactNode } from 'react';
import { PanelBottom, PanelRight, X } from '@goodboy/ui/icons';
import { IconButton, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { BrowserToolsSide } from '../../browserToolsDockPref';
import type { BrowserToolsTab } from '../../types';

type KindParams = {
  readonly next: BrowserToolsTab;
};

type Props = {
  readonly kind: BrowserToolsTab;
  readonly counts: Readonly<Record<BrowserToolsTab, number>>;
  readonly side: BrowserToolsSide;
  readonly tools: ReactNode;
  readonly onKind: (params: KindParams) => void;
  readonly onSide: () => void;
  readonly onClose: () => void;
};

const SIDE_LABEL = {
  bottom: 'Dock right of the page',
  right: 'Dock under the page',
} as const satisfies Record<BrowserToolsSide, string>;

export const BrowserToolsHead = ({ kind, counts, side, tools, onKind, onSide, onClose }: Props) => {
  const options: ReadonlyArray<SegmentedTabOption<BrowserToolsTab>> = [
    { value: 'console', label: 'Console', badge: counts.console },
    { value: 'network', label: 'Network', badge: counts.network },
    ...(counts.errors > 0
      ? [
          {
            value: 'errors' as const,
            label: 'Errors',
            badge: (
              <span data-muted-count="" className="shrink-0 tabular-nums text-danger">
                {counts.errors}
              </span>
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 px-2">
      <SegmentedTabs
        size="xs"
        ariaLabel="Tools"
        value={kind}
        onChange={(next) => onKind({ next })}
        options={options}
      />
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{tools}</div>
      <IconButton
        size="xs"
        icon={side === 'bottom' ? PanelRight : PanelBottom}
        label={SIDE_LABEL[side]}
        onClick={onSide}
      />
      <IconButton size="xs" icon={X} label="Close tools" onClick={onClose} />
    </div>
  );
};
