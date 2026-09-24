// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AgentId, MountId, ProjectId, SessionId } from '@goodboy/types';
import type { WriteDestination } from '../../../../store/slices/project-mounts/writeDestination';

const { store, scratchDirPrepare } = vi.hoisted(() => ({
  scratchDirPrepare: vi.fn(async (_args: unknown) => '/goodboy/scratch/session-1'),
  store: {
    sessions: [] as ReadonlyArray<Record<string, unknown>>,
    sessionActiveMount: {} as Record<string, string | null>,
    sessionActiveProject: {} as Record<string, string>,
    sessionMounts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionProjectMounts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    projects: [] as ReadonlyArray<Record<string, unknown>>,
    agentTurnState: {} as Record<string, { kind: string }>,
    agentTurnDestination: {} as Record<string, WriteDestination>,
    setSessionActiveMount: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));
vi.mock('../../../../features/worktree/worktree', () => ({
  scratchDirPrepare: (args: unknown) => scratchDirPrepare(args),
}));
vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import { WriteDestinationControl } from './index';

const trigger = () =>
  screen.getByRole('button', { name: /Where turns start/ }) as HTMLButtonElement;

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const PROJECT_ID = 'project-web' as ProjectId;
const MOUNT_MAIN = 'mount-web-main' as MountId;
const MOUNT_FEATURE = 'mount-web-feature' as MountId;

const project = { id: PROJECT_ID, name: 'web', kind: 'repo' };

const mount = ({
  mountId,
  mountName,
  branch,
}: {
  readonly mountId: MountId;
  readonly mountName: string;
  readonly branch: string;
}) => ({
  mountId,
  projectId: PROJECT_ID,
  mountName,
  branch,
  worktreePath: `/sessions/one/${mountName}`,
  repoRoot: '/repos/web',
  isAttached: true,
});

const mountDestination = ({
  mountId,
  mountName,
  branch,
}: {
  readonly mountId: MountId;
  readonly mountName: string;
  readonly branch: string;
}): WriteDestination => ({
  kind: 'mount',
  mountId,
  projectId: PROJECT_ID,
  projectName: 'web',
  mountName,
  branch,
  worktreePath: `/sessions/one/${mountName}`,
  hasGit: true,
});

describe('WriteDestinationControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scratchDirPrepare.mockResolvedValue('/goodboy/scratch/session-1');
    store.sessions = [];
    store.sessionActiveMount = {};
    store.sessionActiveProject = {};
    store.sessionMounts = {};
    store.sessionProjectMounts = {};
    store.projects = [project];
    store.agentTurnState = {};
    store.agentTurnDestination = {};
  });
  afterEach(cleanup);

  it('shows the resolved mount as the working folder', () => {
    store.sessionProjectMounts = {
      [SESSION_ID]: [mount({ mountId: MOUNT_MAIN, mountName: 'main', branch: 'ak/feat-thing' })],
    };
    store.sessionActiveMount = { [SESSION_ID]: MOUNT_MAIN };

    render(<WriteDestinationControl sessionId={SESSION_ID} agentId={AGENT_ID} />);

    expect(trigger().textContent).toBe('Starts in web / main / ak/feat-thing');
    expect(
      screen.getByTitle('Starts in web / main / ak/feat-thing (/sessions/one/main).'),
    ).toBeDefined();
  });

  it('falls back to the session scratch folder when there are no mounted projects', async () => {
    render(<WriteDestinationControl sessionId={SESSION_ID} agentId={AGENT_ID} />);

    expect(trigger().textContent).toBe('Starts in session folder');
    expect(trigger().disabled).toBe(true);

    await waitFor(() => {
      expect(
        screen.getByTitle('Starts in session scratch folder (/goodboy/scratch/session-1).'),
      ).toBeDefined();
    });
  });

  it('shows the in-progress destination separately from a diverging next-turn pick', () => {
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        mount({ mountId: MOUNT_MAIN, mountName: 'main', branch: 'ak/feat-thing' }),
        mount({ mountId: MOUNT_FEATURE, mountName: 'feature', branch: 'ak/feat-other' }),
      ],
    };
    store.sessionActiveMount = { [SESSION_ID]: MOUNT_FEATURE };
    store.agentTurnState = { [AGENT_ID]: { kind: 'running' } };
    store.agentTurnDestination = {
      [AGENT_ID]: mountDestination({
        mountId: MOUNT_MAIN,
        mountName: 'main',
        branch: 'ak/feat-thing',
      }),
    };

    render(<WriteDestinationControl sessionId={SESSION_ID} agentId={AGENT_ID} />);

    expect(trigger().textContent).toBe('Running in web / main / ak/feat-thing');
    expect(screen.getByText('Next: web / feature / ak/feat-other')).toBeDefined();
  });

  it('combines in-progress and next turns when the running turn already matches', () => {
    store.sessionProjectMounts = {
      [SESSION_ID]: [mount({ mountId: MOUNT_MAIN, mountName: 'main', branch: 'ak/feat-thing' })],
    };
    store.sessionActiveMount = { [SESSION_ID]: MOUNT_MAIN };
    store.agentTurnState = { [AGENT_ID]: { kind: 'running' } };
    store.agentTurnDestination = {
      [AGENT_ID]: mountDestination({
        mountId: MOUNT_MAIN,
        mountName: 'main',
        branch: 'ak/feat-thing',
      }),
    };

    render(<WriteDestinationControl sessionId={SESSION_ID} agentId={AGENT_ID} />);

    expect(
      screen.getByTitle(
        'This turn runs in web / main / ak/feat-thing (/sessions/one/main). New turns start there too.',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/^Next:/)).toBeNull();
  });

  it('applies a picked mount only after the explicit session-wide action', async () => {
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        mount({ mountId: MOUNT_MAIN, mountName: 'main', branch: 'ak/feat-thing' }),
        mount({ mountId: MOUNT_FEATURE, mountName: 'feature', branch: 'ak/feat-other' }),
      ],
    };
    store.sessionActiveMount = { [SESSION_ID]: MOUNT_MAIN };

    render(<WriteDestinationControl sessionId={SESSION_ID} agentId={AGENT_ID} />);

    expect(
      screen.getByTitle(
        'Starts in web / main / ak/feat-thing (/sessions/one/main). Can also write in web / feature.',
      ),
    ).toBeDefined();
    fireEvent.click(trigger());
    expect(screen.getByText('New turns start in')).toBeDefined();
    expect(
      screen.getByText(
        'Every agent can write in all of them. This picks where a new turn opens its terminal, runs git and shows its pull request.',
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByText('web / feature'));
    expect(store.setSessionActiveMount).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Start new turns here' }));

    await waitFor(() => {
      expect(store.setSessionActiveMount).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        mountId: MOUNT_FEATURE,
      });
    });
  });
});

