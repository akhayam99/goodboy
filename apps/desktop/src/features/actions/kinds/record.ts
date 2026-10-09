import { ArrowUpRight, Hash, Link, PlayCircle, RefreshCw, Star } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openUrl } from '../../../shared/lib/editor';
import { startFromLabel } from '../../../shared/lib/startCopy';
import { sessionPlace } from '../../../store/slices/navigation/place';
import type { RecordVerb } from '../../../shared/components/StudioDetail/RecordActions/types';
import type { ActionDefinition, ObjectKindDefinition, RecordActionTarget } from '../types';

export type RecordFacts = {
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
  readonly providerLabel: string;
  readonly sessionId: SessionId | null;
  readonly isStarred: boolean | null;
  readonly onOpen: (() => void) | null;
  readonly launchLabel: string | null;
  readonly onLaunch: (() => void) | null;
  readonly onToggleStar: (() => void) | null;
  readonly onRefresh: (() => void) | null;
  readonly verbs: ReadonlyArray<RecordVerb>;
  readonly sessionVerbs: ReadonlyArray<RecordVerb>;
  readonly destructive: ReadonlyArray<RecordVerb>;
};

type VerbParams = {
  readonly verb: RecordVerb;
  readonly group: 'act' | 'danger';
};

const adaptVerb = ({ verb, group }: VerbParams): ActionDefinition<RecordFacts> => ({
  id: `record.verb.${verb.key}`,
  label: verb.label,
  icon: verb.icon,
  group,
  when: () => true,
  blockedReason: () => verb.blockedReason,
  isBusy: () => verb.isBusy,
  confirm: () =>
    verb.confirm === null
      ? group === 'danger'
        ? {
            title: `${verb.label}?`,
            description: 'This changes the record in its tool.',
            confirmLabel: verb.label,
            role: 'danger',
          }
        : null
      : {
          title: verb.confirm.title,
          description: verb.confirm.description,
          confirmLabel: verb.confirm.confirmLabel,
          role: group === 'danger' ? 'danger' : 'alert',
        },
  run: () => verb.onRun(),
});

export const RECORD_KIND: ObjectKindDefinition<RecordActionTarget, RecordFacts> = {
  noun: 'record',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'record.open',
      label: 'Open',
      icon: CONCEPT_ICONS.inbox,
      group: 'open',
      when: ({ facts }) => facts.onOpen !== null,
      run: ({ facts }) => facts.onOpen?.(),
    },
    {
      id: 'record.openSession',
      label: 'Open session',
      icon: CONCEPT_ICONS.sessions,
      group: 'open',
      when: ({ facts }) => facts.sessionId !== null,
      run: ({ facts, env }) => {
        if (facts.sessionId !== null) {
          env.getState().navigate({ to: sessionPlace({ sessionId: facts.sessionId }) });
        }
      },
    },
    {
      id: 'record.openInProvider',
      label: ({ facts }) => `Open in ${facts.providerLabel}`,
      icon: ArrowUpRight,
      group: 'open',
      when: ({ facts }) => facts.url !== '',
      run: ({ facts }) => openUrl(facts.url),
    },
    {
      id: 'record.launch',
      label: ({ facts }) => facts.launchLabel ?? startFromLabel({ identifier: facts.identifier }),
      icon: PlayCircle,
      group: 'act',
      when: ({ facts }) => facts.sessionId === null && facts.onLaunch !== null,
      run: ({ facts }) => facts.onLaunch?.(),
    },
    {
      id: 'record.star',
      label: ({ facts }) => (facts.isStarred === true ? 'Unstar' : 'Star'),
      icon: Star,
      group: 'act',
      when: ({ facts }) => facts.onToggleStar !== null && facts.isStarred !== null,
      run: ({ facts }) => facts.onToggleStar?.(),
    },
    {
      id: 'record.refresh',
      label: 'Refresh',
      icon: RefreshCw,
      group: 'act',
      when: ({ facts }) => facts.onRefresh !== null,
      run: ({ facts }) => facts.onRefresh?.(),
    },
    {
      id: 'record.copyLink',
      label: 'Copy link',
      icon: Link,
      group: 'copy',
      when: ({ facts }) => facts.url !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.url }),
    },
    {
      id: 'record.copyKey',
      label: ({ facts }) => `Copy ${facts.identifier}`,
      icon: Hash,
      group: 'copy',
      when: ({ facts }) => facts.identifier !== '',
      run: ({ facts, env }) => env.copyText({ text: facts.identifier }),
    },
  ],
  adapted: ({ facts }) => [
    ...facts.verbs.map((verb) => adaptVerb({ verb, group: 'act' })),
    ...facts.sessionVerbs.map((verb) => adaptVerb({ verb, group: 'act' })),
    ...facts.destructive.map((verb) => adaptVerb({ verb, group: 'danger' })),
  ],
};
