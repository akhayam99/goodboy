import { useEffect, useState } from 'react';
import { mockSceneIpc } from '../mockSceneIpc';
import { HintNodeBody } from './HintNodeBody';
import { HINT_NODE_SEED } from './hintNodeSeed';

const FRAME_WIDTH = 680;

export const HintNodeScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mockSceneIpc((cmd, payload) => {
      if (cmd !== 'attachment_read') {
        return undefined;
      }
      const relPath = HINT_NODE_SEED.imageRelPathOf({ payload });
      return relPath === null ? undefined : HINT_NODE_SEED.imageDataUriOf({ relPath });
    });
    HINT_NODE_SEED.seed();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }
  return (
    <div data-shot style={{ width: FRAME_WIDTH }}>
      <div className="flex flex-col bg-background p-6 text-foreground">
        <HintNodeBody />
      </div>
    </div>
  );
};
