import { describe, expect, it } from 'vitest';
import { redactReport } from './redactReport';

type CorpusCase = {
  readonly label: string;
  readonly text: string;
  readonly names?: ReadonlyArray<string>;
  readonly expected?: string;
  readonly absent?: ReadonlyArray<string>;
  readonly present?: ReadonlyArray<string>;
};

const CORPUS: ReadonlyArray<CorpusCase> = [
  {
    label: 'github classic token',
    text: 'push failed with ghp_AbCdEfGhIjKlMnOpQrStUv123456',
    absent: ['ghp_AbCdEfGhIjKlMnOpQrStUv123456'],
  },
  {
    label: 'github fine grained token',
    text: 'token github_pat_11AAAAAAA0abcdefghijklmnopqrstuv',
    absent: ['github_pat_11AAAAAAA0abcdefghijklmnopqrstuv'],
  },
  {
    label: 'anthropic key',
    text: 'Bearer sk-ant-api03-AbCdEfGhIjKlMnOpQrSt',
    absent: ['sk-ant-api03-AbCdEfGhIjKlMnOpQrSt'],
  },
  {
    label: 'openai key',
    text: 'OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwx',
    absent: ['sk-proj-abcdefghijklmnopqrstuvwx'],
  },
  {
    label: 'short labelled secrets and bare token values',
    text: 'password=12345 token: abc Authorization: Bearer xyz secret="q1"',
    absent: ['12345', 'abc', 'xyz', 'q1'],
    present: ['password=', 'token: ', 'Authorization: ', 'secret='],
  },
  {
    label: 'slack bot token',
    text: 'slack said invalid_auth for xoxb-1234567890-abcdefghij',
    absent: ['xoxb-1234567890-abcdefghij'],
  },
  {
    label: 'gitlab token',
    text: 'glpat-AbCdEfGhIjKlMnOpQrSt rejected',
    absent: ['glpat-AbCdEfGhIjKlMnOpQrSt'],
  },
  {
    label: 'aws access key',
    text: 'key AKIAABCDEFGHIJKLMNOP expired',
    absent: ['AKIAABCDEFGHIJKLMNOP'],
  },
  {
    label: 'jwt',
    text: 'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpM',
    absent: ['eyJhbGciOiJIUzI1NiJ9', 'SflKxwRJSMeKKF2QT4fwpM'],
  },
  {
    label: 'authorization header',
    text: 'Authorization: Bearer abcdefghijklmnop',
    absent: ['abcdefghijklmnop'],
  },
  {
    label: 'password assignment',
    text: 'password=hunter2hunter2',
    absent: ['hunter2hunter2'],
  },
  {
    label: 'quoted secret',
    text: 'secret: "correct horse battery"',
    absent: ['correct horse battery'],
  },
  {
    label: 'macOS home path keeps only the file name',
    text: 'open /Users/rowan/code/harborline/.env failed',
    expected: 'open ~/…/.env failed',
  },
  {
    label: 'linux home path',
    text: 'at /home/rowan/northwind/src/App.tsx:12:4',
    expected: 'at ~/…/App.tsx:12:4',
  },
  {
    label: 'windows home path',
    text: 'at C:\\Users\\rowan\\cascadia\\App.tsx',
    expected: 'at ~/…/App.tsx',
  },
  {
    label: 'home folder alone',
    text: 'cwd /Users/rowan',
    expected: 'cwd ~',
  },
  {
    label: 'home path ending in a folder drops the folder name',
    text: 'spawn codex cwd=/Users/rowan/code/harborline',
    expected: 'spawn codex cwd=~/…',
  },
  {
    label: 'file directly under home',
    text: 'read /Users/rowan/.zshrc',
    expected: 'read ~/.zshrc',
  },
  {
    label: 'tilde path',
    text: 'wrote ~/code/ledger-core/notes.md',
    expected: 'wrote ~/…/notes.md',
  },
  {
    label: 'stack frame inside parentheses',
    text: 'at Row (/Users/rowan/payments-api/src/Row.tsx:12)',
    expected: 'at Row (~/…/Row.tsx:12)',
  },
  {
    label: 'external volume',
    text: 'mount /Volumes/Backup/northwind/db.sqlite',
    expected: 'mount /Volumes/…/db.sqlite',
  },
  {
    label: 'macOS temp folder',
    text: 'spill /private/var/folders/xy/abc123/T/goodboy-1/out.json',
    expected: 'spill /private/var/folders/…/out.json',
  },
  {
    label: 'tmp folder',
    text: 'lock /tmp/goodboy-rowan/lockfile',
    expected: 'lock /tmp/…',
  },
  {
    label: 'system path stays',
    text: 'spawn /opt/homebrew/bin/codex ENOENT',
    expected: 'spawn /opt/homebrew/bin/codex ENOENT',
  },
  {
    label: 'user name elsewhere in the text',
    text: 'at /Users/rowan/a.ts: permission denied for rowan',
    expected: 'at ~/a.ts: permission denied for [user]',
  },
  {
    label: 'email',
    text: 'signed in as rowan@example.dev',
    expected: 'signed in as [email]',
  },
  {
    label: 'email with plus tag',
    text: 'notify ops+alerts@acme.co.uk now',
    expected: 'notify [email] now',
  },
  {
    label: 'url drops query and fragment',
    text: 'GET https://api.github.com/graphql?access_token=abc#top 401',
    expected: 'GET https://api.github.com/… 401',
  },
  {
    label: 'url drops repo path',
    text: 'clone https://github.com/acme/ledger-core.git failed',
    expected: 'clone https://github.com/… failed',
  },
  {
    label: 'url keeps a bare host',
    text: 'fetch https://api.linear.app/ timed out',
    expected: 'fetch https://api.linear.app timed out',
  },
  {
    label: 'url with credentials',
    text: 'remote https://rowan:s3cr3tpass@gitlab.com/acme/notify-relay',
    expected: 'remote https://gitlab.com/…',
  },
  {
    label: 'localhost url',
    text: 'dev server http://localhost:1421/src/App.tsx down',
    expected: 'dev server [url] down',
  },
  {
    label: 'private lan host',
    text: 'gitlab at https://git.harborline.internal/api/v4',
    expected: 'gitlab at [url]',
  },
  {
    label: 'single label host',
    text: 'proxy http://buildbox:8080/status',
    expected: 'proxy [url]',
  },
  {
    label: 'ip host',
    text: 'connect https://10.0.0.12:8443/health refused',
    expected: 'connect [url] refused',
  },
  {
    label: 'file url',
    text: 'loaded file:///Users/rowan/harborline/index.html',
    expected: 'loaded [url]',
  },
  {
    label: 'app bundle frame keeps its path',
    text: 'at render (tauri://localhost/assets/index-a1b2c3.js:12:30)',
    expected: 'at render (tauri://localhost/assets/index-a1b2c3.js:12:30)',
  },
  {
    label: 'windows app bundle frame keeps its path',
    text: 'at render (http://tauri.localhost/assets/index-a1b2c3.js:4:2)',
    expected: 'at render (http://tauri.localhost/assets/index-a1b2c3.js:4:2)',
  },
  {
    label: 'scp style git remote',
    text: 'fatal: git@github.com:acme/payments-api.git not found',
    expected: 'fatal: [url] not found',
  },
  {
    label: 'uuid',
    text: 'session 3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b not found',
    expected: 'session [id] not found',
  },
  {
    label: 'bare ip address',
    text: 'resolved to 192.168.1.20',
    expected: 'resolved to [ip]',
  },
  {
    label: 'known project name',
    text: 'mount harborline failed on branch rowan/fix-refunds',
    names: ['harborline', 'rowan/fix-refunds'],
    expected: 'mount [name-1] failed on branch [name-2]',
  },
  {
    label: 'known name is case insensitive and whole word',
    text: 'Harborline and harborline-web',
    names: ['harborline'],
    expected: '[name-1] and [name-1]-web',
  },
  {
    label: 'longer name wins over its prefix',
    text: 'repo acme/ledger-core',
    names: ['acme', 'acme/ledger-core'],
    expected: 'repo [name-2]',
  },
  {
    label: 'names shorter than three characters are ignored',
    text: 'io error in db',
    names: ['io', 'db'],
    expected: 'io error in db',
  },
  {
    label: 'numbering is stable within one report',
    text: 'northwind then cascadia then northwind',
    names: ['northwind', 'cascadia'],
    expected: '[name-1] then [name-2] then [name-1]',
  },
  {
    label: 'version and build sha survive',
    text: 'Goodboy 0.11.1 (fc2f08994a1b2c3d4e5f60718293a4b5c6d7e8f9)',
    expected: 'Goodboy 0.11.1 (fc2f08994a1b2c3d4e5f60718293a4b5c6d7e8f9)',
  },
  {
    label: 'cli versions survive',
    text: 'claude 2.1.260, codex 0.61.0',
    expected: 'claude 2.1.260, codex 0.61.0',
  },
  {
    label: 'platform line survives',
    text: 'macOS 15.1 arm64',
    expected: 'macOS 15.1 arm64',
  },
  {
    label: 'screen label survives',
    text: 'Session › Review',
    expected: 'Session › Review',
  },
  {
    label: 'plain error survives',
    text: "TypeError: Cannot read properties of undefined (reading 'id')",
    expected: "TypeError: Cannot read properties of undefined (reading 'id')",
  },
  {
    label: 'secret inside a url query is gone twice over',
    text: 'https://hooks.slack.com/services/T000/B000/XXXX?token=xoxb-1234567890-abcdefghij',
    expected: 'https://hooks.slack.com/…',
  },
  {
    label: 'secret and home path in one line',
    text: 'GITHUB_TOKEN=ghp_AbCdEfGhIjKlMnOpQrStUv123456 in /Users/rowan/.config/gh/hosts.yml',
    absent: ['ghp_AbCdEfGhIjKlMnOpQrStUv123456', 'rowan', '.config'],
    present: ['hosts.yml'],
  },
];

describe('redactReport corpus', () => {
  it('holds at least forty cases', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(40);
  });

  it.each(CORPUS)('$label', ({ text, names, expected, absent = [], present = [] }) => {
    const redacted = redactReport({ text, names });
    if (expected !== undefined) {
      expect(redacted).toBe(expected);
    }
    absent.forEach((fragment) => expect(redacted).not.toContain(fragment));
    present.forEach((fragment) => expect(redacted).toContain(fragment));
  });

  it('is idempotent on its own output', () => {
    CORPUS.forEach(({ text, names }) => {
      const once = redactReport({ text, names });
      expect(redactReport({ text: once, names })).toBe(once);
    });
  });
});
