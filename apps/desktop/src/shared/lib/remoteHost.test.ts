import { describe, expect, it } from 'vitest'
import { classifyRemoteHost, projectPathFromRemoteUrl } from './remoteHost'

describe('classifyRemoteHost', () => {
  it('returns none for a null url', () => {
    expect(classifyRemoteHost(null, [])).toBe('none')
  })

  it('detects github from https and scp-like remotes', () => {
    expect(classifyRemoteHost('https://github.com/acme/web.git', [])).toBe('github')
    expect(classifyRemoteHost('git@github.com:acme/web.git', [])).toBe('github')
  })

  it('detects gitlab.com without configured hosts', () => {
    expect(classifyRemoteHost('git@gitlab.com:acme/web.git', [])).toBe('gitlab')
  })

  it('detects a self-hosted gitlab via the configured host list', () => {
    expect(classifyRemoteHost('git@git.acme.io:team/app.git', ['https://git.acme.io'])).toBe(
      'gitlab',
    )
  })

  it('falls back to other for unknown hosts', () => {
    expect(classifyRemoteHost('https://bitbucket.org/acme/web.git', [])).toBe('other')
  })
})

describe('projectPathFromRemoteUrl', () => {
  it('extracts the namespace path from an https remote', () => {
    expect(projectPathFromRemoteUrl('https://gitlab.com/group/sub/project.git')).toBe(
      'group/sub/project',
    )
  })

  it('extracts the namespace path from an scp-like remote', () => {
    expect(projectPathFromRemoteUrl('git@gitlab.com:group/project.git')).toBe('group/project')
  })

  it('returns null for an empty or unparseable url', () => {
    expect(projectPathFromRemoteUrl(null)).toBeNull()
    expect(projectPathFromRemoteUrl('   ')).toBeNull()
  })
})
