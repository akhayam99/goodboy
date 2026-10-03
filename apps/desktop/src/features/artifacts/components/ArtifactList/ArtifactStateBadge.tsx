import { Chip, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import type { ArtifactState } from '../../artifactStateOf';

type Props = {
  readonly state: ArtifactState;
};

export const ArtifactStateBadge = ({ state }: Props) => {
  const Icon = state.icon;
  const mark =
    state.key === 'new' ? (
      <span aria-hidden className="mx-0.5 size-1.5 rounded-full bg-primary" />
    ) : (
      <Icon
        size={ICON_SIZE.control}
        aria-hidden
        className={cn('shrink-0', tintClasses(state.tone).text)}
      />
    );
  return (
    <span
      data-testid="artifact-row-state"
      data-state={state.key}
      title={stateDescription({ presentation: state })}
      className="flex min-w-0 items-center gap-1.5 text-label"
    >
      {state.tone === 'warning' ? (
        <Chip
          tone="warning"
          size="xs"
          bordered={false}
          icon={mark}
          label={state.label}
          className="shrink-0"
        />
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-muted-foreground">
          {mark}
          {state.label}
        </span>
      )}
      {state.detail === null ? null : (
        <span className="min-w-0 truncate text-secondary text-faint-foreground @max-[640px]:hidden">
          {state.detail}
        </span>
      )}
    </span>
  );
};
