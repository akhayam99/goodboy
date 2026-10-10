import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { SESSION } from '../workflowSeed';
import { AppFrame } from '../audit/AppFrame';
import { seedFrame } from '../audit/frameSeed';
import { seedLinearIssue } from './p-nav';

const placeOnFirstBranch = (): void => {
  const state = useAppStore.getState();
  const mount = state.sessionProjectMounts[SESSION.id]?.[0];
  const [first, ...rest] = state.sessionExternalTasks[SESSION.id] ?? [];
  if (mount === undefined || first === undefined) {
    return;
  }
  useAppStore.setState({
    sessionExternalTasks: {
      ...state.sessionExternalTasks,
      [SESSION.id]: [{ ...first, scope: 'branch', branch: mount.branch }, ...rest],
    },
  });
};

export const TaskMoveIssueScene = () => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedFrame({ context: 'session' });
    seedLinearIssue();
    placeOnFirstBranch();
    setIsReady(true);
  }, []);
  if (!isReady) {
    return null;
  }
  return <AppFrame view="session" isRailCollapsed={false} />;
};
