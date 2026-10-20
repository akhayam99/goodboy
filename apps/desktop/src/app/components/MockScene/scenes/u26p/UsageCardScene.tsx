import { useEffect } from 'react';
import { Popover } from '@goodboy/ui';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { TurnFooterDetail } from '../../../../../features/chat/components/TurnFooter/TurnFooterDetail';
import { USAGE_CARD_MAX_WIDTH } from '../../../../../features/chat/utils/usageCardMaxWidth';
import type { TurnFooterData } from '../../../../../features/chat/components/TurnFooter/useTurnFooter';

type Theme = 'dark' | 'light';

type Props = {
  readonly theme: Theme;
};

type Card = {
  readonly id: string;
  readonly data: TurnFooterData;
  readonly duration: string | null;
  readonly turns: number | null;
};

const FULL: TurnFooterData = {
  provider: 'anthropic',
  model: 'claude-opus-5-5',
  effort: 'high',
  inputTokens: 4200,
  outputTokens: 3180,
  cachedInputTokens: 86400,
  cacheCreationInputTokens: 9100,
  contextTokens: 12400,
  estimatedCostUsd: 0.07,
};

const NO_CACHE: TurnFooterData = {
  ...FULL,
  provider: 'openai',
  model: 'gpt-6',
  effort: null,
  inputTokens: 5200,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  contextTokens: null,
  estimatedCostUsd: null,
};

const NO_USAGE: TurnFooterData = {
  ...FULL,
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationInputTokens: 0,
  contextTokens: null,
  estimatedCostUsd: null,
};

const LONG_TITLE: TurnFooterData = {
  ...FULL,
  model: 'claude-opus-5-5-extended-context-preview-for-long-running-agents',
  effort: 'extra high',
};

const CARDS: ReadonlyArray<Card> = [
  { id: 'full', data: FULL, duration: '42s', turns: 3 },
  { id: 'no-cache', data: NO_CACHE, duration: null, turns: null },
  { id: 'no-usage', data: NO_USAGE, duration: null, turns: null },
  { id: 'long-title', data: LONG_TITLE, duration: null, turns: null },
];

export const UsageCardScene = ({ theme }: Props) => {
  useEffect(() => {
    applyDocumentTheme({ theme });
  }, [theme]);
  return (
    <main className="flex h-screen w-screen flex-wrap content-start items-start gap-6 bg-background p-10 text-foreground">
      {CARDS.map((card) => (
        <Popover
          key={card.id}
          role="dialog"
          ariaLabel={`Usage detail ${card.id}`}
          className="w-max"
          style={{ maxWidth: USAGE_CARD_MAX_WIDTH }}
        >
          <TurnFooterDetail
            data={card.data}
            duration={card.duration}
            startedAt={null}
            endedAt={null}
            turns={card.turns}
          />
        </Popover>
      ))}
    </main>
  );
};

export const U26P_USAGE_CARD_SCENES = {
  'p20-usage-card-dark': () => <UsageCardScene theme="dark" />,
  'p20-usage-card-light': () => <UsageCardScene theme="light" />,
};
