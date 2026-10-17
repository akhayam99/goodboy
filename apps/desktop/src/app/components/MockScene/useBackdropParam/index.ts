import { useEffect } from 'react';
import { sceneParam } from '../scenes/audit/sceneParams';

const STRENGTH_VAR = '--app-backdrop-strength';
const MAX_STRENGTH = 20;

type StrengthParams = {
  readonly value: string | null;
};

const strengthOf = ({ value }: StrengthParams): number | null => {
  if (value === null || value.trim() === '') {
    return null;
  }
  const strength = Number(value);
  if (!Number.isFinite(strength) || strength < 0 || strength > MAX_STRENGTH) {
    return null;
  }
  return strength;
};

export const useBackdropParam = (): void => {
  useEffect(() => {
    const strength = strengthOf({ value: sceneParam({ key: 'backdrop' }) });
    if (strength === null) {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty(STRENGTH_VAR, String(strength));
    return () => {
      root.style.removeProperty(STRENGTH_VAR);
    };
  }, []);
};
