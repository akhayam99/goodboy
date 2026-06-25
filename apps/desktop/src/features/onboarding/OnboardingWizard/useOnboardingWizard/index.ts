import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkspaceId } from '@goodboy/types'
import { useAppStore, useWorkspaces } from '../../../../store'
import { ghStatus } from '../../../github/github'
import { isWizardDone, OPEN_WIZARD_EVENT, type WizardMode } from '../../onboarding-store'

export type OnboardingWizardState = {
  readonly open: boolean
  readonly mode: WizardMode
  readonly providersConnected: number
  readonly hasWorkspace: boolean
  readonly workspaceId: WorkspaceId | null
  readonly githubConnected: boolean
  readonly gitlabConnected: boolean
  readonly hasCodeHost: boolean
  readonly hasLinear: boolean
  readonly hasSentry: boolean
  readonly refreshGithubStatus: () => void
}

export const useOnboardingWizard = (): OnboardingWizardState => {
  const providersConnected = useAppStore(
    (s) => s.providers.filter((p) => p.connection === 'connected').length,
  )
  const workspaceId = useWorkspaces()[0]?.id ?? null
  const hasWorkspace = useWorkspaces().length > 0
  const hydrated = useAppStore((s) => s.hydrated)

  const gitlabConnected = useAppStore((s) =>
    workspaceId
      ? (s.workspaceIntegrations[workspaceId] ?? []).some((i) => i.provider === 'gitlab')
      : false,
  )
  const hasLinear = useAppStore((s) =>
    workspaceId
      ? (s.workspaceIntegrations[workspaceId] ?? []).some((i) => i.provider === 'linear')
      : false,
  )
  const hasSentry = useAppStore((s) =>
    workspaceId
      ? (s.workspaceIntegrations[workspaceId] ?? []).some((i) => i.provider === 'sentry')
      : false,
  )

  const [githubScoped, setGithubScoped] = useState(false)
  const refreshGithubStatus = useCallback(() => {
    if (!workspaceId) {
      setGithubScoped(false)
      return
    }
    void ghStatus(workspaceId)
      .then((status) => setGithubScoped(status.scoped ?? false))
      .catch(() => setGithubScoped(false))
  }, [workspaceId])

  useEffect(() => {
    refreshGithubStatus()
  }, [refreshGithubStatus])

  const hasCodeHost = githubScoped || gitlabConnected

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<WizardMode>('full')
  const decided = useRef(false)
  const openRef = useRef(false)

  useEffect(() => {
    const onOpen = (e: Event) => {
      const requested = (e as CustomEvent<{ mode?: WizardMode }>).detail?.mode ?? 'full'
      if (requested === 'setup' && openRef.current) {
        return
      }
      decided.current = true
      openRef.current = true
      setMode(requested)
      setOpen(true)
    }
    const onProgress = () => {
      if (isWizardDone()) {
        decided.current = true
        openRef.current = false
        setOpen(false)
      }
    }
    window.addEventListener(OPEN_WIZARD_EVENT, onOpen)
    window.addEventListener('goodboy:onboarding-progress', onProgress)
    return () => {
      window.removeEventListener(OPEN_WIZARD_EVENT, onOpen)
      window.removeEventListener('goodboy:onboarding-progress', onProgress)
    }
  }, [])

  useEffect(() => {
    if (decided.current || !hydrated) {
      return
    }
    if (!isWizardDone() && !hasWorkspace) {
      decided.current = true
      openRef.current = true
      setOpen(true)
    }
  }, [hydrated, hasWorkspace])

  return {
    open,
    mode,
    providersConnected,
    hasWorkspace,
    workspaceId,
    githubConnected: githubScoped,
    gitlabConnected,
    hasCodeHost,
    hasLinear,
    hasSentry,
    refreshGithubStatus,
  }
}
