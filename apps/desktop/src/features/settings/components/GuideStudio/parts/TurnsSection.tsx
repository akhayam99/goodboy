import { Lightbulb, MessagesSquare } from 'lucide-react';
import { SectionHeader } from '@goodboy/ui';
import { Block } from './Block';
import { Callout } from './Callout';
import { DefinitionList } from './DefinitionList';

type Props = Record<never, never>;

export const TurnsSection = ({}: Props) => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      size="page"
      icon={<MessagesSquare size={14} aria-hidden className="text-info" />}
      label="Turns"
      hint="One user message plus the assistant's full response, which may include many tool calls and edits."
    />

    <Block title="How turns are counted">
      <DefinitionList
        rows={[
          {
            term: 'user to assistant',
            desc: 'Each user message you send is one turn. The count in the chat header reflects that.',
          },
          {
            term: 'tools inside a turn',
            desc: 'When the agent calls grep, edit, run, etc., those are part of the same turn, not separate ones.',
          },
          {
            term: 'queueing',
            desc: 'While a turn is running you can still type. Hitting send queues the message and it fires automatically when the current turn ends.',
          },
        ]}
      />
    </Block>

    <Callout tone="info" icon={<Lightbulb size={13} />}>
      Providers bill per token across the whole conversation, not per turn. But from a builder
      angle, "I've sent 14 turns and we still don't have a working build" is a useful drift signal:
      time to start a new session.
    </Callout>
  </div>
);
