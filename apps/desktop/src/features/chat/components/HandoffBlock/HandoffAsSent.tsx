import { useState } from 'react';
import { Code } from 'lucide-react';
import { CopyButton, Eyebrow, GhostActionButton, ScrollFade } from '@goodboy/ui';
import type { AgentHandoff } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { HandoffRawText } from './HandoffRawText';

type Props = {
  readonly handoff: AgentHandoff;
};

type PartProps = {
  readonly label: string;
  readonly text: string;
};

type CharactersParams = {
  readonly text: string;
};

const characters = ({ text }: CharactersParams): string =>
  `${text.length.toLocaleString('en-US')} characters`;

export const HandoffAsSent = ({ handoff }: Props) => {
  const [open, setOpen] = useState(false);
  const provider = PROVIDER_LABEL[handoff.provider];
  const parts: ReadonlyArray<PartProps> =
    handoff.sentSystem === null
      ? [{ label: 'Message', text: handoff.sentMessage }]
      : [
          { label: 'System prompt', text: handoff.sentSystem },
          { label: 'Message', text: handoff.sentMessage },
        ];
  const copied = parts.map((part) => part.text).join('\n\n');

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="handoff-as-sent">
      <div className="flex min-w-0 items-center gap-2">
        <GhostActionButton
          icon={Code}
          label={open ? `Hide text as sent to ${provider}` : `View as sent to ${provider}`}
          pressed={open}
          onClick={() => setOpen((value) => !value)}
        />
        {open ? <CopyButton value={copied} label="Copy text as sent" /> : null}
      </div>
      {open && handoff.sentSystem === null ? (
        <span className="px-2 text-2xs text-muted-foreground">
          {provider} has no separate system prompt, so scope, profile and role come first in the
          message.
        </span>
      ) : null}
      {open
        ? parts.map((part) => (
            <div key={part.label} className="flex min-w-0 flex-col gap-1 px-2">
              <Eyebrow label={`${part.label} · ${characters({ text: part.text })}`} />
              <ScrollFade className="max-h-80 rounded-md bg-subtle" viewportClassName="p-3">
                <HandoffRawText text={part.text} />
              </ScrollFade>
            </div>
          ))
        : null}
    </div>
  );
};
