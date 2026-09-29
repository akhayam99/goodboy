import { formatAge } from './time/formatAge';

type Params = {
  readonly fromIso: string;
  readonly nowMs?: number;
};

export const formatRelativeAge = ({ fromIso, nowMs }: Params): string =>
  formatAge({ from: fromIso, now: nowMs ?? Date.now() });
