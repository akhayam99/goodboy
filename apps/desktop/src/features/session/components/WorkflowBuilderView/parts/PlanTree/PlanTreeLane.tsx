import { runIdentityStroke } from '../../../../timeline/runIdentity';

export type PlanLaneSpan = 'through' | 'origin' | 'tip' | 'none';

type Props = {
  readonly span: PlanLaneSpan;
  readonly identityIndex: number;
};

const LANE_X = 10;
const NODE_CENTER_Y = 16;
const LANE_WIDTH = 2;
const DASH_PATTERN = '3 3';

const endsOf = ({ span }: { readonly span: Exclude<PlanLaneSpan, 'none'> }) => {
  switch (span) {
    case 'through':
      return { from: '0', to: '100%' };
    case 'origin':
      return { from: '0', to: String(NODE_CENTER_Y) };
    case 'tip':
      return { from: String(NODE_CENTER_Y), to: '100%' };
    default: {
      const exhaustive: never = span;
      return exhaustive;
    }
  }
};

export const PlanTreeLane = ({ span, identityIndex }: Props) => {
  if (span === 'none') {
    return null;
  }
  const { from, to } = endsOf({ span });
  return (
    <svg aria-hidden className="absolute inset-0 size-full overflow-visible">
      <line
        x1={LANE_X}
        x2={LANE_X}
        y1={from}
        y2={to}
        stroke={runIdentityStroke({ index: identityIndex })}
        strokeWidth={LANE_WIDTH}
        strokeDasharray={DASH_PATTERN}
        strokeLinecap="butt"
      />
    </svg>
  );
};
