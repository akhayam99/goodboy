import { cn, IconButton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { EXPLORE_FILE_KIND, type ExploreFileFacts } from '../../../actions/kinds/exploreFile';
import { resolveActions } from '../../../actions/resolveActions';
import type { ExploreFileActionTarget, ResolvedAction } from '../../../actions/types';
import type { RunRowActionParams } from '../../exploreHandlers';
import { ExploreSpawnPopover } from './ExploreSpawnPopover';

type Props = {
  readonly sessionId: SessionId;
  readonly target: ExploreFileActionTarget;
  readonly isAskOpen: boolean;
  readonly onRun: (params: RunRowActionParams) => void;
  readonly onAskClosed: () => void;
};

const ORDER: ReadonlyArray<string> = [
  'exploreFile.ask',
  'exploreFile.openInEditor',
  'exploreFile.reveal',
];

type AriaLabelParams = {
  readonly action: ResolvedAction;
  readonly facts: ExploreFileFacts;
};

const ariaLabelOf = ({ action, facts }: AriaLabelParams): string => {
  if (action.id === 'exploreFile.ask') {
    return `Ask an agent about ${facts.name}`;
  }
  if (action.id === 'exploreFile.reveal') {
    return `Show ${facts.name} in Finder`;
  }
  return facts.editorLabel === null
    ? `Open ${facts.name}`
    : `Open ${facts.name} in ${facts.editorLabel}`;
};

export const ExploreRowActions = ({ sessionId, target, isAskOpen, onRun, onAskClosed }: Props) => {
  const actions = resolveActions({ definitions: EXPLORE_FILE_KIND.actions, facts: target.facts })
    .filter((action) => action.slot === 'hover')
    .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

  return (
    <div
      data-slot="explore-row-actions"
      className={cn(
        'absolute inset-y-0 right-2 flex items-center gap-0.5 opacity-0 motion-safe:transition-opacity',
        'group-hover/explore-row:opacity-100 group-focus-within/explore-row:opacity-100',
        isAskOpen && 'opacity-100',
      )}
    >
      {actions.map((action) => {
        if (action.id === 'exploreFile.ask' && isAskOpen) {
          return (
            <ExploreSpawnPopover
              key={action.id}
              sessionId={sessionId}
              name={target.facts.name}
              relPath={target.facts.relPath}
              onClosed={onAskClosed}
            />
          );
        }
        return (
          <IconButton
            key={action.id}
            icon={action.icon}
            size="xs"
            label={ariaLabelOf({ action, facts: target.facts })}
            tooltip={action.shortLabel}
            onClick={() => onRun({ target, actionId: action.id })}
          />
        );
      })}
    </div>
  );
};
