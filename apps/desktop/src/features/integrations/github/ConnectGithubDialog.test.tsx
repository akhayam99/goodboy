// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { GitlabWorkspaceIntegration, WorkspaceId } from '@goodboy/types'

const { state, ghStatusMock, ghSetTokenMock, ghClearTokenMock } = vi.hoisted(() => ({
  state: {
    workspaceIntegrations: {} as Record<string, ReadonlyArray<unknown>>,
    disconnectGitlab: vi.fn(async () => undefined),
  },
  ghStatusMock: vi.fn(async () => ({ scoped: false, user: null }) as unknown),
  ghSetTokenMock: vi.fn(async () => ({ scoped: true }) as unknown),
  ghClearTokenMock: vi.fn(async () => undefined),
}))

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}))

vi.mock('../../github/github', () => ({
  ghStatus: ghStatusMock,
  ghSetToken: ghSetTokenMock,
  ghClearToken: ghClearTokenMock,
}))

const WS_ID = 'ws-1' as WorkspaceId

const gitlabIntegration: GitlabWorkspaceIntegration = {
  id: 'wi-1' as never,
  workspaceId: WS_ID,
  provider: 'gitlab',
  credentialKey: 'cred-1',
  config: { userName: 'octo', userId: '42', host: 'https://gitlab.com' },
  createdAt: '2026-01-01T00:00:00.000Z' as never,
  updatedAt: '2026-01-01T00:00:00.000Z' as never,
}

beforeEach(() => {
  state.workspaceIntegrations = {}
  state.disconnectGitlab = vi.fn(async () => undefined)
  ghStatusMock.mockResolvedValue({ scoped: false, user: null })
  ghSetTokenMock.mockResolvedValue({ scoped: true })
  ghClearTokenMock.mockResolvedValue(undefined)
})
afterEach(cleanup)

import { ConnectGithubDialog } from './ConnectGithubDialog'

describe('ConnectGithubDialog', () => {
  describe('when GitLab is connected for the workspace', () => {
    beforeEach(() => {
      state.workspaceIntegrations = { [WS_ID]: [gitlabIntegration] }
    })

    it('shows the mutual-exclusivity banner instead of the token form', async () => {
      render(<ConnectGithubDialog workspaceId={WS_ID} open onClose={vi.fn()} />)
      expect(await screen.findByText(/Disconnect GitLab to use a GitHub token/i)).toBeDefined()
      expect(screen.queryByLabelText(/GitHub personal access token/i)).toBeNull()
    })

    it('hides the Connect action', async () => {
      render(<ConnectGithubDialog workspaceId={WS_ID} open onClose={vi.fn()} />)
      await screen.findByText(/Disconnect GitLab to use a GitHub token/i)
      expect(screen.queryByRole('button', { name: /^connect$/i })).toBeNull()
    })

    it('wires the Disconnect GitLab button to disconnectGitlab', async () => {
      render(<ConnectGithubDialog workspaceId={WS_ID} open onClose={vi.fn()} />)
      const btn = await screen.findByRole('button', { name: /disconnect gitlab/i })
      fireEvent.click(btn)
      expect(state.disconnectGitlab).toHaveBeenCalledWith(WS_ID)
    })
  })

  describe('when no GitLab integration exists', () => {
    it('renders the normal token form with a Connect action', async () => {
      render(<ConnectGithubDialog workspaceId={WS_ID} open onClose={vi.fn()} />)
      expect(await screen.findByLabelText(/GitHub personal access token/i)).toBeDefined()
      await waitFor(() => expect(ghStatusMock).toHaveBeenCalledWith(WS_ID))
      expect(screen.getByRole('button', { name: /^connect$/i })).toBeDefined()
      expect(screen.queryByText(/Disconnect GitLab to use a GitHub token/i)).toBeNull()
    })
  })
})
