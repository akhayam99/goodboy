import { Coins } from 'lucide-react';
import { Block } from './Block';
import { DefinitionList } from './DefinitionList';
import { SectionHeader } from './SectionHeader';
import { Tile } from './Tile';

type Props = Record<never, never>;

export const TokensSection = ({}: Props) => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      icon={<Coins size={14} aria-hidden className="text-warning" />}
      title="Tokens & cost"
      description="Every message, yours and the assistant's, is converted into tokens before billing. Roughly 1 token is about three quarters of an English word."
      tone="warning"
    />

    <Block title="Input vs output">
      <DefinitionList
        rows={[
          {
            term: 'input tokens',
            desc: 'Everything sent into the model: system prompt, conversation history, tool results, your latest message. Grows every turn, which is why later turns cost more even when your message is short.',
          },
          {
            term: 'cached input tokens',
            desc: 'Portions of the prompt the provider can reuse from a recent call. Billed at a fraction of the input rate when the provider supports prompt caching.',
          },
          {
            term: 'output tokens',
            desc: 'What the model writes back: text plus tool calls. The most expensive category, several times the input rate.',
          },
        ]}
      />
    </Block>

    <Block title="Context window">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Each model has a hard ceiling on how many tokens fit in one call. The bar under each agent
        shows how full the current context is. Past roughly 75% the agent starts forgetting;
        consider summarizing or starting a new session.
      </p>
    </Block>

    <Block title="Cost colors">
      <div className="grid grid-cols-3 gap-3">
        <Tile tone="success" label="Cheap" mono>
          The lowest tier of each provider.
          <br />
          Good for grep-heavy and planning steps.
        </Tile>
        <Tile tone="warning" label="Mid" mono>
          The mid tier.
          <br />
          Default for most coding work.
        </Tile>
        <Tile tone="danger" label="Premium" mono>
          The top tier.
          <br />
          Reserve for hard reasoning, refactors, last-resort fixes.
        </Tile>
      </div>
      <p className="mt-3 text-2xs leading-relaxed text-muted-foreground/70">
        The picker sorts <strong className="font-semibold text-foreground">cheapest first</strong>{' '}
        on purpose. Switching down a tier often costs nothing in quality on routine tasks.
      </p>
    </Block>
  </div>
);
