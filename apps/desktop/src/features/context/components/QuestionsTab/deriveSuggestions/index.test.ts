import { describe, expect, it } from 'vitest'
import { deriveSuggestions } from './index'

describe('deriveSuggestions', () => {
  it('splits an italian binary choice into two options', () => {
    expect(deriveSuggestions('Vuoi che usi OAuth o JWT?')).toEqual(['OAuth', 'JWT'])
  })

  it('splits an english "X or Y" choice', () => {
    expect(deriveSuggestions('Use Postgres or MySQL?')).toEqual(['Postgres', 'MySQL'])
  })

  it('handles the "oppure" separator', () => {
    expect(deriveSuggestions('Lo mettiamo in core oppure db?')).toEqual(['core', 'db'])
  })

  it('returns yes/no for a yes-no phrasing', () => {
    expect(deriveSuggestions('Devo procedere con il refactor?')).toEqual(['sì', 'no'])
  })

  it('returns nothing for an open-ended question', () => {
    expect(deriveSuggestions('Come strutturiamo il modulo di auth?')).toEqual([])
  })

  it('returns nothing for empty input', () => {
    expect(deriveSuggestions('   ')).toEqual([])
  })
})
