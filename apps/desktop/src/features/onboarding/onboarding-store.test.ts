// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  settings: new Map<string, string>(),
  setSetting: vi.fn(),
}))

vi.mock('@goodboy/db', () => ({
  getSetting: (_db: unknown, key: string) =>
    Promise.resolve(db.settings.has(key) ? db.settings.get(key)! : null),
  setSetting: (_db: unknown, key: string, value: string) => {
    db.setSetting(key, value)
    db.settings.set(key, value)
    return Promise.resolve()
  },
}))

vi.mock('../../shared/lib/db', () => ({ tauriDatabase: {} }))

import {
  finishWizard,
  hydrateOnboardingFromDb,
  isWizardDone,
  OPEN_WIZARD_EVENT,
  reopenWizard,
} from './onboarding-store'

beforeEach(async () => {
  db.settings.clear()
  db.setSetting.mockClear()
  await hydrateOnboardingFromDb()
})
afterEach(() => vi.restoreAllMocks())

describe('onboarding-store wizard flag', () => {
  it('hydrates wizardDone=true only when the stored value is "done"', async () => {
    db.settings.set('onboarding.wizard', 'done')
    await hydrateOnboardingFromDb()
    expect(isWizardDone()).toBe(true)
  })

  it('treats any non-"done" stored value as not finished', async () => {
    db.settings.set('onboarding.wizard', '')
    await hydrateOnboardingFromDb()
    expect(isWizardDone()).toBe(false)
  })

  it('marks the wizard done and persists "done"', () => {
    finishWizard()
    expect(isWizardDone()).toBe(true)
    expect(db.setSetting).toHaveBeenCalledWith('onboarding.wizard', 'done')
  })

  it('is idempotent: finishing twice persists only once', () => {
    finishWizard()
    db.setSetting.mockClear()
    finishWizard()
    expect(db.setSetting).not.toHaveBeenCalled()
  })

  it('reopenWizard resets the done flag and persists the cleared value', () => {
    finishWizard()
    db.setSetting.mockClear()
    reopenWizard()
    expect(isWizardDone()).toBe(false)
    expect(db.setSetting).toHaveBeenCalledWith('onboarding.wizard', '')
  })

  it('reopenWizard dispatches the open-wizard event', () => {
    const spy = vi.fn()
    window.addEventListener(OPEN_WIZARD_EVENT, spy)
    reopenWizard()
    expect(spy).toHaveBeenCalledOnce()
    window.removeEventListener(OPEN_WIZARD_EVENT, spy)
  })

  it('reopenWizard skips the db write when the wizard was never finished', () => {
    reopenWizard()
    expect(db.setSetting).not.toHaveBeenCalled()
  })

  it('reopenWizard still dispatches the event when nothing was persisted', () => {
    const spy = vi.fn()
    window.addEventListener(OPEN_WIZARD_EVENT, spy)
    reopenWizard()
    expect(spy).toHaveBeenCalledOnce()
    window.removeEventListener(OPEN_WIZARD_EVENT, spy)
  })

  it('reopenWizard defaults to full mode in the event detail', () => {
    let detail: unknown
    const spy = (e: Event) => {
      detail = (e as CustomEvent).detail
    }
    window.addEventListener(OPEN_WIZARD_EVENT, spy)
    reopenWizard()
    window.removeEventListener(OPEN_WIZARD_EVENT, spy)
    expect(detail).toEqual({ mode: 'full' })
  })

  it('reopenWizard forwards the requested setup mode in the event detail', () => {
    let detail: unknown
    const spy = (e: Event) => {
      detail = (e as CustomEvent).detail
    }
    window.addEventListener(OPEN_WIZARD_EVENT, spy)
    reopenWizard('setup')
    window.removeEventListener(OPEN_WIZARD_EVENT, spy)
    expect(detail).toEqual({ mode: 'setup' })
  })
})
