import { Chip, cn, Tooltip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useSummarizerStatus } from '../../../../store';
import type { LensKind } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { SummarizerBadge } from '../SummarizerBadge';
import { withShortcutHint } from '../../../../shared/keyboard/registry';

type Props = {
  readonly sessionId: SessionId;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const ContextChip = ({ sessionId, onSelectLens }: Props) => {
  const { status } = useSummarizerStatus(sessionId);
  const isWorking = status === 'running';
  const tooltip = withShortcutHint({
    label: isWorking
      ? 'The summarizer is refreshing decisions and the session summary'
      : 'Decisions and session summary, kept fresh by the summarizer',
    shortcut: 'lens.context',
  });

  return (
    <span className="flex shrink-0 items-center gap-1">
      <Tooltip content={tooltip}>
        <Chip
          as="button"
          tone="neutral"
          shape="badge"
          size="control"
          onClick={() => onSelectLens('context')}
          icon={<CONCEPT_ICONS.context size={11} aria-hidden className="text-primary" />}
          label="Context"
          className={cn(isWorking && 'spin-border spin-border-primary')}
        />
      </Tooltip>
      {isWorking ? null : <SummarizerBadge sessionId={sessionId} />}
    </span>
  );
};
