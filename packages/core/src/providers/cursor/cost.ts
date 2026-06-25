import type { ProviderUsage } from '@goodboy/types'

type ModelPrice = {
  readonly inputPerMtok: number
  readonly outputPerMtok: number
  readonly cachedInputPerMtok: number
}

export const CURSOR_CHEAP_MODEL = 'composer-2-fast'

const COMPOSER_PRICE: ModelPrice = {
  inputPerMtok: 0.8,
  outputPerMtok: 4,
  cachedInputPerMtok: 0.08,
}
const SONNET_PRICE: ModelPrice = {
  inputPerMtok: 3,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.3,
}
const OPUS_PRICE: ModelPrice = {
  inputPerMtok: 15,
  outputPerMtok: 75,
  cachedInputPerMtok: 1.5,
}
const GPT5_PRICE: ModelPrice = {
  inputPerMtok: 5,
  outputPerMtok: 15,
  cachedInputPerMtok: 0.5,
}

export const CURSOR_PRICES: Record<string, ModelPrice> = {
  [CURSOR_CHEAP_MODEL]: COMPOSER_PRICE,
  'composer-2': COMPOSER_PRICE,
  auto: COMPOSER_PRICE,

  'claude-opus-4-7-thinking-high': OPUS_PRICE,
  'claude-4.6-opus-high-thinking': OPUS_PRICE,
  'claude-4.6-opus-high-thinking-fast': OPUS_PRICE,
  'claude-4.6-sonnet-medium': SONNET_PRICE,
  'claude-4.6-sonnet-high': SONNET_PRICE,
  'claude-sonnet-4-5': SONNET_PRICE,
  'claude-sonnet-4-6': SONNET_PRICE,

  'gpt-5.5-high': GPT5_PRICE,
  'gpt-5.5-medium': GPT5_PRICE,
  'gpt-5.3-codex': GPT5_PRICE,
  'gpt-4o': GPT5_PRICE,
}

const FALLBACK: ModelPrice = COMPOSER_PRICE

export const cursorPriceFor = (model: string): ModelPrice => {
  return CURSOR_PRICES[model] ?? FALLBACK
}

export const computeCursorCostUsd = (usage: ProviderUsage, model: string): number => {
  const price = cursorPriceFor(model)
  const billableInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens)
  return (
    (billableInput * price.inputPerMtok) / 1_000_000 +
    (usage.cachedInputTokens * price.cachedInputPerMtok) / 1_000_000 +
    (usage.outputTokens * price.outputPerMtok) / 1_000_000
  )
}
