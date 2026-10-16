import type { Agent } from '@goodboy/types';

export const TRANSCRIPT_DRAWER_COPY = {
  title: 'Transcript',
  fixRun: 'Fix run',
  tabsLabel: 'Fix run views',
  leadTab: 'Fix',
  transcriptTab: 'Transcript',
  leadDot: 'Question waiting',
  transcriptDot: 'New activity',
  gone: 'This agent is no longer in the session.',
  send: 'Send',
  sendFailed: "Couldn't send the message",
  replyLabel: ({ name }: { readonly name: string }) => `Message to ${name}`,
  replyPlaceholder: ({ name }: { readonly name: string }) => `Message ${name}`,
} as const;

export const agentTranscriptTitle = ({
  agent,
}: {
  readonly agent: Pick<Agent, 'name' | 'kind'>;
}): string =>
  agent.kind === 'resolver' ? TRANSCRIPT_DRAWER_COPY.fixRun : TRANSCRIPT_DRAWER_COPY.title;
