import { AUTO_BRIEF_DECISION_CHARS } from './limits';

export type BriefDecisionRow = Readonly<{
  number: number;
  text: string;
  status: 'active' | 'replaced' | 'withdrawn';
  replacedBy: number | null;
}>;

type NumberParams = {
  readonly id: string;
};

const DECISION_ID = /^[Dd]?(\d{1,6})$/;

export const decisionNumberOf = ({ id }: NumberParams): number | null => {
  const match = DECISION_ID.exec(id.trim());
  return match === null ? null : Number(match[1]);
};

type LineParams = {
  readonly id: string;
  readonly rows: ReadonlyArray<BriefDecisionRow>;
};

const lineOf = ({ id, rows }: LineParams): string => {
  const number = decisionNumberOf({ id });
  const row = number === null ? undefined : rows.find((candidate) => candidate.number === number);
  if (row === undefined) {
    return `- ${id.trim()} is not a decision of this conversation`;
  }
  if (row.status === 'withdrawn') {
    return `- D${row.number} was withdrawn and does not hold`;
  }
  if (row.status === 'replaced') {
    return `- D${row.number} was replaced${row.replacedBy === null ? '' : ` by D${row.replacedBy}`}`;
  }
  const text = row.text.trim();
  const shown =
    text.length > AUTO_BRIEF_DECISION_CHARS
      ? `${text.slice(0, AUTO_BRIEF_DECISION_CHARS)} (cut)`
      : text;
  return `- D${row.number} ${shown}`;
};

type ComposeParams = {
  readonly ids: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<BriefDecisionRow>;
};

export const composeBriefDecisions = ({ ids, rows }: ComposeParams): string | null => {
  if (ids.length === 0) {
    return null;
  }
  return [
    '**Decisions** Written in full from the conversation, they hold for this work.',
    ...ids.map((id) => lineOf({ id, rows })),
  ].join('\n');
};
