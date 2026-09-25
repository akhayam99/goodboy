import { useEffect, useState } from 'react';
import { ConversationScenePane } from './ConversationScenePane';
import { FLAT_SOURCE, MR_SOURCE, READ_ONLY_SOURCE } from './conversationSeed';
import { useSceneClicks } from './audit/useSceneClicks';

const CLICKS: ReadonlyArray<string> = ['Quote'];

export const ConversationScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    document.getElementById('boot-shell')?.remove();
    setIsReady(true);
  }, []);

  useSceneClicks({
    isReady,
    labels: CLICKS,
    selector: '[data-scene-pane="flat"] button',
    match: 'contains',
    intervalMs: 200,
  });

  return (
    <div className="flex h-screen w-screen gap-4 overflow-auto bg-subtle p-4">
      <ConversationScenePane title="GitLab merge request" source={MR_SOURCE} />
      <div data-scene-pane="flat" className="flex h-full">
        <ConversationScenePane title="GitHub issue" source={FLAT_SOURCE} />
      </div>
      <ConversationScenePane title="Read only" source={READ_ONLY_SOURCE} />
    </div>
  );
};
