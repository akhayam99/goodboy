import { AlertTriangle } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { togglePane } from '../../session/panes/togglePane';
import type { ObjectKindDefinition, PaneClusterActionTarget } from '../types';

export type PaneClusterFacts = {
  readonly sessionId: SessionId;
  readonly hasContextFailed: boolean;
  readonly contextNote: string | null;
};

export const PANE_CLUSTER_KIND: ObjectKindDefinition<PaneClusterActionTarget, PaneClusterFacts> = {
  noun: 'panes',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'paneCluster.context',
      label: 'Context',
      icon: CONCEPT_ICONS.context,
      group: 'open',
      shortcut: 'lens.context',
      description: ({ facts }) => facts.contextNote,
      when: ({ facts }) => !facts.hasContextFailed,
      run: ({ facts }) => togglePane({ sessionId: facts.sessionId, pane: 'context' }),
    },
    {
      id: 'paneCluster.contextFailed',
      label: 'Context',
      icon: AlertTriangle,
      iconClassName: 'text-danger',
      group: 'open',
      shortcut: 'lens.context',
      description: ({ facts }) => facts.contextNote,
      when: ({ facts }) => facts.hasContextFailed,
      run: ({ facts }) => togglePane({ sessionId: facts.sessionId, pane: 'context' }),
    },
    {
      id: 'paneCluster.scripts',
      label: 'Scripts',
      icon: CONCEPT_ICONS.scripts,
      group: 'open',
      shortcut: 'lens.scripts',
      when: () => true,
      run: ({ facts }) => togglePane({ sessionId: facts.sessionId, pane: 'scripts' }),
    },
  ],
};
