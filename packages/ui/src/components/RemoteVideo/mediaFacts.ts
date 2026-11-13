const KB = 1024;
const MB = KB * KB;

type SizeParams = {
  readonly bytes: number;
};

export const sizeLabel = ({ bytes }: SizeParams): string => {
  if (bytes < MB) {
    return `${Math.max(1, Math.round(bytes / KB))} KB`;
  }
  return `${(bytes / MB).toFixed(1)} MB`;
};

type LengthParams = {
  readonly seconds: number;
};

export const lengthLabel = ({ seconds }: LengthParams): string | null => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = String(whole % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
};
