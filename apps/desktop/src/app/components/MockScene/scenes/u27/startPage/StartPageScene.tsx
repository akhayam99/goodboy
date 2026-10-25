import { useEffect, useState } from 'react';
import { SessionDraftPane } from '../../../../../../features/session/components/SessionDraftPane';
import type { SessionDraft } from '../../../../../../store/slices/sessionDraft/state';
import { WORKSPACE_ID } from '../../BoardScene';
import { StudioFrame } from '../../StudioFrame';
import { seedStartPage } from './seedStartPage';

type Props = {
  readonly draft: Partial<SessionDraft>;
};

export const StartPageScene = ({ draft }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedStartPage({ draft: { hasChosenStart: true, ...draft } });
    setIsReady(true);
  }, [draft]);

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
