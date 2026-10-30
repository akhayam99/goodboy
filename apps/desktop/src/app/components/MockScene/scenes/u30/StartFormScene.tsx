import { useEffect, useState } from 'react';
import { useAppStore } from '../../../../../store';
import { SessionDraftPane } from '../../../../../features/session/components/SessionDraftPane';
import type { SessionDraft } from '../../../../../store/slices/sessionDraft/state';
import { useSceneClicks } from '../audit/useSceneClicks';
import { WORKSPACE_ID } from '../BoardScene';
import { StudioFrame } from '../StudioFrame';
import { seedStartPage } from '../u27/startPage/seedStartPage';

type Props = {
  readonly draft: Partial<SessionDraft>;
  readonly openLabels: ReadonlyArray<string>;
};

export const StartFormScene = ({ draft, openLabels }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedStartPage({ draft: { hasChosenStart: true, ...draft } });
    useAppStore.setState({
      workspaceValues: { [WORKSPACE_ID]: { 'auto.treeLimitUsd': '5' } },
      loadWorkspaceValue: async () => null,
    });
    setIsReady(true);
  }, [draft]);

  useSceneClicks({
    isReady,
    labels: openLabels,
    selector: 'button',
    match: 'prefix',
    intervalMs: 300,
  });

  if (!isReady) {
    return null;
  }
  return (
    <StudioFrame
      target={{ place: null, tool: null }}
      main={<SessionDraftPane workspaceId={WORKSPACE_ID} />}
    />
  );
};
