import { MessagesSquare } from 'lucide-react';
import { Notice, SectionHeader } from '@goodboy/ui';
import { Block } from './Block';
import { DefinitionList } from './DefinitionList';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = Record<never, never>;

export const TurnsSection = ({}: Props) => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      size="page"
      icon={<MessagesSquare size={ICON_SIZE.control} aria-hidden className="text-info" />}
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

    <Notice
      tone="info"
      placement="inline"
      title="Turn count is a drift signal"
      body={`Providers bill per token across the whole conversation, not per turn. But "I've sent 14 turns and we still don't have a working build" tells you it is time to start a new session.`}
    />
  </div>
);
