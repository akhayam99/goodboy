import { describe, expect, it } from 'vitest';
import { requestNounOfHosts } from './requestNounOfHosts';

describe('requestNounOfHosts', () => {
  it('names the requests of one host the way that host does', () => {
    expect(requestNounOfHosts({ hosts: ['github', 'github'] })).toBe('pull requests');
    expect(requestNounOfHosts({ hosts: ['gitlab'] })).toBe('merge requests');
  });

  it('says pull requests when no project names a host', () => {
    expect(requestNounOfHosts({ hosts: [] })).toBe('pull requests');
  });

  it('says requests when the workspace mixes hosts', () => {
    expect(requestNounOfHosts({ hosts: ['github', 'gitlab'] })).toBe('requests');
  });
});
