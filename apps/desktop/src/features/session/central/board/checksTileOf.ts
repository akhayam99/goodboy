import type { SessionKpis } from './sessionKpisOf';

export type ChecksTile = Readonly<{
  value: string;
  unit: string;
  isFailing: boolean;
}>;

type Params = {
  readonly checks: SessionKpis['checks'];
};

export const checksTileOf = ({ checks }: Params): ChecksTile => {
  if (checks.failing > 0) {
    return { value: String(checks.failing), unit: 'failing', isFailing: true };
  }
  if (checks.running > 0) {
    return { value: String(checks.running), unit: 'running', isFailing: false };
  }
  return checks.total > 0
    ? { value: 'All', unit: 'passing', isFailing: false }
    : { value: '0', unit: 'checks', isFailing: false };
};
