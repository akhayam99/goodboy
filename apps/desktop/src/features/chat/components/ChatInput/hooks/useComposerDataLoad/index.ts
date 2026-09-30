import { useEffect } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';

type Params = {
  readonly session: Session;
};

export const useComposerDataLoad = ({ session }: Params) => {
  const loadScripts = useAppStore((s) => s.loadScripts);
  const loadPhaseTemplates = useAppStore((s) => s.loadPhaseTemplates);
  const loadPhaseRunsForSession = useAppStore((s) => s.loadPhaseRunsForSession);
  const loadAgentQueues = useAppStore((s) => s.loadAgentQueues);

  useEffect(() => {
    void loadScripts(session.workspaceId);
    void loadPhaseTemplates(session.workspaceId);
  }, [session.workspaceId, loadScripts, loadPhaseTemplates]);

  useEffect(() => {
    void loadPhaseRunsForSession(session.id).then(() => loadAgentQueues(session.id));
  }, [session.id, loadPhaseRunsForSession, loadAgentQueues]);
};
