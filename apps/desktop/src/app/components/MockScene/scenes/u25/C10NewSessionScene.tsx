import { useEffect } from 'react';
import type { Project, ProjectId } from '@goodboy/types';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { useAppStore } from '../../../../../store';
import { EMPTY_SESSION_DRAFT } from '../../../../../store/slices/sessionDraft/state';
import type { StartChoice } from '../../../../../store/slices/sessionDraft/state';
import { sceneClock } from '../../sceneClock';
import { SETTINGS_PROVIDERS } from '../audit/settingsSeed';
import { WORKSPACE_ID } from '../BoardScene';
import { NewSessionPageScene } from '../u24/NewSessionPageScene';

export type C10PageState = {
  readonly choice: StartChoice;
  readonly isAuto?: boolean;
  readonly isPreset?: boolean;
  readonly goal: string;
};

export type C10SceneState = {
  readonly page: C10PageState;
  readonly projectNames: ReadonlyArray<string>;
  readonly hasManyProjects?: boolean;
  readonly isPickerOpen?: boolean;
  readonly startFailure?: string;
  readonly clickLabel?: string;
  readonly openPrefix?: string;
  readonly hasConnectedProviders?: boolean;
};

type Props = {
  readonly state: C10SceneState;
};

const clock = sceneClock({ anchor: '2026-10-14T09:00:00.000Z' });

const ORGS = ['harborline', 'northwind', 'acme', 'cascadia'] as const;

const MANY_PROJECT_COUNT = 47;

const PICKER_QUERY = 'pay';

const STEP_DELAY_MS = 250;

type TemplateParams = {
  readonly template: Project;
};

const extraProjects = ({ template }: TemplateParams): ReadonlyArray<Project> =>
  Array.from({ length: MANY_PROJECT_COUNT }, (_, index) => {
    const org = ORGS[index % ORGS.length] ?? 'harborline';
    const name = `${org}-service-${String(index + 1).padStart(2, '0')}`;
    return {
      ...template,
      id: brandedId<ProjectId>({ value: `mock-c10-project-${name}` }),
      name,
      rootPath: `~/code/${org}/${name}`,
      createdAt: clock.iso({ at: '2026-09-14T09:00:00.000Z' }),
      updatedAt: clock.iso({ at: '2026-09-20T09:00:00.000Z' }),
    };
  });

type NamesParams = {
  readonly names: ReadonlyArray<string>;
};

const projectIdsNamed = ({ names }: NamesParams): ReadonlyArray<ProjectId> => {
  const projects = useAppStore.getState().projects;
  return names.flatMap((name) =>
    projects.filter((project) => project.name === name).map((project) => project.id),
  );
};

type TypeParams = {
  readonly input: HTMLInputElement;
  readonly text: string;
};

const typeInto = ({ input, text }: TypeParams): void => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const seedProjects = ({ state }: Props): void => {
  const [template] = useAppStore
    .getState()
    .projects.filter((project) => project.workspaceId === WORKSPACE_ID);
  if (state.hasManyProjects === true && template !== undefined) {
    useAppStore.setState((current) => ({
      projects: [...current.projects, ...extraProjects({ template })],
    }));
  }
  if (state.hasConnectedProviders === true) {
    useAppStore.setState({ providers: SETTINGS_PROVIDERS });
  }
  const draft = useAppStore.getState().sessionDrafts[WORKSPACE_ID] ?? EMPTY_SESSION_DRAFT;
  useAppStore.setState((current) => ({
    sessionDrafts: {
      ...current.sessionDrafts,
      [WORKSPACE_ID]: { ...draft, projectIds: projectIdsNamed({ names: state.projectNames }) },
    },
  }));
  if (state.startFailure === undefined) {
    return;
  }
  const failure = state.startFailure;
  useAppStore.setState({
    createSession: async () => {
      throw new Error(failure);
    },
  });
};

export const C10NewSessionScene = ({ state }: Props) => {
  useEffect(() => {
    seedProjects({ state });
  }, [state]);

  useEffect(() => {
    if (
      state.isPickerOpen !== true &&
      state.clickLabel === undefined &&
      state.openPrefix === undefined
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      if (state.openPrefix !== undefined) {
        const prefix = state.openPrefix;
        const chip = [...document.querySelectorAll('button')].find(
          (button) => button.getAttribute('aria-label')?.startsWith(prefix) === true,
        );
        if (chip === undefined) {
          return;
        }
        if (chip.getAttribute('aria-expanded') !== 'true') {
          chip.click();
        }
        window.clearInterval(timer);
        return;
      }
      if (state.clickLabel !== undefined) {
        const target = [...document.querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === state.clickLabel && !button.disabled,
        );
        if (target === undefined) {
          return;
        }
        target.click();
        window.clearInterval(timer);
        return;
      }
      const trigger = document.querySelector<HTMLElement>(
        '[role="combobox"][aria-label="Project"]',
      );
      if (trigger === null) {
        return;
      }
      if (trigger.getAttribute('aria-expanded') !== 'true') {
        trigger.click();
        return;
      }
      const search = document.querySelector<HTMLInputElement>(
        'input[aria-label="Search projects"]',
      );
      if (search === null) {
        return;
      }
      typeInto({ input: search, text: PICKER_QUERY });
      window.clearInterval(timer);
    }, STEP_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [state]);

  return <NewSessionPageScene state={state.page} />;
};
