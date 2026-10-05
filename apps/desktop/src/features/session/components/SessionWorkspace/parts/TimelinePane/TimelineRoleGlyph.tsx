import { Tooltip } from '@goodboy/ui';
import { AgentKindChip } from '../../../../../../shared/components/AgentKindChip';
import type { AgentKind } from '../../../../agent-kind';
import { ROW_CARD_REST_MS, type TimelineRowIdentity } from './timelineRowIdentity';

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
      <Tooltip
        variant="card"
        side="bottom"
        restDelayMs={ROW_CARD_REST_MS}
        isOpen={isCardOpen}
        content={identity.card}
      >
        <span data-testid="role-glyph" className="inline-flex shrink-0 self-center">
          <AgentKindChip kind={kind} density="glyph" isDecorative />
        </span>
      </Tooltip>
      {identity.summary === null ? null : <span className="sr-only">{identity.summary}</span>}
    </>
  );
};
