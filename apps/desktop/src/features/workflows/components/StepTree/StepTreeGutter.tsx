import type { ReactNode } from 'react';
import { StepTreeLane, type StepLaneSpan } from './StepTreeLane';

type Props = {
  readonly span: StepLaneSpan;
  readonly identityIndex: number;
  readonly node?: ReactNode;
};

export const StepTreeGutter = ({ span, identityIndex, node = null }: Props) => (
  <span className="relative w-5 shrink-0 self-stretch">
    <StepTreeLane span={span} identityIndex={identityIndex} />
    {node === null ? null : <span className="absolute inset-x-0 top-1.5 flex">{node}</span>}
  </span>
);
