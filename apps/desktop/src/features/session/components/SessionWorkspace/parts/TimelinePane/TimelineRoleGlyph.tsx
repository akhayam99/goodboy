import { cn } from '@goodboy/ui';
import { AgentKindChip } from '../../../../../../shared/components/AgentKindChip';
import type { AgentKind } from '../../../../agent-kind';
import type { TimelineRowIdentity } from './timelineRowIdentity';

type Props = {
  readonly kind: AgentKind;
  readonly identity: TimelineRowIdentity | null;
  readonly isCardOpen: boolean;
  readonly className?: string;
};

export const TimelineRoleGlyph = ({ kind, identity, isCardOpen, className }: Props) => {
  if (identity === null) {
    return <AgentKindChip kind={kind} density="bare" className={cn('self-center', className)} />;
  }
  return (
    <>
      {identity.wrapCard({
        isOpen: isCardOpen,
        children: (
          <span
            data-testid="role-glyph"
            role={identity.roleLabel === null ? undefined : 'img'}
            aria-label={identity.roleLabel ?? undefined}
            className="inline-flex shrink-0 self-center"
          >
            <AgentKindChip kind={kind} density="bare" isDecorative className={className} />
          </span>
        ),
      })}
      {identity.summary === null ? null : <span className="sr-only">{identity.summary}</span>}
    </>
  );
};
