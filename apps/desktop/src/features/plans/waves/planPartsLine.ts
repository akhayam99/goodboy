import type { PlanPartOrder } from './planPartOrder';

type Params = Readonly<{
  order: PlanPartOrder;
  count: number;
}>;

export const planPartsLine = ({ order, count }: Params): string => {
  if (count === 1) {
    return '1 part.';
  }
  const widest = Math.max(...order.waves.map((wave) => wave.rows.length));
  return widest > 1 ? `${count} parts, ${widest} at once.` : `${count} parts, one after the other.`;
};
