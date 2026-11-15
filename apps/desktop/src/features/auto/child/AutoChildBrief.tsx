import type { MessageAttachment } from '@goodboy/types';
import { Chip } from '@goodboy/ui';
import { RoutingLabel } from '../../../shared/components/RoutingLabel';
import type { DelegationCardModel } from '../chat/delegationCardOf';
import type { ShownRouting } from '../executedRoutingOf';

type Props = {
  readonly card: DelegationCardModel;
  readonly routing: ShownRouting;
  readonly images: ReadonlyArray<MessageAttachment>;
  readonly attempts: number;
  readonly attemptsNote: string | null;
};

const AUTO_CHILD_LINE = 'Auto started this agent and reads your messages to it.';

export const AutoChildBrief = ({ card, routing, images, attempts, attemptsNote }: Props) => {
  const wentIn = card.wentIn ?? [];
  return (
    <section aria-label="Why Auto started it" className="flex min-w-0 flex-col gap-3 text-ui">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-muted-foreground">{AUTO_CHILD_LINE}</p>
        {card.reason === null ? null : (
          <p className="text-foreground">
            <span className="text-muted-foreground">Why Auto chose {card.roleLabel}: </span>
            {card.reason}
          </p>
        )}
        {card.roleKept === null ? null : (
          <p className="text-foreground">
            <span className="text-muted-foreground">Why not {card.roleKept.fitLabel}: </span>
            {card.roleKept.reason}
          </p>
        )}
        {card.doneWhen === null ? null : (
          <p data-auto-child-done-when="" className="text-foreground">
            <span className="text-muted-foreground">Done when: </span>
            {card.doneWhen}
          </p>
        )}
        {wentIn.length === 0 ? null : (
          <p data-auto-child-went-in="" className="text-foreground">
            <span className="text-muted-foreground">Went in: </span>
            {wentIn.map((item) => item.label).join(' · ')}
          </p>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="flex min-w-0 items-center gap-1 text-muted-foreground">
          <RoutingLabel
            provider={routing.provider}
            model={routing.model}
            effort={routing.effort}
            muted
          />
          {attempts > 1 ? <span data-auto-child-attempt="">{`· Attempt ${attempts}`}</span> : null}
        </p>
        {attempts > 1 && attemptsNote !== null ? (
          <p className="text-faint-foreground">{`Last attempt: ${attemptsNote}`}</p>
        ) : null}
        {card.routingNote === null ? null : (
          <p className="text-faint-foreground">{card.routingNote}</p>
        )}
        {images.length === 0 ? null : (
          <ul aria-label="Images Auto passed on" className="flex min-w-0 flex-wrap gap-1">
            {images.map((image) => (
              <li key={image.id}>
                <Chip tone="neutral" kind="reference" label={image.fileName} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
