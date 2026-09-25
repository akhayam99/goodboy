import type { ReactNode } from 'react';
import { PlanTreeLane, type PlanLaneSpan } from './PlanTreeLane';

type Props = {
  readonly span: PlanLaneSpan;
  readonly identityIndex: number;
  readonly node?: ReactNode;
};

export const PlanTreeGutter = ({ span, identityIndex, node = null }: Props) => (
  <span className="relative w-5 shrink-0 self-stretch">
    <PlanTreeLane span={span} identityIndex={identityIndex} />
    {node === null ? null : <span className="absolute inset-x-0 top-1.5 flex">{node}</span>}
  </span>
);
