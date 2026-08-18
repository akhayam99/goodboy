export type TimelineRowGrade = 'entry' | 'step' | 'pending';

export type TimelineGap = 'none' | 'sibling' | 'entry';

type GradeRhythm = {
  readonly lineHeight: number;
  readonly height: number;
  readonly markerSize: number;
  readonly glyphSize: number;
  readonly dotSize: number;
};

const GRADE: Record<TimelineRowGrade, GradeRhythm> = {
  entry: { lineHeight: 20, height: 36, markerSize: 16, glyphSize: 10, dotSize: 6 },
  step: { lineHeight: 16, height: 28, markerSize: 12, glyphSize: 8, dotSize: 4 },
  pending: { lineHeight: 16, height: 16, markerSize: 12, glyphSize: 8, dotSize: 4 },
};

const GAP: Record<TimelineGap, number> = {
  none: 0,
  sibling: 4,
  entry: 12,
};

export const TIMELINE_RHYTHM = {
  grade: GRADE,
  gap: GAP,
  day: { height: 48, ruleY: 24 },
  now: { height: 48, ruleY: 12 },
} as const;

type BoxParams = {
  readonly grade: TimelineRowGrade;
  readonly gap: TimelineGap;
};

export const rowBoxHeight = ({ grade, gap }: BoxParams): number => GAP[gap] + GRADE[grade].height;

export const markerCenterY = ({ grade, gap }: BoxParams): number => {
  const { lineHeight, height } = GRADE[grade];
  return GAP[gap] + (height - lineHeight) / 2 + lineHeight / 2;
};
