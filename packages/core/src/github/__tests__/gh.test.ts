import { describe, expect, it, vi } from 'vitest';
import { GhCliError, GhJsonParseError, GhJsonShapeError, type GhRunner, runJson } from '../gh';

const makeRunner = (result: { stdout: string; stderr: string; exitCode: number }): GhRunner => ({
  run: vi.fn().mockResolvedValue(result),
});

describe('runJson', () => {
  it('throws GhCliError with preserved stderr and exitCode on non-zero exit', async () => {
    const runner = makeRunner({ stdout: '', stderr: 'permission denied', exitCode: 1 });
    await expect(runJson({ runner, args: ['pr', 'list'], shape: 'array' })).rejects.toSatisfy(
      (err: unknown) => {
        if (!(err instanceof GhCliError)) {
          return false;
        }
        return err.exitCode === 1 && err.stderr === 'permission denied';
      },
    );
  });

  it('throws GhCliError (not GhJsonParseError) on non-zero exit even with json-like stdout', async () => {
    const runner = makeRunner({ stdout: '{"foo":1}', stderr: 'err', exitCode: 2 });
    await expect(runJson({ runner, args: ['pr', 'list'], shape: 'array' })).rejects.toBeInstanceOf(
      GhCliError,
    );
  });

  it('throws GhJsonParseError carrying raw stdout when output is invalid JSON', async () => {
    const runner = makeRunner({ stdout: 'not-json', stderr: '', exitCode: 0 });
    await expect(runJson({ runner, args: ['pr', 'list'], shape: 'array' })).rejects.toSatisfy(
      (err: unknown) => {
        if (!(err instanceof GhJsonParseError)) {
          return false;
        }
        return err.raw === 'not-json';
      },
    );
  });

  it('returns parsed object on happy path', async () => {
    const payload = [{ number: 42, title: 'My PR' }];
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: '', exitCode: 0 });
    const result = await runJson<typeof payload>({ runner, args: ['pr', 'list'], shape: 'array' });
    expect(result).toEqual(payload);
  });

  it('throws GhJsonShapeError when an array was expected and an object came back', async () => {
    const runner = makeRunner({ stdout: '{"message":"Not Found"}', stderr: '', exitCode: 0 });
    await expect(runJson({ runner, args: ['pr', 'list'], shape: 'array' })).rejects.toSatisfy(
      (err: unknown) => err instanceof GhJsonShapeError && err.expected === 'array',
    );
  });

  it('throws a parse error subclass so existing parse handlers still catch a shape mismatch', async () => {
    const runner = makeRunner({ stdout: '[1, 2]', stderr: '', exitCode: 0 });
    await expect(runJson({ runner, args: ['pr', 'view'], shape: 'object' })).rejects.toBeInstanceOf(
      GhJsonParseError,
    );
  });

  it('rejects a scalar for either shape', async () => {
    const runner = makeRunner({ stdout: 'null', stderr: '', exitCode: 0 });
    await expect(runJson({ runner, args: ['pr', 'view'], shape: 'object' })).rejects.toBeInstanceOf(
      GhJsonShapeError,
    );
  });
});
