// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

type Script = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly body: string;
};

type RunRecord = {
  readonly status: 'idle' | 'pending' | 'ok' | 'error' | 'cancelled';
  readonly result: { stdout: string; stderr: string; exitCode: number } | null;
  readonly runId: string;
};

type ManifestGroup = {
  readonly source: 'package-json' | 'composer';
  readonly packageName: string;
  readonly relDir: string;
  readonly manager: string;
  readonly scripts: ReadonlyArray<{ readonly name: string; readonly command: string }>;
};

const apiProject = {
  id: 'project-1',
  workspaceId: 'ws-1',
  name: 'API',
  rootPath: '/srv/workspaces/code/acme/api',
};
const webProject = {
  id: 'project-2',
  workspaceId: 'ws-1',
  name: 'Web',
  rootPath: '/srv/workspaces/code/acme/web',
};

const { state } = vi.hoisted(() => ({
  state: {
    scripts: [] as ReadonlyArray<Script>,
    projects: [] as ReadonlyArray<{
      id: string;
      workspaceId: string;
      name: string;
      rootPath: string;
    }>,
    sessions: [{ id: 'session-1', activeProjectId: 'project-1' }],
    sessionActiveProject: { 'session-1': 'project-1' } as Record<string, string>,
    sessionProjectMounts: {} as Record<
      string,
      ReadonlyArray<{ projectId: string; worktreePath: string }>
    >,
    scriptRuns: {} as Record<string, Record<string, RunRecord>>,
    discoveredScripts: {} as Record<string, Record<string, ReadonlyArray<ManifestGroup>>>,
    discoveredScriptScans: {} as Record<
      string,
      Record<string, { status: 'loading' | 'ready' | 'error'; error: string | null }>
    >,
    loadScripts: vi.fn(async () => undefined),
    saveScript: vi.fn(async () => undefined),
    deleteScript: vi.fn(async () => undefined),
    runScript: vi.fn(async () => undefined),
    cancelScript: vi.fn(async () => undefined),
    loadDiscoveredScripts: vi.fn(async () => undefined),
    refreshDiscoveredScripts: vi.fn(async () => undefined),
    runDiscoveredScript: vi.fn(async () => undefined),
    scriptsLensScope: null as { readonly projectId: string } | null,
    setScriptsLensScope: vi.fn(),
  },
}));

vi.mock('../../../../store', () => {
  const getStoreState = () => ({
    projectScripts: { 'ws-1': state.scripts },
    projects: state.projects,
    sessions: state.sessions,
    sessionActiveProject: state.sessionActiveProject,
    sessionProjectMounts: state.sessionProjectMounts,
    scriptRuns: { 'session-1': state.scriptRuns['session-1'] ?? {} },
    discoveredScripts: state.discoveredScripts,
    discoveredScriptScans: state.discoveredScriptScans,
    loadScripts: state.loadScripts,
    saveScript: state.saveScript,
    deleteScript: state.deleteScript,
    runScript: state.runScript,
    cancelScript: state.cancelScript,
    loadDiscoveredScripts: state.loadDiscoveredScripts,
    refreshDiscoveredScripts: state.refreshDiscoveredScripts,
    runDiscoveredScript: state.runDiscoveredScript,
    scriptsLensScope: state.scriptsLensScope,
    setScriptsLensScope: state.setScriptsLensScope,
  });
  const useAppStore = <T,>(selector: (storeState: ReturnType<typeof getStoreState>) => T) =>
    selector(getStoreState());
  useAppStore.getState = getStoreState;
  return { useAppStore };
});

import { ScriptsPanel } from './index';

const renderPanel = () =>
  render(<ScriptsPanel workspaceId={'ws-1' as never} sessionId={'session-1' as never} />);

const renderSettingsPanel = () => render(<ScriptsPanel workspaceId={'ws-1' as never} />);

const rail = () => screen.getByRole('navigation', { name: 'Script projects' });

const manifestSection = () => screen.getByRole('region', { name: 'Manifest scripts' });

