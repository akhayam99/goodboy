export type RunRouteShape = 'plan' | 'lead';

export type RunRouteCloseness = 'follow' | 'adapt';

export type RunRoute = Readonly<{
  shape: RunRouteShape;
  row: number;
  presetName: string | null;
  closeness: RunRouteCloseness | null;
  role: string | null;
  choice: string;
  why: string;
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const textOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

type ParseParams = {
  readonly value: unknown;
};

export const parseRunRoute = ({ value }: ParseParams): RunRoute | null => {
  if (!isRecord(value)) {
    return null;
  }
  const shape = value.shape === 'plan' || value.shape === 'lead' ? value.shape : null;
  if (shape === null || typeof value.choice !== 'string' || typeof value.why !== 'string') {
    return null;
  }
  return {
    shape,
    row: typeof value.row === 'number' && Number.isInteger(value.row) ? value.row : 6,
    presetName: textOrNull(value.presetName),
    closeness: value.closeness === 'follow' || value.closeness === 'adapt' ? value.closeness : null,
    role: textOrNull(value.role),
    choice: value.choice,
    why: value.why,
  };
};
