import type { ProviderId, ProviderUsage, TurnEvent } from '@kay-am/types';
import { decodeAuthRequiredMessage } from '../../turn';

export type TranscriptItem =
  | { kind: 'assistant_text'; key: string; text: string }
  | {
      kind: 'tool_call';
      key: string;
      toolUseId: string;
      toolName: string;
      input: unknown;
      output: unknown;
      isError: boolean;
      ended: boolean;
    }
  | { kind: 'file_edit'; key: string; path: string; editType: 'create' | 'modify' | 'delete' }
  | { kind: 'usage'; key: string; usage: ProviderUsage }
  | { kind: 'error'; key: string; message: string }
  | { kind: 'auth_required'; key: string; providerId: ProviderId; identity: string | null }
  | { kind: 'skill_invocation'; key: string; skillName: string; args: ReadonlyArray<string> }
  | { kind: 'done'; key: string };

export function reduceTranscript(events: ReadonlyArray<TurnEvent>): ReadonlyArray<TranscriptItem> {
  const items: TranscriptItem[] = [];
  const callIndex = new Map<string, number>();
  let textBuffer = '';
  let textKey: string | null = null;

  const flushText = () => {
    if (textBuffer.length > 0 && textKey) {
      items.push({ kind: 'assistant_text', key: textKey, text: textBuffer });
    }
    textBuffer = '';
    textKey = null;
  };

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]!;
    if (event.kind === 'assistant_text') {
      if (textKey === null) textKey = `text-${i}`;
      textBuffer += event.delta;
      continue;
    }
    flushText();

    switch (event.kind) {
      case 'tool_call_start': {
        const key = `tool-${event.toolUseId}`;
        callIndex.set(event.toolUseId, items.length);
        items.push({
          kind: 'tool_call',
          key,
          toolUseId: event.toolUseId,
          toolName: event.toolName,
          input: event.input,
          output: null,
          isError: false,
          ended: false,
        });
        break;
      }
      case 'tool_call_end': {
        const idx = callIndex.get(event.toolUseId);
        if (idx !== undefined) {
          const existing = items[idx];
          if (existing && existing.kind === 'tool_call') {
            items[idx] = {
              ...existing,
              output: event.output,
              isError: event.isError,
              ended: true,
            };
          }
        }
        break;
      }
      case 'file_edit':
        items.push({
          kind: 'file_edit',
          key: `edit-${i}`,
          path: event.path,
          editType: event.editType,
        });
        break;
      case 'usage':
        items.push({ kind: 'usage', key: `usage-${i}`, usage: event.usage });
        break;
      case 'error': {
        const authPayload = decodeAuthRequiredMessage(event.message);
        if (authPayload) {
          items.push({
            kind: 'auth_required',
            key: `auth-${i}`,
            providerId: authPayload.providerId,
            identity: authPayload.identity,
          });
        } else {
          items.push({ kind: 'error', key: `error-${i}`, message: event.message });
        }
        break;
      }
      case 'skill_invocation':
        items.push({
          kind: 'skill_invocation',
          key: `skill-${i}`,
          skillName: event.skillName,
          args: event.args,
        });
        break;
      case 'done':
        items.push({ kind: 'done', key: `done-${i}` });
        break;
    }
  }

  flushText();
  return items;
}
