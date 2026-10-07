import { useRef, type ReactNode } from 'react';
import { useToastLift } from '../../../../shared/components/Toast';

type Props = {
  readonly children: ReactNode;
};

export const TranscriptReplyDock = ({ children }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useToastLift({ ref });
  return (
    <div ref={ref} data-testid="transcript-drawer-reply" className="shrink-0 px-4 pb-4">
      {children}
    </div>
  );
};
