import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../store';

export type SessionNavMode = 'lenses' | 'sessions';

type SessionNavModeState = {
  readonly mode: SessionNavMode;
  readonly setMode: (mode: SessionNavMode) => void;
};

export const useSessionNavMode = (): SessionNavModeState => {
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const [mode, setMode] = useState<SessionNavMode>('lenses');

  useEffect(() => {
    setMode('lenses');
  }, [currentSessionId]);

  return { mode, setMode };
};
