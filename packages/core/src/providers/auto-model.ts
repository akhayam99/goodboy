import type { ModelCostTier, ProviderId } from '@goodboy/types'
import { PROVIDER_CAPABILITIES } from './capabilities'
import { CURSOR_AUTO_MODEL } from './cursor/models'
import { defaultsForRole } from '../roles'

export type AutoModelChoice = {
  readonly provider: ProviderId
  readonly model: string
}

const COST_RANK: Readonly<Record<ModelCostTier, number>> = {
  cheap: 1,
  mid: 2,
  expensive: 3,
}

const targetCostRankForRole = (role: string): number => {
  const { provider, model } = defaultsForRole(role)
  const tier = PROVIDER_CAPABILITIES[provider].models.find((m) => m.id === model)?.costTier
  return COST_RANK[tier ?? 'mid']
}

export const autoModelForRole = (
  role: string,
  providers: ReadonlyArray<ProviderId>,
): AutoModelChoice | null => {
  if (providers.length === 0) {
    return null
  }

  const def = defaultsForRole(role)
  if (providers.includes(def.provider)) {
    return { provider: def.provider, model: def.model }
  }

  const target = targetCostRankForRole(role)
  let best: { provider: ProviderId; model: string; score: number } | null = null
  for (const provider of providers) {
    for (const m of PROVIDER_CAPABILITIES[provider].models) {
      const score = -Math.abs(COST_RANK[m.costTier] - target) * 1000 + m.weight
      if (best === null || score > best.score) {
        best = { provider, model: m.id, score }
      }
    }
  }
  if (best === null) {
    return null
  }
  return {
    provider: best.provider,
    model: best.provider === 'cursor' ? CURSOR_AUTO_MODEL : best.model,
  }
}
