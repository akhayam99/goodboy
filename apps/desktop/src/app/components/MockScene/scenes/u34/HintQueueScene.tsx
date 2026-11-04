import { useEffect, useState } from 'react';
import { HINT_NODE_SEED } from '../surfaces/hint-node/hintNodeSeed';
import { mockSceneIpc } from '../mockSceneIpc';
import { HintQueueBody } from './HintQueueBody';
import { HINT_QUEUE_SEED } from './hintQueueSeed';

type Props = {
  readonly isReading: boolean;
};

export const HintQueueScene = ({ isReading }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    mockSceneIpc((cmd, payload) => {
      if (cmd !== 'attachment_read') {
        return undefined;
      }
      const relPath = HINT_NODE_SEED.imageRelPathOf({ payload });
      return relPath === null ? undefined : HINT_NODE_SEED.imageDataUriOf({ relPath });
    });
    HINT_QUEUE_SEED.seed({ isReading });
    setIsReady(true);
  }, [isReading]);

  if (!isReady) {
    return null;
  }
  return <HintQueueBody />;
};
