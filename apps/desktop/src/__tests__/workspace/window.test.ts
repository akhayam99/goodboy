import { describe, expect, it } from 'vitest'

import {
  MAIN_WINDOW_LABEL,
  announcePresence,
  currentWindowLabel,
  focusWindow,
  isMainWindow,
  listenPresence,
  requestPresence,
  targetWorkspaceFromHash,
} from '../../features/workspace/window'

describe('window helpers (outside a Tauri runtime)', () => {
  it('reads the target workspace from the URL hash', () => {
    globalThis.location.hash = '#ws=ws-123'
    expect(targetWorkspaceFromHash()).toBe('ws-123')
    globalThis.location.hash = ''
    expect(targetWorkspaceFromHash()).toBeNull()
  })

  it('reports the main window when no webview is present', () => {
    expect(currentWindowLabel()).toBe(MAIN_WINDOW_LABEL)
    expect(isMainWindow()).toBe(true)
  })

  it('degrades window actions to safe no-ops', async () => {
    expect(await focusWindow('win-x')).toBe(false)
    await expect(announcePresence(null)).resolves.toBeUndefined()
    await expect(requestPresence()).resolves.toBeUndefined()
  })

  it('returns a callable unlisten from listenPresence even without a runtime', async () => {
    const off = await listenPresence({
      onPresence: () => undefined,
      onRequest: () => undefined,
      onClosing: () => undefined,
    })
    expect(() => off()).not.toThrow()
  })
})
