import { useEffect, useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
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
    <ScrollFade
      orientation="horizontal"
      fadeFrom="subtle"
      className="h-screen w-screen bg-subtle"
      viewportClassName="flex gap-4 p-4"
    >
      <ConversationScenePane title="GitLab merge request" label="Review" source={MR_SOURCE} />
      <div data-scene-pane="flat" className="flex h-full">
        <ConversationScenePane title="GitHub issue" label="Discussion" source={FLAT_SOURCE} />
      </div>
      <ConversationScenePane title="Read only" label="Archive" source={READ_ONLY_SOURCE} />
    </ScrollFade>
  );
};
