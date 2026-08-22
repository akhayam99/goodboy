import { describe, expect, it, vi } from 'vitest';
import { uploadIssueAttachments } from './uploadIssueAttachments';

type Call = ReadonlyArray<string>;

const stagedImage = (overrides: Partial<{ fileName: string; mimeType: string; path: string }>) => ({
  fileName: 'board.png',
  mimeType: 'image/png',
  path: '/tmp/goodboy-report-1/01-board.png',
  ...overrides,
});

const runnerFor = (results: ReadonlyArray<{ stdout: string; exitCode: number }>) => {
  const calls: Call[] = [];
  let index = 0;
  return {
    calls,
    runner: {
      run: vi.fn(async (args: ReadonlyArray<string>) => {
        calls.push(args);
        const result = results[index] ?? { stdout: '', exitCode: 1 };
        index += 1;
        return { stdout: result.stdout, stderr: '', exitCode: result.exitCode };
      }),
    },
  };
};

describe('uploadIssueAttachments', () => {
  it('posts every image to the attachment host and returns the urls in order', async () => {
    const { runner, calls } = runnerFor([
      { stdout: '1231334462\n', exitCode: 0 },
      { stdout: '{"url":"https://github.com/user-attachments/assets/aaa"}', exitCode: 0 },
      { stdout: '{"url":"https://github.com/user-attachments/assets/bbb"}', exitCode: 0 },
    ]);

    const uploaded = await uploadIssueAttachments({
      runner,
      repo: 'akhayam99/goodboy',
      images: [
        stagedImage({}),
        stagedImage({ fileName: 'console.jpg', mimeType: '', path: '/tmp/r/02-console.jpg' }),
      ],
    });

    expect(uploaded).toEqual([
      { name: 'board.png', url: 'https://github.com/user-attachments/assets/aaa' },
      { name: 'console.jpg', url: 'https://github.com/user-attachments/assets/bbb' },
    ]);
    expect(calls[0]).toEqual(['api', 'repos/akhayam99/goodboy', '--jq', '.id']);
    expect(calls[1]?.[3]).toBe(
      'https://uploads.github.com/user-attachments/assets?name=board.png&content_type=image%2Fpng&repository_id=1231334462',
    );
    expect(calls[1]).toContain('--input');
    expect(calls[1]?.at(-1)).toBe('/tmp/goodboy-report-1/01-board.png');
    expect(calls[2]?.[3]).toContain('content_type=image%2Fjpeg');
  });

  it('escapes a name that would break the query string', async () => {
    const { runner, calls } = runnerFor([
      { stdout: '7\n', exitCode: 0 },
      { stdout: '{"url":"https://github.com/user-attachments/assets/aaa"}', exitCode: 0 },
    ]);

    await uploadIssueAttachments({
      runner,
      repo: 'akhayam99/goodboy',
      images: [stagedImage({ fileName: 'board freeze&crash.png' })],
    });

    expect(calls[1]?.[3]).toContain('name=board+freeze%26crash.png');
  });

  it('abandons the batch when one upload fails', async () => {
    const { runner } = runnerFor([
      { stdout: '7\n', exitCode: 0 },
      { stdout: '{"url":"https://github.com/user-attachments/assets/aaa"}', exitCode: 0 },
      { stdout: 'gone', exitCode: 1 },
    ]);

    const uploaded = await uploadIssueAttachments({
      runner,
      repo: 'akhayam99/goodboy',
      images: [stagedImage({}), stagedImage({ fileName: 'second.png' })],
    });

    expect(uploaded).toBeNull();
  });

  it('refuses an answer that is not an attachment url', async () => {
    const { runner } = runnerFor([
      { stdout: '7\n', exitCode: 0 },
      { stdout: '{"url":"https://evil.example/asset"}', exitCode: 0 },
    ]);

    const uploaded = await uploadIssueAttachments({
      runner,
      repo: 'akhayam99/goodboy',
      images: [stagedImage({})],
    });

    expect(uploaded).toBeNull();
  });

  it('survives an answer that is not json', async () => {
    const { runner } = runnerFor([
      { stdout: '7\n', exitCode: 0 },
      { stdout: '<html>gateway timeout</html>', exitCode: 0 },
    ]);

    const uploaded = await uploadIssueAttachments({
      runner,
      repo: 'akhayam99/goodboy',
      images: [stagedImage({})],
    });

    expect(uploaded).toBeNull();
  });

  it('gives up when the repository id cannot be read', async () => {
    const { runner, calls } = runnerFor([{ stdout: 'not-a-number', exitCode: 0 }]);

    const uploaded = await uploadIssueAttachments({
      runner,
      repo: 'akhayam99/goodboy',
      images: [stagedImage({})],
    });

    expect(uploaded).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('does nothing without images', async () => {
    const { runner, calls } = runnerFor([]);

    expect(
      await uploadIssueAttachments({ runner, repo: 'akhayam99/goodboy', images: [] }),
    ).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