const manifestRail = () => screen.getByRole('navigation', { name: 'Manifest packages' });

const headings = () =>
  Array.from(manifestSection().querySelectorAll('span[role="heading"]')).map(
    (heading) => heading.textContent,
  );

const searchBox = () => screen.getByRole('searchbox', { name: 'Search scripts' });

beforeEach(() => {
  localStorage.clear();
  state.scripts = [];
  state.projects = [apiProject];
  state.sessions = [{ id: 'session-1', activeProjectId: 'project-1' }];
  state.sessionActiveProject = { 'session-1': 'project-1' };
  state.sessionProjectMounts = {
    'session-1': [{ projectId: 'project-1', worktreePath: '/tmp/api' }],
  };
  state.scriptRuns = {};
  state.discoveredScripts = {};
  state.discoveredScriptScans = {
    'session-1': { '/tmp/api': { status: 'ready', error: null } },
  };
  state.loadScripts = vi.fn(async () => undefined);
  state.saveScript = vi.fn(async () => undefined);
  state.deleteScript = vi.fn(async () => undefined);
  state.runScript = vi.fn(async () => undefined);
  state.cancelScript = vi.fn(async () => undefined);
  state.loadDiscoveredScripts = vi.fn(async () => undefined);
  state.refreshDiscoveredScripts = vi.fn(async () => undefined);
  state.runDiscoveredScript = vi.fn(async () => undefined);
  state.scriptsLensScope = null;
  state.setScriptsLensScope = vi.fn();
});

afterEach(cleanup);

const withTwoProjects = () => {
  state.projects = [webProject, apiProject];
  state.sessionProjectMounts = {
    'session-1': [
      { projectId: 'project-1', worktreePath: '/tmp/api' },
      { projectId: 'project-2', worktreePath: '/tmp/web' },
    ],
  };
  state.discoveredScriptScans = {
    'session-1': {
      '/tmp/api': { status: 'ready', error: null },
      '/tmp/web': { status: 'ready', error: null },
    },
  };
};

