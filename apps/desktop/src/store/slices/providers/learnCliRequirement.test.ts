import { beforeEach, describe, expect, it, vi } from 'vitest';
import { learnCliRequirement } from './learnCliRequirement';

const dbMocks = vi.hoisted(() => ({
  setSetting: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/db')>();
  return { ...actual, setSetting: dbMocks.setSetting };
});

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

type State = Record<string, unknown>;

const setup = ({ cliRequirements }: { readonly cliRequirements: ReadonlyArray<unknown> }) => {
  const emitNotification = vi.fn(async () => undefined);
  let state: State = { cliRequirements, emitNotification };
  const set = vi.fn((patch: State) => {
    state = { ...state, ...patch };
  });
  const get = vi.fn(() => state);
  return { set, get, emitNotification, read: () => state };
};

const REFUSAL = {
  providerId: 'anthropic',
  modelKey: 'opus-5.5',
  requiredVersion: '2.1.280',
  installedVersion: '2.1.259',
} as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('learnCliRequirement', () => {
  it('stores the requirement and logs one warning with the update action', async () => {
    const { set, get, emitNotification, read } = setup({ cliRequirements: [] });
    await learnCliRequirement(set as never, get as never)(REFUSAL);

    expect(read().cliRequirements).toEqual([
      { providerId: 'anthropic', modelKey: 'opus-5.5', requiredVersion: '2.1.280' },
    ]);
    expect(dbMocks.setSetting).toHaveBeenCalledWith(
      {},
      'provider.cliRequirements',
      JSON.stringify(read().cliRequirements),
    );
    expect(emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'provider-cli-outdated',
        severity: 'warning',
        title: 'Opus 5.5 needs a newer Claude CLI',
        body: 'You have Claude CLI 2.1.259. Opus 5.5 needs 2.1.280 or newer.',
        action: { kind: 'update-provider-cli', providerId: 'anthropic' },
      }),
    );
  });

  it('stays quiet for a requirement it already knows', async () => {
    const { set, get, emitNotification } = setup({
      cliRequirements: [
        { providerId: 'anthropic', modelKey: 'opus-5.5', requiredVersion: '2.1.280' },
      ],
    });
    await learnCliRequirement(set as never, get as never)(REFUSAL);

    expect(dbMocks.setSetting).not.toHaveBeenCalled();
    expect(emitNotification).not.toHaveBeenCalled();
  });
});
