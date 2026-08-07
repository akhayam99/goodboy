import type {
  IsoDateTime,
  MessageAttachment,
  PermissionRuleId,
  PermissionScope,
  ProviderId,
  ProviderRunId,
  ProviderUsage,
  TurnEvent,
} from '@goodboy/types';
import { isOpenQuestionAnswerText } from '@goodboy/core';
import { decodeAuthRequiredMessage } from '../turn';
import { isWorkflowKickoff, parseWorkflowKickoff } from './parse-workflow-kickoff';
import { parseResolverKickoff, type ResolverKickoffThread } from './parse-resolver-kickoff';

export type TranscriptItem =
  | {
      kind: 'user_text';
      key: string;
      text: string;
      attachments?: ReadonlyArray<MessageAttachment>;
      provider?: ProviderId;
      model?: string;
      at: IsoDateTime;
    }
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
  | {
      kind: 'error';
      key: string;
      message: string;
      runId?: ProviderRunId;
      retryable?: boolean;
    }
  | { kind: 'auth_required'; key: string; providerId: ProviderId; identity: string | null }
  | { kind: 'skill_invocation'; key: string; skillName: string; args: ReadonlyArray<string> }
  | {
      kind: 'step_transition';
      key: string;
      fromStep: { ordinal: number; name: string };
      toStep: { ordinal: number; name: string };
      carryForwardContext: string;
      degraded?: true;
      durationMs?: number;
      at: string;
    }
  | {
      kind: 'orchestrator_decision';
      key: string;
      action: 'next' | 'done' | 'blocked';
      reason: string;
      stepName?: string;
      operatorNote?: string;
      at: IsoDateTime;
    }
  | {
      kind: 'workflow_kickoff';
      key: string;
      goal: string;
      instructions: string;
      marker: string;
      raw: string;
      parsed: boolean;
      at: IsoDateTime;
    }
  | {
      kind: 'resolver_kickoff';
      key: string;
      headline: string;
      threads: ReadonlyArray<ResolverKickoffThread>;
      raw: string;
      at: IsoDateTime;
    }
  | { kind: 'oq_answer'; key: string }
  | { kind: 'done'; key: string }
  | {
      kind: 'permission_request';
      key: string;
      toolUseId: string;
      toolName: string;
      runId: ProviderRunId;
      input: unknown;
      at: IsoDateTime;
    }
  | {
      kind: 'permission_decision';
      key: string;
      toolUseId: string;
      toolName: string;
      runId: ProviderRunId;
      decision: 'allow' | 'deny';
      scope?: PermissionScope;
      ruleId: PermissionRuleId | null;
      decidedBy: 'engine' | 'user' | 'default';
      at: IsoDateTime;
    };

export const detectParallelRunIds = (
  events: ReadonlyArray<TurnEvent>,
): ReadonlyArray<ProviderRunId> => {
  const seen = new Set<ProviderRunId>();
  for (const event of events) {
    if (event.runId !== ('history' as ProviderRunId)) {
      seen.add(event.runId);
    }
  }
  return seen.size > 1 ? [...seen] : [];
};

export const filterEventsByRunId = (
  events: ReadonlyArray<TurnEvent>,
  runId: ProviderRunId,
): ReadonlyArray<TurnEvent> => {
  return events.filter((e) => e.runId === runId);
};

export const reduceTranscript = (
  events: ReadonlyArray<TurnEvent>,
): ReadonlyArray<TranscriptItem> => {
  const items: TranscriptItem[] = [];
  const callIndex = new Map<string, number>();
  const permToolNames = new Map<string, string>();
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
      if (textKey === null) {
        textKey = `text-${i}`;
      }
      textBuffer += event.delta;
      continue;
    }
    flushText();

    switch (event.kind) {
      case 'user_text':
        if (isOpenQuestionAnswerText(event.text)) {
          items.push({ kind: 'oq_answer', key: `oq-answer-${i}` });
          break;
        }
        {
          const resolverKickoff = parseResolverKickoff({ text: event.text });
          if (resolverKickoff !== null) {
            items.push({
              kind: 'resolver_kickoff',
              key: `resolver-kickoff-${i}`,
              headline: resolverKickoff.headline,
              threads: resolverKickoff.threads,
              raw: event.text,
              at: event.at,
            });
            break;
          }
        }
        if (isWorkflowKickoff(event.text)) {
          const parsed = parseWorkflowKickoff(event.text);
          items.push({
            kind: 'workflow_kickoff',
            key: `kickoff-${i}`,
            goal: parsed.goal,
            instructions: parsed.instructions,
            marker: parsed.marker,
            raw: event.text,
            parsed: parsed.parsed,
            at: event.at,
          });
          break;
        }
        items.push({
          kind: 'user_text',
          key: `user-${i}`,
          text: event.text,
          ...(event.attachments && event.attachments.length > 0
            ? { attachments: event.attachments }
            : {}),
          ...(event.provider ? { provider: event.provider } : {}),
          ...(event.model ? { model: event.model } : {}),
          at: event.at,
        });
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
          items.push({
            kind: 'error',
            key: `error-${i}`,
            message: event.message,
            runId: event.runId,
            retryable: event.retryable,
          });
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
          degraded: event.degraded,
          durationMs: event.durationMs,
          at: event.at,
        });
        break;
      case 'orchestrator_decision':
        items.push({
          kind: 'orchestrator_decision',
          key: `orchestrator-${i}`,
          action: event.action,
          reason: event.reason,
          ...(event.stepName != null && { stepName: event.stepName }),
          ...(event.operatorNote != null &&
            event.operatorNote !== '' && { operatorNote: event.operatorNote }),
          at: event.at,
        });
        break;
      case 'done':
        items.push({ kind: 'done', key: `done-${i}` });
        break;
      case 'permission_request':
        permToolNames.set(event.toolUseId, event.toolName);
        items.push({
          kind: 'permission_request',
          key: `perm-req-${event.toolUseId}-${i}`,
          toolUseId: event.toolUseId,
          toolName: event.toolName,
          runId: event.runId,
          input: event.input,
          at: event.at,
        });
        break;
      case 'permission_decision':
        items.push({
          kind: 'permission_decision',
          key: `perm-dec-${event.toolUseId}-${i}`,
          toolUseId: event.toolUseId,
          toolName: permToolNames.get(event.toolUseId) ?? event.toolUseId,
          runId: event.runId,
          decision: event.decision,
          ...(event.scope !== undefined && { scope: event.scope }),
          ruleId: event.ruleId,
          decidedBy: event.decidedBy,
          at: event.at,
        });
        break;
    }
  }

  flushText();
  return items;
};
