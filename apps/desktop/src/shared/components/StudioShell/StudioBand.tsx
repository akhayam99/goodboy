import type { ReactNode } from 'react';
import { PageColumn, type PageColumnWidth } from '@goodboy/ui';
import { StudioCloseButton } from './StudioCloseButton';

type Props = {
  readonly label: string;
  readonly width?: PageColumnWidth;
  readonly closeLabel: string;
  readonly isClosable?: boolean;
  readonly accessory?: ReactNode;
  readonly trailSlotRef?: (node: HTMLDivElement | null) => void;
  readonly onClose: () => void;
};

export const StudioBand = ({
  label,
  width = 'column',
  closeLabel,
  isClosable = true,
  accessory,
  trailSlotRef,
  onClose,
}: Props) => (
  <header aria-label={label} data-studio-band="" className="h-10 shrink-0">
    <PageColumn width={width} className="flex h-full items-center gap-3">
      <div
        ref={trailSlotRef}
        data-slot="studio-trail"
        className="flex min-w-0 flex-1 items-center gap-2"
      />
      {accessory}
      {isClosable ? <StudioCloseButton label={closeLabel} onClose={onClose} /> : null}
    </PageColumn>
  </header>
);