describe('WriteDestinationControl with siblings and no choice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scratchDirPrepare.mockResolvedValue('/goodboy/scratch/session-1');
    store.sessions = [];
    store.sessionActiveMount = {};
    store.sessionActiveProject = {};
    store.sessionMounts = {};
    store.projects = [project];
    store.agentTurnState = {};
    store.agentTurnDestination = {};
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        {
          ...mount({ mountId: MOUNT_MAIN, mountName: 'main', branch: 'ak/one' }),
          parallelIndex: 1,
        },
        {
          ...mount({ mountId: MOUNT_FEATURE, mountName: 'feature', branch: 'ak/two' }),
          parallelIndex: 2,
        },
      ],
    };
  });
  afterEach(cleanup);

  it('names the automatic mount instead of the scratch folder', () => {
    render(<WriteDestinationControl sessionId={SESSION_ID} agentId={AGENT_ID} />);

    expect(trigger().textContent).toBe('Starts in web / main / ak/one');
    expect(screen.queryByText(/scratch folder/)).toBeNull();
    expect(trigger().closest('[class*="warning"]')).toBeNull();
    expect(scratchDirPrepare).not.toHaveBeenCalled();
  });

  it('sets the chosen mount as the working folder of the next turns', async () => {
    render(<WriteDestinationControl sessionId={SESSION_ID} agentId={AGENT_ID} />);

    fireEvent.click(trigger());
    fireEvent.click(screen.getByText('web / feature'));
    fireEvent.click(screen.getByText('Start new turns here'));

    await waitFor(() =>
      expect(store.setSessionActiveMount).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        mountId: MOUNT_FEATURE,
      }),
    );
  });

  it('names the automatic mount while leaving the picker available', () => {
    store.sessionProjectMounts = {
      [SESSION_ID]: [
        {
          ...mount({ mountId: MOUNT_MAIN, mountName: 'main', branch: 'ak/one' }),
          parallelIndex: 2,
        },
        {
          ...mount({ mountId: MOUNT_FEATURE, mountName: 'feature', branch: 'ak/two' }),
          parallelIndex: 1,
        },
      ],
    };

    render(
      <WriteDestinationControl sessionId={SESSION_ID} agentId={AGENT_ID} fallback="automatic" />,
    );

    expect(trigger().textContent).toBe('Starts in web / feature / ak/two');
    expect(
      screen.getByTitle(
        'Starts in web / feature / ak/two (/sessions/one/feature). Picked automatically. Can also write in web / main.',
      ),
    ).toBeDefined();
    expect(trigger().disabled).toBe(false);
  });
});
