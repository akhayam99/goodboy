import { useEffect, useState } from 'react';
import { SessionDraftPane } from '../../../../../../features/session/components/SessionDraftPane';
import { START_KIND_COPY } from '../../../../../../features/session/startKind/startKindCopy';
import { WORKSPACE_ID } from '../../BoardScene';
import { StudioFrame } from '../../StudioFrame';
import { seedTaskPicker, type TaskPickerSceneState } from './seedTaskPicker';

type Props = {
  readonly state: TaskPickerSceneState;
};

const OPEN_POLL_MS = 50;
const OPEN_TRIES = 40;

export const TaskPickerScene = ({ state }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedTaskPicker({ state });
    setIsReady(true);
  }, [state]);

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const trigger = document.querySelector<HTMLButtonElement>(
        `[role="combobox"][aria-label="${START_KIND_COPY.pickTask}"]`,
      );
      if (trigger !== null) {
        trigger.click();
      }
      if (trigger !== null || tries >= OPEN_TRIES) {
        window.clearInterval(timer);
      }
    }, OPEN_POLL_MS);
    return () => window.clearInterval(timer);
  }, [isReady]);

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
