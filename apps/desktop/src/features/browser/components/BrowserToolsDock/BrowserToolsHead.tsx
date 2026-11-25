import type { ReactNode } from 'react';
import { PanelBottom, PanelRight, X } from '@goodboy/ui/icons';
import { IconButton, SegmentedTabs } from '@goodboy/ui';
import type { BrowserToolsSide } from '../../browserToolsDockPref';
import type { BrowserConsoleKind } from '../../types';

type KindParams = {
  readonly next: BrowserConsoleKind;
};

type Props = {
  readonly kind: BrowserConsoleKind;
  readonly counts: Readonly<Record<BrowserConsoleKind, number>>;
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

export const BrowserToolsHead = ({ kind, counts, side, tools, onKind, onSide, onClose }: Props) => (
  <div className="flex h-9 shrink-0 items-center gap-1 px-2">
    <SegmentedTabs
      size="xs"
      ariaLabel="Console or Network"
      value={kind}
      onChange={(next) => onKind({ next })}
      options={[
        { value: 'console', label: 'Console', badge: counts.console },
        { value: 'network', label: 'Network', badge: counts.network },
      ]}
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
