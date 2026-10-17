import type { MessageAttachment } from '@goodboy/types';
import { Chip, formatUsd } from '@goodboy/ui';
import { RoutingLabel } from '../../../shared/components/RoutingLabel';
import type { DelegationCardModel } from '../chat/delegationCardOf';
import type { ShownRouting } from '../executedRoutingOf';

type Props = {
  readonly card: DelegationCardModel;
  readonly routing: ShownRouting;
  readonly images: ReadonlyArray<MessageAttachment>;
};

export const AutoChildBrief = ({ card, routing, images }: Props) => (
  <section aria-label="Why Auto started it" className="flex min-w-0 flex-col gap-1 text-ui">
    {card.reason === null ? null : (
      <p className="text-foreground">
        <span className="text-muted-foreground">Why Auto chose {card.roleLabel}: </span>
        {card.reason}
      </p>
    )}
    <p className="flex min-w-0 items-center text-muted-foreground">
      <RoutingLabel
        provider={routing.provider}
        model={routing.model}
        effort={routing.effort}
        muted
      />
      {card.isOpen && card.ceilingUsd !== null ? (
        <span className="shrink-0 whitespace-pre tabular-nums">
          {` · Reserved up to ${formatUsd(card.ceilingUsd)}`}
        </span>
      ) : null}
    </p>
    {card.routingNote === null ? null : <p className="text-faint-foreground">{card.routingNote}</p>}
    {images.length === 0 ? null : (
      <ul aria-label="Images Auto passed on" className="flex min-w-0 flex-wrap gap-1">
        {images.map((image) => (
          <li key={image.id}>
            <Chip tone="neutral" kind="reference" label={image.fileName} />
          </li>
        ))}
      </ul>
    )}
  </section>
);
