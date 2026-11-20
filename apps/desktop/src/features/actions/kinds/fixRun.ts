import { OctagonX, RefreshCw, RotateCcw } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { ITEM_WORK_WORDS } from '../../live-state/itemWork/itemWorkWords';
import type { FixRunActionTarget, ObjectKindDefinition } from '../types';

export type FixRunStop = {
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly onStop: () => void;
};

export type FixRunFacts = {
  readonly stop: FixRunStop | null;
  readonly transcriptNote: string | null;
  readonly onOpenTranscript: (() => void) | null;
  readonly onRetryWithHint: (() => void) | null;
  readonly startOverNote: string | null;
  readonly onStartOver: (() => void) | null;
};

export const FIX_RUN_KIND: ObjectKindDefinition<FixRunActionTarget, FixRunFacts> = {
  noun: 'fix',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'fixRun.retryWithHint',
      label: ITEM_WORK_WORDS.verb.retryWithHint,
      icon: RefreshCw,
      group: 'act',
      when: ({ facts }) => facts.onRetryWithHint !== null,
      run: ({ facts }) => facts.onRetryWithHint?.(),
    },
    {
      id: 'fixRun.startOver',
      label: ITEM_WORK_WORDS.verb.startOver,
      icon: RotateCcw,
      group: 'act',
      description: ({ facts }) => facts.startOverNote,
      when: ({ facts }) => facts.onStartOver !== null,
      run: ({ facts }) => facts.onStartOver?.(),
    },
    {
      id: 'fixRun.openTranscript',
      label: ITEM_WORK_WORDS.verb.openTranscript,
      icon: CONCEPT_ICONS.runs,
      group: 'open',
      description: ({ facts }) => facts.transcriptNote,
      when: ({ facts }) => facts.onOpenTranscript !== null,
      run: ({ facts }) => facts.onOpenTranscript?.(),
    },
    {
      id: 'fixRun.stopAll',
      label: ({ facts }) => facts.stop?.label ?? ITEM_WORK_WORDS.verb.stopAll,
      icon: OctagonX,
      group: 'danger',
      when: ({ facts }) => facts.stop !== null,
      confirm: ({ facts }) =>
        facts.stop === null
          ? null
          : {
              title: facts.stop.title,
              description: facts.stop.description,
              confirmLabel: facts.stop.label,
              role: 'danger',
            },
      run: ({ facts }) => facts.stop?.onStop(),
    },
  ],
};
