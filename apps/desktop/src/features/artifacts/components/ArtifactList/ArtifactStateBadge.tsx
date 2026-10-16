import { cn, tintClasses, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import type { ArtifactState } from '../../artifactStateOf';

type Props = {
  readonly state: ArtifactState;
};

export const ArtifactStateBadge = ({ state }: Props) => {
  const Icon = state.icon;
  const mark =
    state.key === 'new' ? (
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
    ) : (
      <Icon
        size={ICON_SIZE.row}
        aria-hidden
        className={cn('shrink-0', tintClasses(state.tone).text)}
      />
    );
  return (
    <Tooltip
      content={joinFacts({ facts: [stateDescription({ presentation: state }), state.detail] })}
    >
      <span
        data-testid="artifact-row-state"
        data-state={state.key}
        className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-label text-muted-foreground"
      >
        {mark}
        <span className="truncate">{state.label}</span>
      </span>
    </Tooltip>
  );
};
