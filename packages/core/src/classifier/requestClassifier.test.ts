import { describe, expect, it, vi } from 'vitest';
import {
  buildRequestClassifierUserPrompt,
  classifyRequest,
  parseRequestClassification,
  type RequestClassifierDeps,
} from './requestClassifier';

const stdoutFor = (result: string) => JSON.stringify({ result });

const deps = (invokeFn: RequestClassifierDeps['invokeFn']): RequestClassifierDeps => ({
  providerId: 'anthropic',
  model: 'haiku-5.5',
  effort: 'low',
  invokeFn,
});

describe('parseRequestClassification', () => {
  it('reads a role and a difficulty', () => {
    expect(parseRequestClassification({ text: '{"role":"scout","difficulty":"light"}' })).toEqual({
      kind: 'ready',
      classification: { role: 'scout', difficulty: 'light' },
    });
  });

  it('turns none and an unknown role into no role', () => {
    for (const role of ['none', 'implementer', 42]) {
      expect(parseRequestClassification({ text: JSON.stringify({ role }) })).toEqual({
        kind: 'ready',
        classification: { role: null, difficulty: 'standard' },
      });
    }
  });

  it('falls back to standard for a difficulty it does not know', () => {
    expect(parseRequestClassification({ text: '{"role":"planner","difficulty":"huge"}' })).toEqual({
      kind: 'ready',
      classification: { role: 'planner', difficulty: 'standard' },
    });
  });

  it('accepts a fence around the object', () => {
    expect(
      parseRequestClassification({ text: '```json\n{"role":"reviewer","difficulty":"heavy"}\n```' })
        .kind,
    ).toBe('ready');
  });

  it('rejects an empty answer and prose', () => {
    expect(parseRequestClassification({ text: ' ' })).toEqual({
      kind: 'failed',
      failure: 'empty_answer',
    });
    expect(parseRequestClassification({ text: 'It is a scout request.' })).toEqual({
      kind: 'failed',
      failure: 'not_json',
    });
    expect(parseRequestClassification({ text: '{"role":' })).toEqual({
      kind: 'failed',
      failure: 'not_json',
    });
    expect(parseRequestClassification({ text: '[1]' })).toEqual({
      kind: 'failed',
      failure: 'not_json',
    });
  });
});

describe('buildRequestClassifierUserPrompt', () => {
  it('carries the typed request as data', () => {
    expect(buildRequestClassifierUserPrompt({ text: '  where is the retry limit set?  ' })).toBe(
      [
        'REQUEST:',
        'where is the retry limit set?',
        '',
        'Classify the request following your instructions. Output only the JSON object.',
      ].join('\n'),
    );
  });
});

describe('classifyRequest', () => {
  it('runs the task model once and times the answer', async () => {
    const invokeFn = vi.fn().mockResolvedValue({
      stdout: stdoutFor('{"role":"investigator","difficulty":"standard"}'),
      stderr: '',
      exitCode: 0,
    });
    const clock = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(900);

    const result = await classifyRequest({
      deps: { ...deps(invokeFn), nowMs: clock },
      text: 'why does the ledger-core export crash?',
    });

    expect(invokeFn).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      kind: 'ready',
      classification: { role: 'investigator', difficulty: 'standard' },
      durationMs: 800,
    });
  });

  it('reports a provider failure with its stderr', async () => {
    const invokeFn = vi.fn().mockResolvedValue({ stdout: '', stderr: 'boom', exitCode: 1 });

    await expect(classifyRequest({ deps: deps(invokeFn), text: 'x' })).resolves.toEqual({
      kind: 'failed',
      failure: 'provider_failed',
      detail: 'boom',
    });
  });

  it('reports a thrown spawn as a provider failure', async () => {
    const invokeFn = vi.fn().mockRejectedValue(new Error('spawn failed'));

    await expect(classifyRequest({ deps: deps(invokeFn), text: 'x' })).resolves.toEqual({
      kind: 'failed',
      failure: 'provider_failed',
      detail: 'spawn failed',
    });
  });

  it('refuses free prose in place of the JSON object', async () => {
    const invokeFn = vi
      .fn()
      .mockResolvedValue({ stdout: stdoutFor('A scout, I think.'), stderr: '', exitCode: 0 });

    await expect(classifyRequest({ deps: deps(invokeFn), text: 'x' })).resolves.toEqual({
      kind: 'failed',
      failure: 'not_json',
      detail: null,
    });
  });
});
