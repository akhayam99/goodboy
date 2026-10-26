import { describe, expect, it } from 'vitest';
import { parseCloneSource } from './parseCloneSource';

describe('parseCloneSource', () => {
  it('reads GitHub urls and owner/name once the host is chosen', () => {
    expect(
      parseCloneSource({ text: 'https://github.com/Northwind/ledger-core', host: null }),
    ).toEqual({
      kind: 'ready',
      host: 'github',
      name: 'ledger-core',
      remote: 'https://github.com/Northwind/ledger-core.git',
      form: 'url',
    });
    expect(
      parseCloneSource({ text: 'git@github.com:Northwind/ledger-core.git', host: null }),
    ).toEqual({
      kind: 'ready',
      host: 'github',
      name: 'ledger-core',
      remote: 'git@github.com:Northwind/ledger-core.git',
      form: 'url',
    });
    expect(parseCloneSource({ text: 'Northwind/ledger-core', host: null })).toEqual({
      kind: 'needs-host',
      name: 'ledger-core',
    });
    expect(parseCloneSource({ text: 'Northwind/ledger-core', host: 'github' })).toEqual({
      kind: 'ready',
      host: 'github',
      name: 'ledger-core',
      remote: 'https://github.com/Northwind/ledger-core.git',
      form: 'owner-name',
    });
  });

  it('reads GitLab urls, subgroups and owner/name', () => {
    expect(
      parseCloneSource({ text: 'https://gitlab.com/acme/platform/payments-api.git', host: null }),
    ).toEqual({
      kind: 'ready',
      host: 'gitlab',
      name: 'payments-api',
      remote: 'https://gitlab.com/acme/platform/payments-api.git',
      form: 'url',
    });
    expect(parseCloneSource({ text: 'acme/payments-api', host: 'gitlab' })).toEqual({
      kind: 'ready',
      host: 'gitlab',
      name: 'payments-api',
      remote: 'https://gitlab.com/acme/payments-api.git',
      form: 'owner-name',
    });
    expect(parseCloneSource({ text: 'acme/platform/payments-api', host: 'gitlab' }).kind).toBe(
      'ready',
    );
    expect(parseCloneSource({ text: 'acme/platform/payments-api', host: 'github' }).kind).toBe(
      'unknown',
    );
  });

  it('reads Bitbucket urls and owner/name', () => {
    expect(
      parseCloneSource({ text: 'https://bitbucket.org/cascadia/notify-relay', host: null }),
    ).toEqual({
      kind: 'ready',
      host: 'bitbucket',
      name: 'notify-relay',
      remote: 'https://bitbucket.org/cascadia/notify-relay.git',
      form: 'url',
    });
    expect(
      parseCloneSource({ text: 'git@bitbucket.org:cascadia/notify-relay.git', host: null }).kind,
    ).toBe('ready');
    expect(parseCloneSource({ text: 'cascadia/notify-relay', host: 'bitbucket' })).toEqual({
      kind: 'ready',
      host: 'bitbucket',
      name: 'notify-relay',
      remote: 'https://bitbucket.org/cascadia/notify-relay.git',
      form: 'owner-name',
    });
  });

  it('says empty for nothing and unknown for every form it cannot clone', () => {
    expect(parseCloneSource({ text: '  ', host: null })).toEqual({ kind: 'empty' });
    for (const text of [
      'ledger-core',
      'https://example.com/acme/ledger-core',
      'https://github.com/acme',
      'https://github.com/acme/ledger-core/tree/main',
      'https://github.com/acme/ledger core',
      'https://github.com/acme/ledger-core?tab=readme',
      'http://github.com/acme/ledger-core',
      'file:///tmp/ledger-core',
      '../ledger-core',
      '-acme/ledger-core',
    ]) {
      expect(parseCloneSource({ text, host: 'github' }).kind, text).toBe('unknown');
    }
  });
});
