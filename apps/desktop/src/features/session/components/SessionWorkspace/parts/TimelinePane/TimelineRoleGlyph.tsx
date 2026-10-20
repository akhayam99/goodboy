import { AgentKindChip } from '../../../../../../shared/components/AgentKindChip';
import type { AgentKind } from '../../../../agent-kind';
import type { TimelineRowIdentity } from './timelineRowIdentity';

type Props = {
  readonly kind: AgentKind;
  readonly identity: TimelineRowIdentity | null;
  readonly isCardOpen: boolean;
};

export const TimelineRoleGlyph = ({ kind, identity, isCardOpen }: Props) => {
  if (identity === null) {
    return <AgentKindChip kind={kind} density="glyph" className="self-center" />;
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
            <AgentKindChip kind={kind} density="glyph" isDecorative />
          </span>
        ),
      })}
      {identity.summary === null ? null : <span className="sr-only">{identity.summary}</span>}
    </>
  );
};
