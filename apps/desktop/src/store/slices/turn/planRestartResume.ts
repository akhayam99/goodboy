import type { Agent, ProviderId, TurnEvent } from '@goodboy/types';

export const RESTART_RESUME_PROMPT =
  'Goodboy restarted while you were working on the last message, so your previous turn was cut off. Check the current state of the files and of any command you had started before you run it again, then carry on from where you stopped.';

const NATIVE_RESUME_PROVIDERS: ReadonlySet<ProviderId> = new Set([
  'anthropic',
  'opencode',
  'openrouter',
  'moonshot',
]);

export type RestartReason = 'restart' | 'update';

export type RestartResumePlan =
  | {
      readonly kind: 'resume';
      readonly mode: 'native' | 'history' | 'resend';
      readonly prompt: string;
      readonly note: string;
    }
  | { readonly kind: 'unresumable'; readonly reason: 'provider' | 'nothing-to-resume' };

type Params = {
  readonly agent: Agent;
  readonly provider: ProviderId;
  readonly isProviderConnected: boolean;
  readonly transcript: ReadonlyArray<TurnEvent>;
  readonly reason: RestartReason;
};

const lastUserText = ({ transcript }: Pick<Params, 'transcript'>): string | null => {
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const event = transcript[index];
    if (event?.kind === 'user_text' && event.text.trim() !== '') {
      return event.text;
    }
  }
  return null;
};

const cutToolCalls = ({
  transcript,
  runId,
}: Pick<Params, 'transcript'> & { readonly runId: string | undefined }): ReadonlyArray<string> => {
  if (runId === undefined) {
    return [];
  }
  const started = new Map<string, string>();
  for (const event of transcript) {
    if (event.kind === 'tool_call_start' && event.runId === runId) {
      started.set(event.toolUseId, event.toolName);
    }
    if (event.kind === 'tool_call_end' && event.runId === runId) {
      started.delete(event.toolUseId);
    }
  }
  return [...new Set(started.values())];
};

const leadFor = ({ reason }: Pick<Params, 'reason'>): string =>
  reason === 'update' ? 'Resumed after Goodboy updated.' : 'Resumed after Goodboy restarted.';

export const planRestartResume = ({
  agent,
  provider,
  isProviderConnected,
  transcript,
  reason,
}: Params): RestartResumePlan => {
  if (!isProviderConnected) {
    return { kind: 'unresumable', reason: 'provider' };
  }
  const original = lastUserText({ transcript });
  if (original === null) {
    return { kind: 'unresumable', reason: 'nothing-to-resume' };
  }
  const cut = cutToolCalls({ transcript, runId: agent.runId ?? undefined });
  const toolNote =
    cut.length === 0
      ? ''
      : ` ${cut.join(', ')} had not finished when it stopped. The agent was asked to check before running it again.`;
  const hasOwnSession =
    agent.providerSessionId !== undefined && agent.providerSessionProviderId === provider;
  if (NATIVE_RESUME_PROVIDERS.has(provider) && !hasOwnSession) {
    return {
      kind: 'resume',
      mode: 'resend',
      prompt: original,
      note: `${leadFor({ reason })} The interrupted message was sent again, because the provider had not started a session to resume.${toolNote}`,
    };
  }
  return {
    kind: 'resume',
    mode: NATIVE_RESUME_PROVIDERS.has(provider) ? 'native' : 'history',
    prompt: RESTART_RESUME_PROMPT,
    note: `${leadFor({ reason })}${toolNote}`,
  };
};
