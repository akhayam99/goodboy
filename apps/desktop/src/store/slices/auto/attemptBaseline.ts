import type { MountSnapshot } from '@goodboy/core';
import type { AutoJsonObject } from '@goodboy/db';

export type ResumeInfo = Readonly<{
  questionId: string;
  question: string;
  answer: string;
}>;

type RecordValue = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type BaselineParams = {
  readonly baseline: unknown;
};

export const resumeOf = ({ baseline }: BaselineParams): ResumeInfo | null => {
  if (!isRecord(baseline)) {
    return null;
  }
  const resume = baseline['resume'];
  if (!isRecord(resume)) {
    return null;
  }
  const questionId = resume['questionId'];
  const question = resume['question'];
  const answer = resume['answer'];
  if (
    typeof questionId !== 'string' ||
    typeof question !== 'string' ||
    typeof answer !== 'string'
  ) {
    return null;
  }
  return { questionId, question, answer };
};

export const snapshotOf = ({ baseline }: BaselineParams): MountSnapshot | null => {
  if (!isRecord(baseline)) {
    return null;
  }
  const head = baseline['head'];
  const entries = baseline['entries'];
  if (typeof head !== 'string' || !Array.isArray(entries)) {
    return null;
  }
  return {
    head,
    entries: entries.flatMap((entry: unknown) =>
      isRecord(entry) && typeof entry['path'] === 'string' && typeof entry['hash'] === 'string'
        ? [{ path: entry['path'], hash: entry['hash'] }]
        : [],
    ),
    isPartial: baseline['isPartial'] === true,
  };
};

type SnapshotJsonParams = {
  readonly snapshot: MountSnapshot | null;
  readonly nowMs: number;
};

export const snapshotJson = ({ snapshot, nowMs }: SnapshotJsonParams): AutoJsonObject =>
  snapshot === null
    ? { takenAt: nowMs }
    : {
        head: snapshot.head,
        entries: snapshot.entries.map((entry) => ({ path: entry.path, hash: entry.hash })),
        isPartial: snapshot.isPartial,
        takenAt: nowMs,
      };
