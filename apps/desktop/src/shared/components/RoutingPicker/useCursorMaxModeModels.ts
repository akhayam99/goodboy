import { useEffect, useMemo, useState } from 'react';
import { cursorMaxModeAdvisory } from '../../lib/cursorMaxModeAdvisory';
import { useAppStore } from '../../../store';

type Params = {
  readonly models: ReadonlyArray<string>;
};

export const useCursorMaxModeModels = ({ models }: Params): ReadonlySet<string> => {
  const accountId = useAppStore((state) => state.authResults?.cursor?.identity ?? 'unknown');
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      cursorMaxModeAdvisory.subscribe({
        onChange: () => setVersion((current) => current + 1),
      }),
    [],
  );

  return useMemo(
    () => new Set(models.filter((model) => cursorMaxModeAdvisory.has({ accountId, model }))),
    [accountId, models, version],
  );
};
