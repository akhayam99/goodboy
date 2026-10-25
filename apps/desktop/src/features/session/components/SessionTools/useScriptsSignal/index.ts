import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { scriptsSignalOf } from '../scriptsSignalOf';
import type { ToolSignal } from '../useToolSignal';

type Params = {
  readonly sessionId: SessionId;
};

export const useScriptsSignal = ({ sessionId }: Params): ToolSignal | null => {
  const runs = useAppStore((state) => state.scriptRuns[sessionId]);
  const seen = useAppStore((state) => state.scriptRunsSeen[sessionId]);
  return useMemo(() => scriptsSignalOf({ runs, seen }), [runs, seen]);
};
