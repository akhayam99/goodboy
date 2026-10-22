import {
  getSetting,
  insertSettingIfAbsent,
  replaceSettingIfUnchanged,
  type Database,
} from '@goodboy/db';
import { parseRunRoute, type AgentId, type RunRoute, type SessionId } from '@goodboy/types';

type KeyParams = {
  readonly sessionId: SessionId;
};

export const runRoutesKey = ({ sessionId }: KeyParams): string => `runs.routes.${sessionId}`;

type RawParams = {
  readonly raw: string | null | undefined;
};

export const parseRunRoutes = ({ raw }: RawParams): Readonly<Record<string, RunRoute>> => {
  if (raw === null || raw === undefined || raw === '') {
    return {};
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }
    const routes: Record<string, RunRoute> = {};
    for (const [agentId, entry] of Object.entries(value)) {
      const route = parseRunRoute({ value: entry });
      if (route !== null) {
        routes[agentId] = route;
      }
    }
    return routes;
  } catch {
    return {};
  }
};

type WriteParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly route: RunRoute;
};

const MAX_ATTEMPTS = 3;

export const writeRunRoute = async ({
  db,
  sessionId,
  agentId,
  route,
}: WriteParams): Promise<void> => {
  const key = runRoutesKey({ sessionId });
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    const raw = await getSetting(db, key);
    const value = JSON.stringify({ ...parseRunRoutes({ raw }), [agentId]: route });
    const isWritten =
      raw === null
        ? await insertSettingIfAbsent({ db, key, value })
        : await replaceSettingIfUnchanged(db, { key, expected: raw, value });
    if (isWritten) {
      return;
    }
  }
  throw new Error('The run route changed in another window, try again');
};
