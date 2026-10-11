import type { ReactNode } from 'react';

type Props = {
  readonly id: string;
  readonly width: number;
  readonly children: ReactNode;
};

export const FrameStage = ({ id, width, children }: Props) => (
  <div data-testid={id} className="[&_.w-screen]:w-full [&>div]:w-full" style={{ width }}>
    {children}
  </div>
);
