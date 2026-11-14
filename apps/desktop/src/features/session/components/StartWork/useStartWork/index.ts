import { useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import type { StartWorkSeed } from '../../../../../store/slices/work/state';
import { startWorkRun } from '../../../../work/startWorkRun';
import { agentRoutingOfPin } from '../../../startRun/runModelPin';
import { AUTO_AGENT_SLOT } from '../../../startRun/runModelSlotOf';
import { useRunModel, type RunModelModel } from '../../StartRun/useRunModel';
import { useStartFromDraft } from '../../SessionKickoff/useStartFromDraft';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly seed: StartWorkSeed;
  readonly onStarted: () => void;
};

export type StartWorkModel = Readonly<{
  text: string;
  setText: (text: string) => void;
  sessionId: SessionId | null;
  setSessionId: (sessionId: SessionId | null) => void;
  projectId: ProjectId | null;
  setProjectId: (projectId: ProjectId | null) => void;
  branch: string | null;
  setBranch: (branch: string | null) => void;
  model: RunModelModel;
  isStarting: boolean;
  error: string | null;
  start: () => Promise<void>;
}>;

export const useStartWork = ({ workspaceId, seed, onStarted }: Params): StartWorkModel => {
  const [text, setText] = useState(seed.text);
  const [sessionId, setSessionId] = useState<SessionId | null>(seed.sessionId);
  const [projectId, setProjectId] = useState<ProjectId | null>(seed.projectId);
  const [branch, setBranch] = useState<string | null>(seed.branch);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStartingRef = useRef(false);
  const model = useRunModel({ workspaceId, sessionId, slot: AUTO_AGENT_SLOT });
  const startFromDraft = useStartFromDraft();
  const { pinFor, clear } = model;

  const start = async (): Promise<void> => {
    if (text.trim() === '' || isStartingRef.current) {
      return;
    }
    const target = { workspaceId, sessionId, projectId, branch };
    const pin = pinFor({ slot: AUTO_AGENT_SLOT });
    isStartingRef.current = true;
    setIsStarting(true);
    setError(null);
    try {
      await startWorkRun({
        target,
        text,
        routing: pin === null ? null : agentRoutingOfPin({ pin }),
        startFromDraft,
      });
      clear();
      onStarted();
    } catch (cause) {
      setError(formatError(cause));
    } finally {
      isStartingRef.current = false;
      setIsStarting(false);
    }
  };

  return {
    text,
    setText,
    sessionId,
    setSessionId,
    projectId,
    setProjectId,
    branch,
    setBranch,
    model,
    isStarting,
    error,
    start,
  };
};
