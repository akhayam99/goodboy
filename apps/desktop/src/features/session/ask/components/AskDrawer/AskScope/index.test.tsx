// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SESSION } from '../../../../../../app/components/MockScene/scenes/activityRunSeed';
import { sessionTitle } from '../../../../../../shared/utils/sessionTitle';
import { AskScope } from '.';

afterEach(cleanup);

describe('the Ask scope chip', () => {
  it('names the session the questions are about', () => {
    render(<AskScope session={SESSION} />);
    const scope = screen.getByTestId('ask-scope');
    expect(scope.textContent).toBe(`Scope: ${sessionTitle({ session: SESSION })}`);
  });
});
