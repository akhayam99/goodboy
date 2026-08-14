import { tintClasses, type Tone } from '@goodboy/ui';

const LEVEL_TONES: Readonly<Record<string, Tone>> = {
  fatal: 'danger',
  error: 'danger',
  warning: 'warning',
  info: 'info',
  debug: 'neutral',
};

type Params = {
  readonly level: string | null;
};

export const levelTone = ({ level }: Params): string => {
  const tint = tintClasses(LEVEL_TONES[level?.toLowerCase() ?? ''] ?? 'neutral');
  return `${tint.border} ${tint.bg} ${tint.text}`;
};
