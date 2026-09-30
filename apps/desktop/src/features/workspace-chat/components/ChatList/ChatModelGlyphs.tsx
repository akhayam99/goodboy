import { Tooltip } from '@goodboy/ui';
import type { ChatModelUsed, ProviderId } from '@goodboy/types';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { chatModelLabel } from '../../chatModelLabel';

type Props = {
  readonly models: ReadonlyArray<ChatModelUsed>;
};

const GLYPH_SIZE = 11;

const distinctProviders = (models: ReadonlyArray<ChatModelUsed>): ReadonlyArray<ProviderId> => [
  ...new Set(models.map((entry) => entry.provider)),
];

export const ChatModelGlyphs = ({ models }: Props) => {
  if (models.length < 2) {
    return null;
  }
  const labels = models.map((entry) =>
    chatModelLabel({ provider: entry.provider, model: entry.model }),
  );
  return (
    <Tooltip content={labels.join(', ')} anchorClassName="shrink-0">
      <span
        role="img"
        aria-label={labels.join(', ')}
        className="pointer-events-auto flex shrink-0 items-center gap-0.5"
      >
        {distinctProviders(models).map((provider) => (
          <ProviderGlyph key={provider} id={provider} size={GLYPH_SIZE} />
        ))}
      </span>
    </Tooltip>
  );
};
