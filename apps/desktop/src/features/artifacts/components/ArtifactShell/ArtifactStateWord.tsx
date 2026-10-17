import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ArtifactState } from '../../artifactStateOf';

type Props = {
  readonly state: ArtifactState | null;
};

export const ArtifactStateWord = ({ state }: Props) => {
  if (state === null) {
    return null;
  }
  const Icon = state.icon;
  return (
    <Tooltip content={stateDescription({ presentation: state })}>
      <span
        data-testid="artifact-state-word"
        className="inline-flex shrink-0 items-center gap-1 text-muted-foreground"
      >
        <Icon size={ICON_SIZE.row} aria-hidden className={cn(tintClasses(state.tone).text)} />
        {state.label}
      </span>
    </Tooltip>
  );
};
