import { describe, expect, it, vi } from 'vitest';
import { GhCliError, GhJsonParseError, type GhRunner, detect, runJson } from '../gh';

function makeRunner(result: { stdout: string; stderr: string; exitCode: number }): GhRunner {
  return { run: vi.fn().mockResolvedValue(result) };
}

describe('detect', () => {
  it('returns available:false when runner throws', async () => {
    const runner: GhRunner = { run: vi.fn().mockRejectedValue(new Error('spawn failed')) };
    const result = await detect(runner);
    expect(result).toEqual({ available: false });
  });

  it('returns available:false when exitCode is non-zero', async () => {
    const runner = makeRunner({ stdout: '', stderr: 'not found', exitCode: 127 });
    const result = await detect(runner);
    expect(result).toEqual({ available: false });
  });

  it('parses version from gh version output', async () => {
    const runner = makeRunner({
      stdout: 'gh version 2.40.1 (2024-01-01)\nhttps://github.com/cli/cli/releases/tag/v2.40.1\n',
      stderr: '',
      exitCode: 0,
    });
    const result = await detect(runner);
    expect(result).toEqual({ available: true, version: '2.40.1' });
  });

  it('returns available:true with no version when output is unexpected', async () => {
    const runner = makeRunner({ stdout: 'something unexpected', stderr: '', exitCode: 0 });
    const result = await detect(runner);
    expect(result).toEqual({ available: true, version: undefined });
  });
});

describe('runJson', () => {
  it('throws GhCliError with preserved stderr and exitCode on non-zero exit', async () => {
    const runner = makeRunner({ stdout: '', stderr: 'permission denied', exitCode: 1 });
    await expect(runJson(runner, ['pr', 'list'])).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof GhCliError)) {
        return false;
      }
      return err.exitCode === 1 && err.stderr === 'permission denied';
    });
  });

  it('throws GhCliError (not GhJsonParseError) on non-zero exit even with json-like stdout', async () => {
    const runner = makeRunner({ stdout: '{"foo":1}', stderr: 'err', exitCode: 2 });
    await expect(runJson(runner, ['pr', 'list'])).rejects.toBeInstanceOf(GhCliError);
  });

  it('throws GhJsonParseError carrying raw stdout when output is invalid JSON', async () => {
    const runner = makeRunner({ stdout: 'not-json', stderr: '', exitCode: 0 });
    await expect(runJson(runner, ['pr', 'list'])).rejects.toSatisfy((err: unknown) => {
      if (!(err instanceof GhJsonParseError)) {
        return false;
      }
      return err.raw === 'not-json';
    });
  });

  it('returns parsed object on happy path', async () => {
    const payload = [{ number: 42, title: 'My PR' }];
    const runner = makeRunner({ stdout: JSON.stringify(payload), stderr: '', exitCode: 0 });
    const result = await runJson<typeof payload>(runner, ['pr', 'list']);
    expect(result).toEqual(payload);
  });
});
