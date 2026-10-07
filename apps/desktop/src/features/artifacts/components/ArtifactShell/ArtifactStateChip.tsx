import { Chip, cn } from '@goodboy/ui';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ArtifactState } from '../../artifactStateOf';

type Props = {
  readonly state: ArtifactState | null;
  readonly isDetailCollapsible?: boolean;
};

export const ArtifactStateChip = ({ state, isDetailCollapsible = false }: Props) => {
  if (state === null) {
    return null;
  }
  const Icon = state.icon;
  return (
    <>
      <Chip
        tone={state.tone}
        size="xs"
        bordered={false}
        icon={<Icon size={ICON_SIZE.row} aria-hidden />}
        label={state.label}
        title={stateDescription({ presentation: state })}
        className="shrink-0"
        testId="artifact-state-chip"
      />
      {state.detail === null ? null : (
        <span
          data-testid="artifact-state-detail"
          className={cn(
            'shrink-0 text-meta text-faint-foreground',
            isDetailCollapsible && '@max-md:hidden',
          )}
        >
          {state.detail}
        </span>
      )}
    </>
  );
};
