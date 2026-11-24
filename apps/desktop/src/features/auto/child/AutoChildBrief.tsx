import type { MessageAttachment } from '@goodboy/types';
import { isProviderId } from '@goodboy/types/helpers';
import { Chip } from '@goodboy/ui';
import { RoutingLabel } from '../../../shared/components/RoutingLabel';
import { NAMES } from '../../../shared/utils/names';
import { modelLineOf } from '../../providers/modelLine/modelLineOf';
import { PROVIDER_LABEL } from '../../providers/providerLabel';
import type { DelegationCardModel } from '../chat/delegationCardOf';
import type { LaunchSnapshotItem } from '../chat/launchSnapshotOf';
import type { ShownRouting } from '../executedRoutingOf';
import { AutoChildWentIn } from './AutoChildWentIn';
import { RoutingWhy } from './RoutingWhy';

type Props = {
  readonly card: DelegationCardModel;
  readonly routing: ShownRouting;
  readonly images: ReadonlyArray<MessageAttachment>;
  readonly wentIn: ReadonlyArray<LaunchSnapshotItem> | null;
  readonly attempts: number;
  readonly attemptsNote: string | null;
};

const THE_LEAD = `the ${NAMES.lead}`;

const AUTO_CHILD_LINE = `The ${NAMES.lead} started this agent and reads your messages to it.`;

export const AutoChildBrief = ({
  card,
  routing,
  images,
  wentIn,
  attempts,
  attemptsNote,
}: Props) => {
  const shownImages = wentIn === null ? images : [];
  const providerName =
    routing.provider !== null && isProviderId(routing.provider)
      ? PROVIDER_LABEL[routing.provider]
      : undefined;
  const shownName = modelLineOf({
    provider: routing.provider,
    model: routing.model,
    effort: null,
  })?.name;
  const isStoredPickShown =
    routing.provider === card.provider && shownName === card.modelLine?.name;
  const shownWhy = isStoredPickShown ? card.routingWhy : null;
  return (
    <section
      aria-label={`Why ${THE_LEAD} started it`}
      className="flex min-w-0 flex-col gap-3 text-ui"
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-muted-foreground">{AUTO_CHILD_LINE}</p>
        {card.reason === null ? null : (
          <p className="text-foreground">
            <span className="text-muted-foreground">{`Why ${THE_LEAD} chose ${card.roleLabel}: `}</span>
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
        {wentIn === null ? null : <AutoChildWentIn items={wentIn} />}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="flex min-w-0 items-center gap-1 text-muted-foreground">
          <RoutingLabel
            provider={routing.provider}
            model={routing.model}
            effort={routing.effort}
            prefix={providerName}
            muted
          />
          {card.stepWord === null ? null : (
            <span data-auto-child-step="">{`· ${card.stepWord}`}</span>
          )}
          {attempts > 1 ? <span data-auto-child-attempt="">{`· Attempt ${attempts}`}</span> : null}
        </p>
        {attempts > 1 && attemptsNote !== null ? (
          <p className="text-faint-foreground">{`Last attempt: ${attemptsNote}`}</p>
        ) : null}
        {shownWhy === null ? null : <RoutingWhy why={shownWhy} />}
        {shownWhy !== null || card.routingNote === null ? null : (
          <p className="text-faint-foreground">{card.routingNote}</p>
        )}
        {shownImages.length === 0 ? null : (
          <ul aria-label={`Images ${THE_LEAD} passed on`} className="flex min-w-0 flex-wrap gap-1">
            {shownImages.map((image) => (
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
