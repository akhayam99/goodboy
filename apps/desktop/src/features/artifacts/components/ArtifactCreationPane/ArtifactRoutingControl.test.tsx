// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ProviderId } from '@goodboy/types';
import type { ArtifactCreationRouting } from '../../../../store/slices/artifactDrafts/types';
import { ArtifactRoutingControl } from './ArtifactRoutingControl';

const CONNECTED: ReadonlyArray<ProviderId> = ['anthropic', 'codex', 'cursor'];
const RECOMMENDED: ArtifactCreationRouting = {
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'high',
};

afterEach(cleanup);

type HostProps = {
  readonly onValue: (value: ArtifactCreationRouting | null) => void;
};

const Host = ({ onValue }: HostProps) => {
  const [routing, setRouting] = useState<ArtifactCreationRouting | null>(null);
  onValue(routing);
  return (
    <ArtifactRoutingControl
      connectedProviders={CONNECTED}
      recommendation={RECOMMENDED}
      routing={routing}
      isDisabled={false}
      onChange={setRouting}
    />
  );
};

const dialog = () => within(screen.getByRole('dialog', { name: 'Artifact routing' }));

describe('ArtifactRoutingControl', () => {
  it('keeps Cursor, Opus 5.5 and Medium, then goes back to the recommendation', () => {
    let routing: ArtifactCreationRouting | null = null;
    render(<Host onValue={(next) => (routing = next)} />);
    fireEvent.click(screen.getByRole('button', { name: /^Artifact routing:/ }));

    fireEvent.click(dialog().getByRole('button', { name: 'Cursor' }));
    fireEvent.click(within(dialog().getByRole('group', { name: 'Model' })).getByText('Opus'));
    fireEvent.click(within(dialog().getByRole('group', { name: 'Version' })).getByText('5.5'));
    fireEvent.click(within(dialog().getByRole('group', { name: 'Effort' })).getByText('Medium'));

    expect(routing).toEqual({
      provider: 'cursor',
      model: 'claude-opus-5-5-medium',
      effort: 'medium',
    });

    fireEvent.click(dialog().getByRole('button', { name: /^Recommended/ }));

    expect(routing).toBeNull();
  });
});
