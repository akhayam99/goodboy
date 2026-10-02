// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aProject } from '@goodboy/types/testing';

const project = aProject({ name: 'cascadia', kind: 'repo' });

const h = vi.hoisted(() => ({
  store: {
    githubStatus: null as null | Record<string, unknown>,
    refreshGithubStatus: vi.fn(),
    publishFirstLap: vi.fn(),
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof h.store) => T) => selector(h.store),
}));
vi.mock('../../integrations/github/GithubFormBody', () => ({
  GithubFormBody: () => <div>github connect form</div>,
}));

import { PublishPanel } from './index';

const connected = { available: true, mode: 'gh-cli', user: 'dana-reyes' };

beforeEach(() => {
  h.store.githubStatus = connected;
  h.store.refreshGithubStatus.mockReset();
  h.store.refreshGithubStatus.mockResolvedValue(undefined);
  h.store.publishFirstLap.mockReset();
  h.store.publishFirstLap.mockResolvedValue({
    kind: 'published',
    branch: 'main',
    remoteUrl: 'https://github.com/dana-reyes/cascadia',
  });
});

afterEach(cleanup);

const renderPanel = (props: { primaryLabel?: string } = {}) => {
  const onPublished = vi.fn();
  const onCancel = vi.fn();
  render(
    <PublishPanel project={project} onPublished={onPublished} onCancel={onCancel} {...props} />,
  );
  return { onPublished, onCancel };
};

describe('PublishPanel on GitHub', () => {
  it('needs an explicit visibility before it can publish', async () => {
    const { onPublished } = renderPanel();
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(screen.getByText('Connected as dana-reyes')).toBeDefined();
    expect(publish).toHaveProperty('disabled', true);
    expect(
      screen.getByText('Pick who can see the repository. Goodboy does not choose for you.'),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));
    expect(publish).toHaveProperty('disabled', false);
    fireEvent.click(publish);

    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(h.store.publishFirstLap).toHaveBeenCalledWith({
      projectId: project.id,
      remote: { kind: 'github', name: 'cascadia', visibility: 'private', owner: 'dana-reyes' },
    });
  });

  it('shows a name problem and blocks the button', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('radio', { name: 'Public' }));

    fireEvent.change(screen.getByLabelText('Repository name'), { target: { value: 'my game' } });

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Publish' })).toHaveProperty('disabled', true);
  });

  it('says when GitHub is not signed in and offers the connect form', () => {
    h.store.githubStatus = { available: true, mode: 'absent', user: null };
    renderPanel();

    expect(screen.getByText('github connect form')).toBeDefined();
    expect(screen.queryByLabelText('Repository name')).toBeNull();
  });

  it('says when the command line tool is missing and still lets an address through', () => {
    h.store.githubStatus = { available: false, mode: 'absent', user: null };
    renderPanel();

    expect(screen.getByText(/command line tool isn't installed/)).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Use an existing repository' }));
    expect(screen.getByLabelText('Repository address')).toBeDefined();
  });

  it('reads the status once when it is not known yet', () => {
    h.store.githubStatus = null;
    renderPanel();

    expect(h.store.refreshGithubStatus).toHaveBeenCalledTimes(1);
  });

  it('labels the primary action when the work will move too', () => {
    renderPanel({ primaryLabel: 'Publish and move my work' });

    expect(screen.getByRole('button', { name: 'Publish and move my work' })).toBeDefined();
  });
});

describe('PublishPanel with an address', () => {
  const openAddress = () => {
    renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: 'Use an existing repository' }));
  };

  it('publishes to the trimmed address', async () => {
    openAddress();
    fireEvent.change(screen.getByLabelText('Repository address'), {
      target: { value: ' git@gitlab.example.com:dana/cascadia.git ' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() =>
      expect(h.store.publishFirstLap).toHaveBeenCalledWith({
        projectId: project.id,
        remote: { kind: 'address', url: 'git@gitlab.example.com:dana/cascadia.git' },
      }),
    );
  });

  it('names the failed step, keeps the repository address and publishes again from it', async () => {
    h.store.publishFirstLap.mockResolvedValueOnce({
      kind: 'failed',
      step: 'push',
      message: 'remote: Permission denied',
      remoteUrl: 'https://github.com/dana-reyes/cascadia',
    });
    const { onPublished } = renderPanel();
    fireEvent.click(screen.getByRole('radio', { name: 'Private' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('Publishing main failed')).toBeDefined();
    expect(
      screen.getByText(
        /The repository exists at https:\/\/github.com\/dana-reyes\/cascadia and was not removed/,
      ),
    ).toBeDefined();
    expect(onPublished).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Publish again' }));
    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));
    expect(h.store.publishFirstLap).toHaveBeenLastCalledWith({
      projectId: project.id,
      remote: { kind: 'address', url: 'https://github.com/dana-reyes/cascadia' },
    });
  });

  it('says nothing was pushed when the remote already has main', async () => {
    h.store.publishFirstLap.mockResolvedValue({
      kind: 'remote-has-main',
      branch: 'main',
      remoteUrl: 'https://github.com/dana-reyes/cascadia',
    });
    const { onPublished } = renderPanel();
    fireEvent.click(screen.getByRole('tab', { name: 'Use an existing repository' }));
    fireEvent.change(screen.getByLabelText('Repository address'), {
      target: { value: 'https://github.com/dana-reyes/cascadia' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(await screen.findByText('That repository already has main')).toBeDefined();
    expect(onPublished).toHaveBeenCalledTimes(1);
  });
});
