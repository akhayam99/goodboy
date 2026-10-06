import type { Agent } from '@goodboy/types';
import { agentDisplayName } from '../../../../shared/utils/agentDisplayName';

export const TRANSCRIPT_DRAWER_COPY = {
  title: 'Transcript',
  fixRun: 'Fix run',
  gone: 'This agent is no longer in the session.',
  send: 'Send',
  sendFailed: "Couldn't send the message",
  replyLabel: ({ name }: { readonly name: string }) => `Message to ${name}`,
  replyPlaceholder: ({ name }: { readonly name: string }) => `Write to ${name}`,
} as const;

export const agentTranscriptTitle = ({
  agent,
}: {
  readonly agent: Pick<Agent, 'name' | 'kind'>;
}): string =>
  agent.kind === 'resolver'
    ? TRANSCRIPT_DRAWER_COPY.fixRun
    : agentDisplayName({ name: agent.name, kind: agent.kind ?? '' });
