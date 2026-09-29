import { vi } from 'vitest';
import { recordUnexpectedCall } from './unexpectedCalls';

type DbModule = typeof import('@goodboy/db');

export type DbStubs = Readonly<Record<string, unknown>>;

const isClass = (value: unknown): boolean =>
  typeof value === 'function' && /^class[\s{]/.test(Function.prototype.toString.call(value));

const inertResult = (name: string): unknown => {
  if (/^(list|summarize|load|read)/.test(name)) {
    return [];
  }
  if (/^(get|find|describe|resolve)/.test(name)) {
    return null;
  }
  if (/^count/.test(name)) {
    return 0;
  }
  if (/^(has|is)/.test(name)) {
    return false;
  }
  return undefined;
};

const recordingStub = (name: string) =>
  vi.fn(async (...args: ReadonlyArray<unknown>) => {
    recordUnexpectedCall({ source: 'db', name, args });
    return inertResult(name);
  });

export const createDbMock = async (stubs: DbStubs): Promise<DbModule> => {
  const actual = await vi.importActual<Record<string, unknown>>('@goodboy/db');
  const unknown = Object.keys(stubs).filter((name) => !(name in actual));
  if (unknown.length > 0) {
    throw new Error(
      `db mock stubs a name that @goodboy/db does not export (renamed or removed?): ${unknown.join(', ')}`,
    );
  }
  const mock: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(actual)) {
    if (name in stubs) {
      mock[name] = stubs[name];
      continue;
    }
    mock[name] = typeof value === 'function' && !isClass(value) ? recordingStub(name) : value;
  }
  return mock as DbModule;
};
