import { useAppStore } from '../../../../../../store';
import { ActivityRunScene } from '../../ActivityRunScene';
import { SESSION_ID } from '../../activityRunSeed';
import { OpenQuestionsScene } from '../../flow-audit/OpenQuestionsScene';
import { ContextMenuScene } from './ContextMenuScene';
import { seedLinkedWork } from './seedLinkedWork';
import { openLinkedRecord } from './openLinkedRecord';

const showContextPage = (): void => {
  useAppStore.setState((state) => ({
    activeLens: { ...state.activeLens, [SESSION_ID]: 'context' },
  }));
};

export const U36_CONTEXT_LINKED_SCENES = {
  'u36-p19-changed': () => <ActivityRunScene contextSection="goal" />,
  'u36-p19-read': () => <ActivityRunScene contextSection="goal" isContextRead />,
  'u36-p19-menu': ContextMenuScene,
  'u36-p19-summary': () => <ActivityRunScene contextSection="summary" />,
  'u36-p19b-questions-waiting': () => <OpenQuestionsScene />,
  'u36-p19b-questions-answered': () => <OpenQuestionsScene isAllAnswered />,
  'u36-p19b-linked': () => (
    <ActivityRunScene
      seedRuns={() => seedLinkedWork({})}
      onSeeded={showContextPage}
      isPageFollowed
    />
  ),
  'u36-p19b-disconnected': () => (
    <ActivityRunScene
      seedRuns={() => seedLinkedWork({ isDisconnected: true })}
      isPageFollowed
      onSeeded={() => openLinkedRecord({})}
    />
  ),
};
