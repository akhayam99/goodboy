import type { ReactNode } from 'react';
import { StepTreeGutter } from '../../StepTree/StepTreeGutter';
import type { StepLaneSpan } from '../../StepTree/StepTreeLane';

type Props = {
  readonly span: StepLaneSpan;
  readonly identityIndex: number;
  readonly node?: ReactNode;
  readonly trailing?: ReactNode;
  readonly dataStep?: string;
  readonly children: ReactNode;
};

export const LaneRow = ({
  span,
  identityIndex,
  node = null,
  trailing = null,
  dataStep,
  children,
}: Props) => (
  <li className="flex min-w-0 gap-2" data-lane-step={dataStep}>
    <StepTreeGutter span={span} identityIndex={identityIndex} node={node} />
    <div className="flex h-8 min-w-0 flex-1 items-center gap-3 pl-2">
      {children}
      {trailing}
    </div>
  </li>
);
