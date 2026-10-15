import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { RoutingLabel } from '../../../shared/components/RoutingLabel';
import { ArtifactLinkRow, type ArtifactLinkModel } from './ArtifactLinkRow';
import { cardTitleOf } from './cardTitleOf';
import { DelegationCardFooter } from './DelegationCardFooter';
import { DelegationClock } from './DelegationClock';
import { DelegationConfirmRow } from './DelegationConfirmRow';
import type { DelegationCardModel } from './delegationCardOf';
import { DelegationResult } from './DelegationResult';
import { DelegationStatusChip } from './DelegationStatusChip';

type Props = {
  readonly card: DelegationCardModel;
  readonly links: ReadonlyArray<ArtifactLinkModel>;
  readonly onOpenChat: (card: DelegationCardModel) => void;
  readonly onOpenArtifact: (artifactId: string) => void;
  readonly confirm?: DelegationConfirm;
};

type DelegationConfirm = Readonly<{
  line: string;
  isBusy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}>;

export const DelegationCard = ({ card, links, onOpenChat, onOpenArtifact, confirm }: Props) => (
  <article
    aria-label={`${cardTitleOf({ card })} delegation`}
    data-delegation-id={card.delegationId}
    className="flex min-w-0 flex-col gap-2 rounded-lg border border-border-soft px-4 py-3 bg-subtle"
  >
    <header className="flex min-w-0 items-center gap-2">
      <AgentKindChip kind={card.role} density="glyph" isDecorative />
      <span className="min-w-0 truncate text-row text-foreground">{cardTitleOf({ card })}</span>
      <RoutingLabel provider={card.provider} model={card.model} effort={card.effort} />
      <span aria-hidden className="min-w-0 flex-1" />
      <DelegationClock
        startedAtMs={card.startedAtMs}
        endedAtMs={card.endedAtMs}
        isLive={card.status.isLive}
      />
      <DelegationStatusChip status={card.status} />
    </header>
    {card.reason === null ? null : (
      <p className="text-label text-muted-foreground">{card.reason}</p>
    )}
    {card.routingNote === null ? null : (
      <p className="text-meta text-faint-foreground">{card.routingNote}</p>
    )}
    {card.result === null ? null : <DelegationResult result={card.result} />}
    {links.map((link) => (
      <ArtifactLinkRow key={link.artifactId} link={link} onOpen={onOpenArtifact} />
    ))}
    {confirm === undefined ? null : <DelegationConfirmRow {...confirm} />}
    <DelegationCardFooter card={card} onOpenChat={onOpenChat} />
  </article>
);
