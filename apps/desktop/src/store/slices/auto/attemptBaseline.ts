import type { MountSnapshot, RemoteRead } from '@goodboy/core';
import type { AutoJsonObject } from '@goodboy/db';

export type ResumeInfo = Readonly<{
  questionId: string;
  question: string;
  answer: string;
  tail: string | null;
  report: string | null;
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
  const tail = resume['tail'];
  const report = resume['report'];
  return {
    questionId,
    question,
    answer,
    tail: typeof tail === 'string' ? tail : null,
    report: typeof report === 'string' ? report : null,
  };
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

export const remoteOf = ({ baseline }: BaselineParams): RemoteRead | null => {
  if (!isRecord(baseline)) {
    return null;
  }
  const remote = baseline['remote'];
  if (!isRecord(remote)) {
    return null;
  }
  const branch = remote['branch'];
  if (remote['kind'] === 'unknown') {
    return { kind: 'unknown' };
  }
  if (typeof branch !== 'string') {
    return null;
  }
  if (remote['kind'] === 'absent') {
    return { kind: 'absent', branch };
  }
  const sha = remote['sha'];
  return remote['kind'] === 'sha' && typeof sha === 'string' ? { kind: 'sha', branch, sha } : null;
};

type RemoteJsonParams = {
  readonly remote: RemoteRead | null;
};

export const remoteJson = ({ remote }: RemoteJsonParams): AutoJsonObject =>
  remote === null ? {} : { remote };

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
