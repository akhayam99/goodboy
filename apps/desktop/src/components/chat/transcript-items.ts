import type {
  IsoDateTime,
  PermissionRuleId,
  ProviderId,
  ProviderRunId,
  ProviderUsage,
  TurnEvent,
} from '@kay-am/types';
import { decodeAuthRequiredMessage } from '../../turn';

export type TranscriptItem =
  | { kind: 'user_text'; key: string; text: string }
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
  | {
      kind: 'step_transition';
      key: string;
      fromStep: { ordinal: number; name: string };
      toStep: { ordinal: number; name: string };
      carryForwardContext: string;
      at: string;
    }
  | { kind: 'done'; key: string }
  | {
      kind: 'permission_request';
      key: string;
      toolUseId: string;
      toolName: string;
      input: unknown;
      at: IsoDateTime;
    }
  | {
      kind: 'permission_decision';
      key: string;
      toolUseId: string;
      decision: 'allow' | 'deny';
      ruleId: PermissionRuleId | null;
      decidedBy: 'engine' | 'user' | 'default';
      at: IsoDateTime;
    };

/**
 * Returns distinct runIds from events, excluding the sentinel 'history' value
 * used for messages loaded from the DB. Two or more runIds indicates a parallel
 * phase group is active — the caller decides whether to show split-view.
 */
export function detectParallelRunIds(
  events: ReadonlyArray<TurnEvent>,
): ReadonlyArray<ProviderRunId> {
  const seen = new Set<ProviderRunId>();
  for (const event of events) {
    if (event.runId !== ('history' as ProviderRunId)) {
      seen.add(event.runId);
    }
  }
  return seen.size > 1 ? [...seen] : [];
}

export function filterEventsByRunId(
  events: ReadonlyArray<TurnEvent>,
  runId: ProviderRunId,
): ReadonlyArray<TurnEvent> {
  return events.filter((e) => e.runId === runId);
}

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
      case 'user_text':
        items.push({ kind: 'user_text', key: `user-${i}`, text: event.text });
        break;
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
      case 'step_transition':
        items.push({
          kind: 'step_transition',
          key: `phase-${i}`,
          fromStep: event.fromStep,
          toStep: event.toStep,
          carryForwardContext: event.carryForwardContext,
          at: event.at,
        });
        break;
      case 'done':
        items.push({ kind: 'done', key: `done-${i}` });
        break;
      case 'permission_request':
        items.push({
          kind: 'permission_request',
          key: `perm-req-${event.toolUseId}-${i}`,
          toolUseId: event.toolUseId,
          toolName: event.toolName,
          input: event.input,
          at: event.at,
        });
        break;
      case 'permission_decision':
        items.push({
          kind: 'permission_decision',
          key: `perm-dec-${event.toolUseId}-${i}`,
          toolUseId: event.toolUseId,
          decision: event.decision,
          ruleId: event.ruleId,
          decidedBy: event.decidedBy,
          at: event.at,
        });
        break;
    }
  }

  flushText();
  return items;
}
