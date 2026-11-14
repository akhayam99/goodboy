import type { ReactNode } from 'react';
import { PANE_RHYTHM, PageColumn, cn, type PageColumnWidth } from '@goodboy/ui';
import { StudioBackButton } from './StudioBackButton';

type Props = {
  readonly label: string;
  readonly width?: PageColumnWidth;
  readonly isClosable?: boolean;
  readonly accessory?: ReactNode;
  readonly trailSlotRef?: (node: HTMLDivElement | null) => void;
  readonly onClose: () => void;
};

export const StudioBand = ({
  label,
  width = 'column',
  isClosable = true,
  accessory,
  trailSlotRef,
  onClose,
}: Props) => (
  <header aria-label={label} data-studio-band="" className={cn('shrink-0', PANE_RHYTHM.firstRow)}>
    <PageColumn width={width} className="flex h-full items-center gap-3">
      {isClosable ? <StudioBackButton onBack={onClose} /> : null}
      <div
        ref={trailSlotRef}
        data-slot="studio-trail"
        className="flex min-w-0 flex-1 items-center gap-2"
      />
      {accessory}
    </PageColumn>
  </header>
);
