import type { ReactNode } from 'react';
import { DEVICE_FRAME_INSET_PX } from '../../devicePresets';

type Props = {
  readonly width: number;
  readonly children: ReactNode;
};

export const BrowserDeviceFrame = ({ width, children }: Props) => (
  <div className="flex min-h-0 flex-1 justify-center bg-subtle p-3">
    <div
      data-device-frame=""
      style={{ maxWidth: width + DEVICE_FRAME_INSET_PX * 2 }}
      className="flex min-h-0 w-full flex-col rounded-lg border border-border bg-background p-2"
    >
      {children}
    </div>
  </div>
);
