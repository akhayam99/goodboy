// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PROFILE_ACCESS } from '@goodboy/core';
import type { AgentRole } from '@goodboy/types';
import { ROLE_LABEL } from '../../../session/agent-kind';
import { AlsoSentLine } from './AlsoSentLine';

afterEach(cleanup);

const lineText = (): string => {
  render(<AlsoSentLine />);
  return screen.getByText(/^Also sent to/).textContent ?? '';
};

describe('AlsoSentLine', () => {
  it('names the roles that never get the working rules', () => {
    expect(lineText()).toBe(
      'Also sent to every agent but Scout, Debugger, Report, Wireframe, Resolver, Scribe: How agents should work with you',
    );
  });

  it('names exactly the roles the access map leaves without the working rules', () => {
    const text = lineText();
    for (const role of Object.keys(ROLE_LABEL) as ReadonlyArray<AgentRole>) {
      expect({ role, isNamed: text.includes(ROLE_LABEL[role]) }).toEqual({
        role,
        isNamed: !PROFILE_ACCESS[role].includes('workingRules'),
      });
    }
  });
});
