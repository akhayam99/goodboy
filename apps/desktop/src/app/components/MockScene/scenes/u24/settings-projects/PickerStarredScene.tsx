import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import { MountProjectList } from '../../../../../../features/session/components/SessionOverviewPane/ProjectMountRows/MountProjectList';
import { starredProjectsFirst } from '../../../../../../shared/utils/starredProjectsFirst';
import type { SessionId } from '@goodboy/types';
import { SETTINGS_WORKSPACE } from '../../audit/settingsSeed';
import { useAppStore } from '../../../../../../store';
import { projectsOf } from './settingsProjectsSeed';

const SESSION_VALUE = 'mock-settings-projects-session';

const isSessionId = (value: string): value is SessionId => value === SESSION_VALUE;

type IdParams = {
  readonly value: string;
};

const sessionIdOf = ({ value }: IdParams): SessionId => {
  if (!isSessionId(value)) {
    throw new Error(`not a session id: ${value}`);
  }
  return value;
};

const SESSION_ID = sessionIdOf({ value: SESSION_VALUE });

const PROJECTS = starredProjectsFirst({
  projects: projectsOf({ isStarredShown: true }),
  inside: 'recency',
});

const noop = () => undefined;

export const PickerStarredScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    useAppStore.setState({
      workspaces: [SETTINGS_WORKSPACE],
      currentWorkspaceId: SETTINGS_WORKSPACE.id,
      projects: [...PROJECTS],
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <ToastProvider>
      <div className="flex justify-center pt-12">
        <div className="w-80 rounded-lg border border-border-soft bg-floating p-1 shadow-lg">
          <MountProjectList
            sessionId={SESSION_ID}
            workspaceId={SETTINGS_WORKSPACE.id}
            emptyHint=""
            projects={PROJECTS}
            onDone={noop}
          />
        </div>
      </div>
    </ToastProvider>
  );
};
