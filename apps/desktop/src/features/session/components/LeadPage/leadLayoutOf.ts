export type LeadLayout = 'wide' | 'medium' | 'narrow';

export const LEAD_WIDE_MIN = 1180;

export const LEAD_MEDIUM_MIN = 860;

type Params = {
  readonly width: number | null;
};

export const leadLayoutOf = ({ width }: Params): LeadLayout => {
  if (width === null || width >= LEAD_WIDE_MIN) {
    return 'wide';
  }
  return width >= LEAD_MEDIUM_MIN ? 'medium' : 'narrow';
};
