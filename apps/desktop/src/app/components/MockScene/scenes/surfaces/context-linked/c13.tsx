import { ActivityRunScene } from '../../ActivityRunScene';
import { ContextMenuScene } from './ContextMenuScene';
import { seedLinkedWork } from './seedLinkedWork';
import { openLinkedRecord } from './openLinkedRecord';

export const U36_CONTEXT_LINKED_SCENES = {
  'u36-p19-changed': () => <ActivityRunScene contextSection="goal" />,
  'u36-p19-read': () => <ActivityRunScene contextSection="goal" isContextRead />,
  'u36-p19-menu': ContextMenuScene,
  'u36-p19-summary': () => <ActivityRunScene contextSection="summary" />,
  'u36-p19b-linked': () => <ActivityRunScene seedRuns={() => seedLinkedWork({})} />,
  'u36-p19b-disconnected': () => (
    <ActivityRunScene
      seedRuns={() => seedLinkedWork({ isDisconnected: true })}
      isPageFollowed
      onSeeded={() => openLinkedRecord({})}
    />
  ),
};
