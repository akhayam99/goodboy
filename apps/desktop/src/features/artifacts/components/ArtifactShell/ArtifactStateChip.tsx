import { Chip } from '@goodboy/ui';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ArtifactState } from '../../artifactStateOf';

type Props = {
  readonly state: ArtifactState | null;
};

export const ArtifactStateChip = ({ state }: Props) => {
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
          className="shrink-0 text-secondary text-faint-foreground"
        >
          {state.detail}
        </span>
      )}
    </>
  );
};
