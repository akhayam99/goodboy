import {
  HANDOFF_SECTION_KINDS,
  type AgentHandoff,
  type AgentId,
  type HandoffSection,
  type HandoffSender,
  type IsoDateTime,
  type ProviderName,
} from '@goodboy/types';
import type { Database } from '../client';
import { isJsonArray, isJsonRecord, parseJsonColumn } from '../shared/parseJsonColumn';

type InsertParams = {
  readonly db: Database;
  readonly handoff: AgentHandoff;
};

export const insertAgentHandoff = async ({ db, handoff }: InsertParams): Promise<void> => {
  await db.execute(
    `INSERT INTO agent_handoffs
       (agent_id, sender_json, ask, why, done_when, sections_json, sent_system, sent_message, provider, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (agent_id) DO NOTHING`,
    [
      handoff.agentId,
      JSON.stringify(handoff.sender),
      handoff.ask,
      handoff.why,
      handoff.doneWhen,
      JSON.stringify(handoff.sections),
      handoff.sentSystem,
      handoff.sentMessage,
      handoff.provider,
      Date.parse(handoff.createdAt),
    ],
  );
};

type HandoffRow = {
  readonly agent_id: string;
  readonly sender_json: string;
  readonly ask: string;
  readonly why: string | null;
  readonly done_when: string | null;
  readonly sections_json: string;
  readonly sent_system: string | null;
  readonly sent_message: string;
  readonly provider: string;
  readonly created_at: number;
};

const SENDER_KINDS: ReadonlyArray<HandoffSender['kind']> = [
  'you',
  'orchestrator',
  'workflowStep',
  'resolve',
  'parent',
  'question',
  'followUp',
];

const isSender = (value: unknown): value is HandoffSender =>
  isJsonRecord(value) && SENDER_KINDS.some((kind) => kind === value.kind);

const isSection = (value: unknown): value is HandoffSection =>
  isJsonRecord(value) &&
  HANDOFF_SECTION_KINDS.some((kind) => kind === value.kind) &&
  typeof value.summary === 'string' &&
  typeof value.bodyMd === 'string' &&
  isJsonArray(value.refs);

const isSections = (value: unknown): value is ReadonlyArray<HandoffSection> =>
  isJsonArray(value) && value.every(isSection);

const YOU: HandoffSender = { kind: 'you' };

type RowParams = {
  readonly row: HandoffRow;
};

const toHandoff = ({ row }: RowParams): AgentHandoff => ({
  agentId: row.agent_id as AgentId,
  sender: parseJsonColumn({ value: row.sender_json, isValid: isSender, fallback: YOU }),
  ask: row.ask,
  why: row.why,
  doneWhen: row.done_when,
  sections: parseJsonColumn({ value: row.sections_json, isValid: isSections, fallback: [] }),
  sentSystem: row.sent_system,
  sentMessage: row.sent_message,
  provider: row.provider as ProviderName,
  createdAt: new Date(row.created_at).toISOString() as IsoDateTime,
});

type GetParams = {
  readonly db: Database;
  readonly agentId: AgentId;
};

export const getAgentHandoff = async ({ db, agentId }: GetParams): Promise<AgentHandoff | null> => {
  const rows = await db.select<HandoffRow>('SELECT * FROM agent_handoffs WHERE agent_id = ?', [
    agentId,
  ]);
  const row = rows[0];
  return row === undefined ? null : toHandoff({ row });
};
