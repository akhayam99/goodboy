import { describe, expect, it } from 'vitest';
import type { IsoDateTime } from '@goodboy/types';
import { sessionPrFetchState } from './sessionPrFetchState';

const EARLIER = '2026-08-04T10:00:00.000Z' as IsoDateTime;
const LATER = '2026-08-04T10:05:00.000Z' as IsoDateTime;

describe('sessionPrFetchState', () => {
  it('reports unknown while github is reachable and nothing has been fetched yet', () => {
    expect(
      sessionPrFetchState({
        githubAvailable: true,
        fetchedAt: null,
        failedAt: null,
        fetchable: true,
      }),
    ).toBe('unknown');
  });

  it('reports unknown before gh status itself has resolved', () => {
    expect(
      sessionPrFetchState({
        githubAvailable: null,
        fetchedAt: null,
        failedAt: null,
        fetchable: true,
      }),
    ).toBe('unknown');
  });

  it('reports known once a fetch has landed', () => {
    expect(
      sessionPrFetchState({
        githubAvailable: true,
        fetchedAt: EARLIER,
        failedAt: null,
        fetchable: true,
      }),
    ).toBe('known');
  });

  it('reports known when gh is absent, because there is nothing left to check', () => {
    expect(
      sessionPrFetchState({
        githubAvailable: false,
        fetchedAt: null,
        failedAt: null,
        fetchable: true,
      }),
    ).toBe('known');
  });

  it('reports known when the session can never be fetched, rather than waiting forever', () => {
    expect(
      sessionPrFetchState({
        githubAvailable: true,
        fetchedAt: null,
        failedAt: null,
        fetchable: false,
      }),
    ).toBe('known');
  });

  it('reports known for an unfetchable session even before gh status resolves', () => {
    expect(
      sessionPrFetchState({
        githubAvailable: null,
        fetchedAt: null,
        failedAt: null,
        fetchable: false,
      }),
    ).toBe('known');
  });

  it('reports unreachable when every attempt failed and nothing ever landed', () => {
    expect(
      sessionPrFetchState({
        githubAvailable: true,
        fetchedAt: null,
        failedAt: EARLIER,
        fetchable: true,
      }),
    ).toBe('unreachable');
  });

  it('reports unreachable when the newest attempt failed after an older success', () => {
    expect(
      sessionPrFetchState({
        githubAvailable: true,
        fetchedAt: EARLIER,
        failedAt: LATER,
        fetchable: true,
      }),
    ).toBe('unreachable');
  });

  it('reports known again once a later attempt succeeds after a failure', () => {
    expect(
      sessionPrFetchState({
        githubAvailable: true,
        fetchedAt: LATER,
        failedAt: EARLIER,
        fetchable: true,
      }),
    ).toBe('known');
  });
});
