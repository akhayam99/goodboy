import { Button, cn, tintClasses } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, agentPlace } from '../../../../store';
import type { LensKind } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { describeSessionStage } from '../../session-stage';
import { isAttentionCalloutShown, type SessionAttention } from './lib';

type Props = {
  readonly sessionId: SessionId;
  readonly attention: SessionAttention;
  readonly onSelectLens: (lens: LensKind) => void;
  readonly isQuestionShownBelow?: boolean;
};

export const AttentionCallout = ({
  sessionId,
  attention,
  onSelectLens,
  isQuestionShownBelow = false,
}: Props) => {
  const navigate = useAppStore((s) => s.navigate);
  const { stage, target } = attention;

  if (target === null || !isAttentionCalloutShown({ attention, isQuestionShownBelow })) {
    return null;
  }

  const presentation = describeSessionStage(stage);
  const tint = tintClasses(presentation.tone);
  const Icon = presentation.icon;

  const open = () => {
    if (target.kind === 'lens') {
      onSelectLens(target.lens);
      return;
    }
    navigate({ to: agentPlace({ sessionId, agentId: target.agentId }) });
  };

  return (
    <section
      aria-label="Needs you"
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md border p-2.5',
        tint.borderSoft,
        tint.bg,
      )}
    >
      <Icon size={ICON_SIZE.control} aria-hidden className={cn('shrink-0', tint.icon)} />
      <p className="min-w-0 flex-1 text-label text-foreground">
        <span className="font-medium">Needs you</span>
        <span className="text-muted-foreground">{`: ${presentation.reason}`}</span>
      </p>
      <Button variant="secondary" size="sm" onClick={open}>
        {target.label}
      </Button>
    </section>
  );
};
