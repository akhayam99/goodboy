import type { SessionId } from '@goodboy/types';

export type SessionMaterializationSeed = {
  readonly branchPrefix?: string;
  readonly sessionSlug?: string;
  readonly existingBranch?: string;
  readonly fallbackRef?: string;
  readonly folderName?: string;
};

const seeds = new Map<SessionId, SessionMaterializationSeed>();

type SessionParams = {
  readonly sessionId: SessionId;
};

type RememberParams = SessionParams & {
  readonly seed: SessionMaterializationSeed;
};

export const rememberMaterializationSeed = ({ sessionId, seed }: RememberParams): void => {
  seeds.set(sessionId, seed);
};

export const materializationSeedFor = ({
  sessionId,
}: SessionParams): SessionMaterializationSeed | null => seeds.get(sessionId) ?? null;

export const consumeAdoptionSeed = ({ sessionId }: SessionParams): void => {
  const seed = seeds.get(sessionId);
  if (seed === undefined) {
    return;
  }
  const { existingBranch: _branch, fallbackRef: _ref, ...rest } = seed;
  seeds.set(sessionId, rest);
};

export const forgetMaterializationSeed = ({ sessionId }: SessionParams): void => {
  seeds.delete(sessionId);
};
