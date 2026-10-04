import { Tooltip } from '@goodboy/ui';
import type { ChatModelUsed, EffortLevel, ProviderId } from '@goodboy/types';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { pluralize } from '../../../../shared/utils/pluralize';
import { chatAnswerMeta } from '../../chatAnswerMeta';
import { chatModelLabel } from '../../chatModelLabel';

type Props = {
  readonly models: ReadonlyArray<ChatModelUsed>;
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel | null;
  readonly messageCount: number;
};

const GLYPH_SIZE = 11;

type ProvidersParams = {
  readonly models: ReadonlyArray<ChatModelUsed>;
  readonly provider: ProviderId;
};

const glyphProviders = ({ models, provider }: ProvidersParams): ReadonlyArray<ProviderId> => [
  ...new Set([...models.map((entry) => entry.provider), provider]),
];

export const ChatModelGlyphs = ({ models, provider, model, effort, messageCount }: Props) => {
  const current = chatAnswerMeta({ message: { provider, model, effort } }) ?? model;
  const others = models
    .filter((entry) => entry.provider !== provider || entry.model !== model)
    .map((entry) => chatModelLabel({ provider: entry.provider, model: entry.model }));
  const description = [
    current,
    ...(others.length === 0 ? [] : [`Also used ${others.join(', ')}`]),
    ...(messageCount === 0 ? [] : [pluralize(messageCount, 'message')]),
  ].join(' · ');
  return (
    <Tooltip content={description} anchorClassName="shrink-0">
      <span
        role="img"
        aria-label={description}
        className="pointer-events-auto flex shrink-0 items-center gap-1 text-meta text-muted-foreground"
      >
        <span className="flex items-center gap-0.5 text-faint-foreground">
          {glyphProviders({ models, provider }).map((id) => (
            <ProviderGlyph key={id} id={id} size={GLYPH_SIZE} />
          ))}
        </span>
        <span
          data-chat-model-name
          className="hidden whitespace-nowrap @min-[19rem]/chat-list:inline"
        >
          {current}
        </span>
      </span>
    </Tooltip>
  );
};
