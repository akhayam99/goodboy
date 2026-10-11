import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectCheckChain } from '../../../../store/slices/agents/selectCheckChain';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';

type Params = {
  readonly sessionId: SessionId;
  readonly url: string;
};

export const useCheckChain = ({ sessionId, url }: Params) => {
  const chain = useAppStore(useShallow((state) => selectCheckChain({ state, sessionId, url })));
  const loadAgentTranscript = useAppStore((state) => state.loadAgentTranscript);
  const reportError = useAppStore((state) => state.reportError);
  const hasDebuggerTranscript = useAppStore(
    (state) => chain.debugger !== null && state.transcripts[chain.debugger.id] !== undefined,
  );
  const hasFixTranscript = useAppStore(
    (state) => chain.fix !== null && state.transcripts[chain.fix.id] !== undefined,
  );
  const debuggerId = chain.debugger?.id;
  const fixId = chain.fix?.id;
  const fixStatus = chain.fix?.status;
  useEffect(() => {
    const missing = [
      ...(debuggerId !== undefined && !hasDebuggerTranscript ? [debuggerId] : []),
      ...(fixId !== undefined && !hasFixTranscript ? [fixId] : []),
    ];
    for (const agentId of missing) {
      void loadAgentTranscript(sessionId, agentId, { isSelecting: false }).catch(
        (error: unknown) => {
          if (!isReportedError(error)) {
            void reportError({ title: "Couldn't read the analysis", error, sessionId });
          }
        },
      );
    }
  }, [
    debuggerId,
    fixId,
    fixStatus,
    hasDebuggerTranscript,
    hasFixTranscript,
    loadAgentTranscript,
    reportError,
    sessionId,
  ]);
  const events = useAppStore((state) =>
    chain.debugger === null ? undefined : state.transcripts[chain.debugger.id],
  );
  const turnState = useAppStore((state) =>
    chain.debugger === null ? undefined : state.agentTurnState[chain.debugger.id],
  );
  return { chain, events, turnState };
};
