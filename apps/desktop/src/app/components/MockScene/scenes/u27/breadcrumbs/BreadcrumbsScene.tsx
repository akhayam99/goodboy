import { useEffect, useState } from 'react';
import { SessionWorkspace } from '../../../../../../features/session/components/SessionWorkspace';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../../store';
import { NOW, SESSIONS } from '../../flow-audit/fixtures';
import { ShellFrame, seedShellChrome } from '../../shellChrome';
import { BREADCRUMB_PLACES, type BreadcrumbPlaceId } from './breadcrumbPlaces';
import { SceneTauri } from './SceneTauri';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly placeId: BreadcrumbPlaceId;
};

export const BreadcrumbsScene = ({ theme, placeId }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const spec = BREADCRUMB_PLACES[placeId];
  const { session } = spec;

  useEffect(() => {
    applyDocumentTheme({ theme });
    spec.seed();
    seedShellChrome({
      session,
      siblings: SESSIONS.filter((candidate) => candidate.id !== session.id),
      branches: {},
      telemetryAt: NOW,
      lens: null,
    });
    useAppStore.setState({ currentWorkspaceId: session.workspaceId, selectedAgentId: {} });
    useAppStore.getInitialState().navigate({ to: spec.to });
    setIsReady(true);
  }, [session, spec, theme]);

  if (!isReady) {
    return null;
  }

  return (
    <>
      {spec.handlers === null ? null : <SceneTauri handlers={spec.handlers} />}
      <ShellFrame session={session} main={<SessionWorkspace session={session} isActive />} />
    </>
  );
};