describe('ScriptsPanel', () => {
  it('loads scripts and renders the empty hint when no project has scripts', () => {
    renderSettingsPanel();

    expect(state.loadScripts).toHaveBeenCalledWith('ws-1');
    expect(screen.getByText(/no scripts yet/i)).toBeDefined();
    expect(screen.getAllByRole('button', { name: /new script/i }).length).toBe(1);
  });

  it('lists one rail row per project with its counts', () => {
    withTwoProjects();
    state.scripts = [
      { id: 's1', projectId: 'project-1', name: 'setup api', body: 'echo api' },
      { id: 's2', projectId: 'project-1', name: 'sync api', body: 'echo sync' },
    ];
    state.discoveredScripts = {
      'session-1': {
        '/tmp/api': [
          {
            source: 'package-json',
            packageName: 'api',
            relDir: '',
            manager: 'pnpm',
            scripts: [
              { name: 'dev', command: 'pnpm dev' },
              { name: 'build', command: 'pnpm build' },
            ],
          },
        ],
        '/tmp/web': [
          {
            source: 'package-json',
            packageName: 'web',
            relDir: '',
            manager: 'pnpm',
            scripts: [{ name: 'dev', command: 'pnpm dev' }],
          },
        ],
      },
    };

    renderPanel();

    const rows = within(rail()).getAllByRole('button');
    expect(rows.map((row) => row.textContent)).toEqual([
      'API2 yours · 2 manifest',
      'Web1 manifest',
    ]);
    expect(rows[0]?.getAttribute('aria-current')).toBe('true');
  });

  it('hides the rail when a single project qualifies', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];

    renderPanel();

    expect(screen.queryByRole('navigation', { name: 'Script projects' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'API' })).toBeDefined();
  });

  it('shortens a long project root path in the header', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];

    renderPanel();

    expect(screen.getByText('…/code/acme/api')).toBeDefined();
  });

  it('switches the content when another project is picked in the rail', () => {
    withTwoProjects();
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup api', body: 'echo api' }];

    renderPanel();
    expect(screen.getByText('setup api')).toBeDefined();

    fireEvent.click(within(rail()).getByRole('button', { name: /Web/ }));

    expect(screen.getByRole('heading', { level: 2, name: 'Web' })).toBeDefined();
    expect(screen.queryByText('setup api')).toBeNull();
    expect(screen.getByText('No scripts for Web yet')).toBeDefined();
  });

  it('preselects the scoped project and then clears the scope', () => {
    withTwoProjects();
    state.scriptsLensScope = { projectId: 'project-2' };
    state.scripts = [
      { id: 's1', projectId: 'project-1', name: 'setup api', body: 'echo api' },
      { id: 's2', projectId: 'project-2', name: 'deploy web', body: 'echo web' },
    ];

    renderPanel();

    expect(screen.getByRole('heading', { level: 2, name: 'Web' })).toBeDefined();
    expect(screen.getByText('deploy web')).toBeDefined();
    expect(screen.queryByText('setup api')).toBeNull();
    expect(state.setScriptsLensScope).toHaveBeenCalledWith({ scope: null });
  });

  it('falls back to the session active project when nothing is scoped or stored', () => {
    withTwoProjects();
    state.sessionActiveProject = { 'session-1': 'project-2' };

    renderPanel();

    expect(screen.getByRole('heading', { level: 2, name: 'Web' })).toBeDefined();
  });

  it('remembers the last picked project of the workspace', () => {
    withTwoProjects();

    const first = renderPanel();
    fireEvent.click(within(rail()).getByRole('button', { name: /Web/ }));
    first.unmount();

    renderPanel();

    expect(screen.getByRole('heading', { level: 2, name: 'Web' })).toBeDefined();
  });

  it('shows a running dot on the rail row of a project with a pending run', () => {
    withTwoProjects();
    state.scripts = [{ id: 's1', projectId: 'project-2', name: 'deploy web', body: 'echo web' }];
    state.scriptRuns = {
      'session-1': { s1: { status: 'pending', result: null, runId: 'run-1' } },
    };

    renderPanel();

    expect(within(rail()).getByRole('img', { name: 'Running script in Web' })).toBeDefined();
    expect(within(rail()).queryByRole('img', { name: 'Running script in API' })).toBeNull();
  });

  it('lists manifests in a rail, root first, and shows the selected one', () => {
    state.discoveredScripts = {
      'session-1': {
        '/tmp/api': [
          {
            source: 'package-json',
            packageName: '@acme/web',
            relDir: 'apps/web',
            manager: 'pnpm',
            scripts: [{ name: 'dev', command: 'pnpm run dev' }],
          },
          {
            source: 'package-json',
            packageName: 'root',
            relDir: '',
            manager: 'pnpm',
            scripts: [{ name: 'build', command: 'pnpm run build' }],
          },
          {
            source: 'composer',
            packageName: 'acme/api',
            relDir: '',
            manager: 'composer',
            scripts: [{ name: 'test-php', command: 'composer run-script test-php' }],
          },
        ],
      },
    };

    renderPanel();

    const packages = within(manifestRail()).getAllByRole('button');
    expect(packages.map((row) => row.textContent)).toEqual([
      expect.stringContaining('root'),
      expect.stringContaining('@acme/web'),
      expect.stringContaining('acme/api'),
    ]);
    expect(packages[0]?.getAttribute('aria-current')).toBe('true');
    expect(headings()).toEqual(['root']);

    fireEvent.click(within(manifestRail()).getByRole('button', { name: /@acme\/web/ }));

    expect(headings()).toEqual(['@acme/web']);
    expect(
      within(manifestRail())
        .getByRole('button', { name: /@acme\/web/ })
        .getAttribute('aria-current'),
    ).toBe('true');
  });

  it('remembers the manifest picked for each project', () => {
    withTwoProjects();
    state.discoveredScripts = {
      'session-1': {
        '/tmp/api': [
          {
            source: 'package-json',
            packageName: 'root',
            relDir: '',
            manager: 'pnpm',
            scripts: [{ name: 'build', command: 'pnpm run build' }],
          },
          {
            source: 'package-json',
            packageName: '@acme/web',
            relDir: 'apps/web',
            manager: 'pnpm',
            scripts: [{ name: 'dev', command: 'pnpm run dev' }],
          },
        ],
      },
    };

    renderPanel();

    fireEvent.click(within(manifestRail()).getByRole('button', { name: /@acme\/web/ }));
    expect(headings()).toEqual(['@acme/web']);

    fireEvent.click(within(rail()).getByRole('button', { name: /Web/ }));
    fireEvent.click(within(rail()).getByRole('button', { name: /API/ }));

    expect(headings()).toEqual(['@acme/web']);
  });

  it('hides the manifest rail when a project has a single manifest', () => {
    state.discoveredScripts = {
      'session-1': {
        '/tmp/api': [
          {
            source: 'package-json',
            packageName: 'api',
            relDir: '',
            manager: 'pnpm',
            scripts: [{ name: 'dev', command: 'pnpm run dev' }],
          },
        ],
      },
    };

    renderPanel();

    expect(screen.queryByRole('navigation', { name: 'Manifest packages' })).toBeNull();
    expect(headings()).toEqual(['api']);
  });

  it('summarises a package with a category strip and groups its scripts by category', () => {
    state.discoveredScripts = {
      'session-1': {
        '/tmp/api': [
          {
            source: 'package-json',
            packageName: 'root',
            relDir: '',
            manager: 'pnpm',
            scripts: [
              { name: 'lint', command: 'eslint .' },
              { name: 'sync-assets', command: 'rsync -a assets/' },
              { name: 'dev', command: 'vite' },
              { name: 'test:unit', command: 'vitest run' },
              { name: 'test:types', command: 'tsc --noEmit' },
              { name: 'build', command: 'vite build' },
            ],
          },
        ],
      },
    };

    renderPanel();

    const pkg = within(screen.getByRole('region', { name: 'root scripts' }));
    expect(pkg.getByTestId('category-strip-test').textContent).toBe('1');
    expect(pkg.getByTestId('category-strip-typecheck').textContent).toBe('1');
    expect(pkg.queryByTestId('category-strip-deploy')).toBeNull();
    expect(pkg.getAllByRole('region').map((section) => section.getAttribute('aria-label'))).toEqual(
      [
        'Dev scripts',
        'Build scripts',
        'Test scripts',
        'Lint scripts',
        'Typecheck scripts',
        'Other scripts',
      ],
    );
    expect(within(pkg.getByRole('region', { name: 'Test scripts' })).getByText('test:unit'));
    expect(
      within(pkg.getByRole('region', { name: 'Typecheck scripts' })).getByText('test:types'),
    ).toBeDefined();
  });

  it('runs a manifest script from its package directory', () => {
    state.discoveredScripts = {
      'session-1': {
        '/tmp/api': [
          {
            source: 'package-json',
            packageName: '@acme/web',
            relDir: 'apps/web',
            manager: 'pnpm',
            scripts: [{ name: 'dev', command: 'pnpm run dev' }],
          },
        ],
      },
    };

    renderPanel();

    expect(state.loadDiscoveredScripts).toHaveBeenCalledWith({
      sessionId: 'session-1',
      worktreePath: '/tmp/api',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run dev' }));

    expect(state.runDiscoveredScript).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        name: 'dev',
        command: 'pnpm run dev',
        cwd: '/tmp/api/apps/web',
      }),
    );
  });

  it('reattaches a discovered run to its manifest row and stops it through the shared registry', () => {
    const scriptId = JSON.stringify(['/tmp/api', 'package-json', '', 'dev']);
    state.discoveredScripts = {
      'session-1': {
        '/tmp/api': [
          {
            source: 'package-json',
            packageName: 'api',
            relDir: '',
            manager: 'pnpm',
            scripts: [{ name: 'dev', command: 'pnpm run dev' }],
          },
        ],
      },
    };
    state.scriptRuns = {
      'session-1': {
        [scriptId]: { status: 'pending', result: null, runId: 'run-live' },
      },
    };

    renderPanel();

    expect(screen.getByTestId(`discovered-script-${scriptId}`).dataset.status).toBe('pending');
    fireEvent.click(screen.getByRole('button', { name: 'Stop dev' }));
    expect(state.cancelScript).toHaveBeenCalledWith('session-1', scriptId);
  });

  it('shows manifest scan loading, empty, and error states quietly', () => {
    state.discoveredScriptScans = {
      'session-1': { '/tmp/api': { status: 'loading', error: null } },
    };
    const { rerender } = render(
      <ScriptsPanel workspaceId={'ws-1' as never} sessionId={'session-1' as never} />,
    );
    expect(screen.getByText('Scanning project manifests…')).toBeDefined();

    state.discoveredScriptScans = {
      'session-1': { '/tmp/api': { status: 'ready', error: null } },
    };
    rerender(<ScriptsPanel workspaceId={'ws-1' as never} sessionId={'session-1' as never} />);
    expect(screen.getByText('No manifest scripts found.')).toBeDefined();

    state.discoveredScriptScans = {
      'session-1': { '/tmp/api': { status: 'error', error: 'manifest scan failed' } },
    };
    rerender(<ScriptsPanel workspaceId={'ws-1' as never} sessionId={'session-1' as never} />);
    expect(screen.getByText('manifest scan failed')).toBeDefined();
  });

  it('refreshes only the mount of the selected project', () => {
    withTwoProjects();

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh API manifest scripts' }));
    expect(state.refreshDiscoveredScripts).toHaveBeenCalledWith({
      sessionId: 'session-1',
      worktreePath: '/tmp/api',
    });

    fireEvent.click(within(rail()).getByRole('button', { name: /Web/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Web manifest scripts' }));
    expect(state.refreshDiscoveredScripts).toHaveBeenLastCalledWith({
      sessionId: 'session-1',
      worktreePath: '/tmp/web',
    });
  });

  it('explains a project that is not mounted in this session', () => {
    withTwoProjects();
    state.sessionProjectMounts = {
      'session-1': [{ projectId: 'project-1', worktreePath: '/tmp/api' }],
    };
    state.scripts = [{ id: 's2', projectId: 'project-2', name: 'deploy web', body: 'echo web' }];

    renderPanel();
    fireEvent.click(within(rail()).getByRole('button', { name: /Web/ }));

    expect(screen.getByText('This project is not mounted in this session.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Expand deploy web' }));
    expect(screen.getByText('Web is not mounted in this session')).toBeDefined();
    expect((screen.getByRole('button', { name: 'Run script' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('filters both sections, expands matching packages, and counts matches elsewhere', () => {
    withTwoProjects();
    state.scripts = [
      { id: 's1', projectId: 'project-1', name: 'deploy user', body: 'ship production' },
      { id: 's2', projectId: 'project-1', name: 'lint user', body: 'eslint .' },
      { id: 's3', projectId: 'project-2', name: 'deploy web', body: 'ship web' },
    ];
    state.discoveredScripts = {
      'session-1': {
        '/tmp/api': [
          {
            source: 'package-json',
            packageName: 'root',
            relDir: '',
            manager: 'pnpm',
            scripts: [{ name: 'build', command: 'pnpm run build' }],
          },
          {
            source: 'package-json',
            packageName: '@acme/web',
            relDir: 'apps/web',
            manager: 'pnpm',
            scripts: [{ name: 'deploy manifest', command: 'ship preview' }],
          },
        ],
      },
    };

    renderPanel();

    expect(headings()).toEqual(['root']);
    fireEvent.change(searchBox(), { target: { value: 'deploy' } });

    expect(screen.getByText('deploy user')).toBeDefined();
    expect(screen.queryByText('lint user')).toBeNull();
    expect(headings()).toEqual(['@acme/web']);
    expect(screen.getByText('deploy manifest')).toBeDefined();
    expect(within(manifestRail()).getByText('1 match')).toBeDefined();
    expect(within(manifestRail()).getByText('0 matches')).toBeDefined();
    expect(
      within(manifestRail())
        .getByRole('button', { name: /@acme\/web/ })
        .getAttribute('aria-current'),
    ).toBe('true');
    expect(within(rail()).getByText('1 match')).toBeDefined();

    fireEvent.keyDown(searchBox(), { key: 'Escape' });
    expect(headings()).toEqual(['root']);
    expect(screen.getByText('lint user')).toBeDefined();
  });

  it('offers to clear a search that matches nothing', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];

    renderPanel();
    fireEvent.change(searchBox(), { target: { value: 'nothing here' } });

    expect(screen.getByText('No scripts match')).toBeDefined();
    expect(screen.getByText('No matching scripts here')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('setup')).toBeDefined();
  });

  it('hides the manifest section outside a session', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];

    renderSettingsPanel();

    expect(screen.queryByRole('region', { name: 'Manifest scripts' })).toBeNull();
    expect(screen.queryByRole('searchbox', { name: 'Search scripts' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Your scripts' })).toBeDefined();
  });

  it('creates a new script in an inline card', async () => {
    state.saveScript = vi.fn(async () => {
      state.scripts = [
        { id: 's1', projectId: 'project-1', name: 'copy env', body: 'cp ../main/.env .env' },
      ];
    });
    renderSettingsPanel();

    fireEvent.click(screen.getByRole('button', { name: /new script/i }));
    fireEvent.change(screen.getByPlaceholderText(/script name/i), {
      target: { value: 'copy env' },
    });
    fireEvent.change(screen.getByPlaceholderText(/cp \.\.\/main\/\.env/i), {
      target: { value: 'cp ../main/.env .env' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });

    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: 'project-1',
      id: undefined,
      name: 'copy env',
      body: 'cp ../main/.env .env',
    });
    expect(screen.queryByPlaceholderText(/script name/i)).toBeNull();
    expect(screen.getByTestId('script-card-s1')).toBeDefined();
    expect(screen.getByText('cp ../main/.env .env')).toBeDefined();
  });

  it('defaults a new script to the selected project and allows reassignment while editing', async () => {
    withTwoProjects();
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    renderPanel();

    fireEvent.click(within(rail()).getByRole('button', { name: /Web/ }));
    fireEvent.click(screen.getByRole('button', { name: /new script/i }));
    expect(
      (screen.getByRole('combobox', { name: 'New script project' }) as HTMLSelectElement).value,
    ).toBe('project-2');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(within(rail()).getByRole('button', { name: /API/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit script' }));
    await act(async () => {
      fireEvent.change(screen.getByRole('combobox', { name: 'Edit script project' }), {
        target: { value: 'project-2' },
      });
    });

    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: 'project-2',
      id: 's1',
      name: 'setup',
      body: 'echo hi',
    });
  });

  it('expands an existing script in place with its full command', () => {
    state.scripts = [
      { id: 's1', projectId: 'project-1', name: 'setup', body: '#!/bin/bash\necho hi' },
    ];
    renderSettingsPanel();

    expect(screen.getByText('+1 line')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Expand setup' }));

    expect(screen.getByTestId('script-card-s1').className).toContain('bg-muted/20');
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'PRE' && element.textContent === '#!/bin/bash\necho hi',
      ),
    ).toBeDefined();
  });

  it('edits an existing command inline and commits on blur', async () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    renderSettingsPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Edit script' }));
    const textarea = screen.getByRole('textbox', { name: 'Edit setup command' });
    fireEvent.change(textarea, { target: { value: 'echo hi again' } });
    await act(async () => {
      fireEvent.blur(textarea);
    });

    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: 'project-1',
      id: 's1',
      name: 'setup',
      body: 'echo hi again',
    });
  });

  it('edits an existing script name inline and commits with Cmd+Enter', async () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    renderSettingsPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Expand setup' }));
    fireEvent.click(screen.getByRole('button', { name: 'setup' }));
    const nameInput = screen.getByRole('textbox', { name: 'Edit script name' });
    fireEvent.change(nameInput, { target: { value: 'bootstrap' } });
    await act(async () => {
      fireEvent.keyDown(nameInput, { key: 'Enter', metaKey: true });
    });

    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      projectId: 'project-1',
      id: 's1',
      name: 'bootstrap',
      body: 'echo hi',
    });
  });

  it('keeps the discard guard for an unfinished new script', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    renderSettingsPanel();

    fireEvent.click(screen.getByRole('button', { name: /new script/i }));
    fireEvent.change(screen.getByPlaceholderText(/script name/i), {
      target: { value: 'unfinished' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Expand setup' }));

    expect(screen.getByText(/unsaved changes/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByPlaceholderText(/script name/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Collapse setup' })).toBeDefined();
  });

  it('deletes a script through its lifecycle action after confirmation', async () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    renderSettingsPanel();

    const lifecycleSlot = screen.getByRole('group', { name: 'Script lifecycle actions' });
    const deleteAction = screen.getByRole('button', { name: 'Delete script' });
    expect(lifecycleSlot.contains(deleteAction)).toBe(true);
    fireEvent.click(deleteAction);
    expect(state.deleteScript).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Delete "setup"?' })).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete setup' }));
    });

    expect(state.deleteScript).toHaveBeenCalledWith('s1', 'ws-1');
  });

  it('runs a user script without expanding it', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Run script' }));
    expect(state.runScript).toHaveBeenCalledWith({ sessionId: 'session-1', scriptId: 's1' });
    expect(screen.getByRole('button', { name: 'Expand setup' })).toBeDefined();
  });

  it('shows the last run output inside an expanded card', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    state.scriptRuns = {
      'session-1': {
        s1: {
          status: 'ok',
          result: { stdout: 'completed output', stderr: '', exitCode: 0 },
          runId: 'run-1',
        },
      },
    };
    renderPanel();

    expect(screen.queryByText('completed output')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand setup' }));
    expect(screen.getByText('Last run')).toBeDefined();
    expect(screen.getByText('completed output')).toBeDefined();
  });

  it('renders an idle script row with no status border accent', () => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    renderPanel();

    const row = screen.getByTestId('script-card-s1');
    expect(row.className).toContain('border-transparent');
    expect(row.className).toContain('bg-card/40');
    expect(row.className).not.toContain('bg-muted/20');
    expect(row.className).not.toContain('border-info/50');
    expect(row.querySelector('[aria-label="Running"]')).toBeNull();
  });

  it.each([
    ['pending', 'border-info/50', 'motion-safe:animate-pulse'],
    ['ok', 'border-success/40', null],
    ['error', 'border-danger/40', null],
    ['cancelled', 'border-border', null],
  ] as const)('uses the %s run state for the row border', (status, borderClass, pulseClass) => {
    state.scripts = [{ id: 's1', projectId: 'project-1', name: 'setup', body: 'echo hi' }];
    state.scriptRuns = {
      'session-1': {
        s1: {
          status,
          result: status === 'pending' ? null : { stdout: '', stderr: '', exitCode: 0 },
          runId: 'run-1',
        },
      },
    };
    renderPanel();

    const row = screen.getByTestId('script-card-s1');
    expect(row.className).toContain(borderClass);
    if (pulseClass !== null) {
      expect(row.className).toContain(pulseClass);
    }
    if (status === 'pending') {
      expect(row.querySelector('[aria-label="Running"]')).not.toBeNull();
      return;
    }
    expect(row.querySelector('[aria-label="Running"]')).toBeNull();
  });

  it('sorts user scripts alphabetically inside the selected project', () => {
    state.scripts = [
      { id: 's2', projectId: 'project-1', name: 'zebra', body: 'echo z' },
      { id: 's1', projectId: 'project-1', name: 'Alpha', body: 'echo a' },
    ];
    renderSettingsPanel();

    expect(
      within(screen.getByRole('region', { name: 'Your scripts' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([expect.stringContaining('Alpha'), expect.stringContaining('zebra')]);
  });
});
