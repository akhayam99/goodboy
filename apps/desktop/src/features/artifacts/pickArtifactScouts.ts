import type { AgentId, ArtifactScoutPlanEntry, MountId } from '@goodboy/types';
import { FAN_OUT_MAX_CHILDREN } from '../../store/slices/workflows/scoutTree';
import type { ReportType } from '../reports/reportTypes';
import type { WireframeFidelity } from '../wireframes/wireframeFidelity';
import type { WireframeTarget } from '../wireframes/wireframeTarget';
import {
  ARTIFACT_SCOUT_ROLES,
  MERGED_SCOUT_NAME,
  MERGED_SCOUT_ROLE_ID,
  MOBILE_SCREENS_SENTENCE,
  type ArtifactScoutRole,
} from './artifactScoutRoles';

export const SESSION_SUMMARY_NO_SCOUT_REASON =
  'a session summary is written from the session itself, which is already stored, so no scout walks a repository';

export const NO_MOUNT_NO_SCOUT_REASON =
  'no repository was chosen to read, so this artifact is written from the evidence in the pack alone';

export const NO_DIFF_NO_SCOUT_REASON =
  'the diff touches none of the chosen repositories, so no scout walks one';

export const DESIGN_DIRECTORY_NAMES: ReadonlyArray<string> = [
  'tokens',
  'design-tokens',
  'theme',
  'themes',
  'design-system',
];

export const PROBE_REL_PATHS: ReadonlyArray<string> = ['', 'src'];

export type ArtifactScoutMount = Readonly<{
  mountId: MountId;
  label: string;
  root: string;
}>;

export type ArtifactScoutProbe = (
  params: Readonly<{ mountId: MountId; relPath: string }>,
) => Promise<ReadonlyArray<string>>;

export type ArtifactScoutPick = Readonly<{
  roleId: string;
  mountId: MountId;
  name: string;
  scope: string;
  root: string;
  reason: string;
}>;

export type ArtifactScoutRoster = Readonly<{
  picks: ReadonlyArray<ArtifactScoutPick>;
  note: string | null;
}>;

type Params = Readonly<{
  mounts: ReadonlyArray<ArtifactScoutMount>;
  probe: ArtifactScoutProbe;
}> &
  (
    | Readonly<{ kind: 'wireframe'; fidelity: WireframeFidelity; target: WireframeTarget }>
    | Readonly<{
        kind: 'report';
        reportType: ReportType;
        changedMountIds: ReadonlyArray<MountId>;
      }>
  );

const screensRole = ({ target }: Readonly<{ target: WireframeTarget }>): ArtifactScoutRole => {
  if (target !== 'mobile') {
    return ARTIFACT_SCOUT_ROLES.screens;
  }
  return {
    ...ARTIFACT_SCOUT_ROLES.screens,
    scope: `${ARTIFACT_SCOUT_ROLES.screens.scope} ${MOBILE_SCREENS_SENTENCE}`,
  };
};

const hasDesignDirectory = async ({
  mount,
  probe,
}: Readonly<{ mount: ArtifactScoutMount; probe: ArtifactScoutProbe }>): Promise<boolean> => {
  for (const relPath of PROBE_REL_PATHS) {
    const names = await probe({ mountId: mount.mountId, relPath }).catch(() => []);
    const found = names.some((name) => DESIGN_DIRECTORY_NAMES.includes(name.toLowerCase()));
    if (found) {
      return true;
    }
  }
  return false;
};

const wireframeRoles = async ({
  fidelity,
  target,
  mount,
  probe,
}: Readonly<{
  fidelity: WireframeFidelity;
  target: WireframeTarget;
  mount: ArtifactScoutMount;
  probe: ArtifactScoutProbe;
}>): Promise<ReadonlyArray<ArtifactScoutRole>> => {
  const base = [screensRole({ target }), ARTIFACT_SCOUT_ROLES.data];
  if (fidelity !== 'high') {
    return base;
  }
  const isDesignFound = await hasDesignDirectory({ mount, probe });
  return isDesignFound ? [...base, ARTIFACT_SCOUT_ROLES.design] : base;
};

const scoutName = ({
  name,
  mount,
  isLabelled,
}: Readonly<{ name: string; mount: ArtifactScoutMount; isLabelled: boolean }>): string =>
  isLabelled ? `${name} in ${mount.label}` : name;

const roleReason = ({
  role,
  mount,
}: Readonly<{ role: ArtifactScoutRole; mount: ArtifactScoutMount }>): string =>
  `reads ${role.name} under ${mount.root} of ${mount.label}`;

const mergedPick = ({
  roles,
  mount,
  isLabelled,
}: Readonly<{
  roles: ReadonlyArray<ArtifactScoutRole>;
  mount: ArtifactScoutMount;
  isLabelled: boolean;
}>): ArtifactScoutPick => ({
  roleId: MERGED_SCOUT_ROLE_ID,
  mountId: mount.mountId,
  name: scoutName({ name: MERGED_SCOUT_NAME, mount, isLabelled }),
  scope: roles.map((role) => `${role.name}: ${role.scope}`).join('\n'),
  root: mount.root,
  reason: `reads ${roles.map((role) => role.name).join(', ')} under ${mount.root} of ${mount.label} in one pass`,
});

type MountPlan = Readonly<{
  mount: ArtifactScoutMount;
  roles: ReadonlyArray<ArtifactScoutRole>;
}>;

type ComposeParams = Readonly<{
  plans: ReadonlyArray<MountPlan>;
}>;

const composeRoster = ({ plans }: ComposeParams): ArtifactScoutRoster => {
  const usable = plans.filter((plan) => plan.roles.length > 0);
  if (usable.length === 0) {
    return { picks: [], note: NO_MOUNT_NO_SCOUT_REASON };
  }
  const kept = usable.slice(0, FAN_OUT_MAX_CHILDREN);
  const dropped = usable.length - kept.length;
  const note =
    dropped === 0
      ? null
      : `${dropped} of the chosen repositories were left unread: a run reads at most ${FAN_OUT_MAX_CHILDREN}`;
  const isLabelled = kept.length > 1;
  const total = kept.reduce((count, plan) => count + plan.roles.length, 0);
  if (total <= FAN_OUT_MAX_CHILDREN) {
    return {
      picks: kept.flatMap((plan) =>
        plan.roles.map((role) => ({
          roleId: role.id,
          mountId: plan.mount.mountId,
          name: scoutName({ name: role.name, mount: plan.mount, isLabelled }),
          scope: role.scope,
          root: plan.mount.root,
          reason: roleReason({ role, mount: plan.mount }),
        })),
      ),
      note,
    };
  }
  return {
    picks: kept.map((plan) => mergedPick({ roles: plan.roles, mount: plan.mount, isLabelled })),
    note,
  };
};

export const pickArtifactScouts = async ({
  mounts,
  probe,
  ...choice
}: Params): Promise<ArtifactScoutRoster> => {
  if (mounts.length === 0) {
    return { picks: [], note: NO_MOUNT_NO_SCOUT_REASON };
  }
  switch (choice.kind) {
    case 'wireframe': {
      const plans: Array<MountPlan> = [];
      for (const mount of mounts) {
        const roles = await wireframeRoles({
          fidelity: choice.fidelity,
          target: choice.target,
          mount,
          probe,
        });
        plans.push({ mount, roles });
      }
      return composeRoster({ plans });
    }
    case 'report': {
      if (choice.reportType === 'session-summary') {
        return { picks: [], note: SESSION_SUMMARY_NO_SCOUT_REASON };
      }
      const touched = mounts.filter((mount) => choice.changedMountIds.includes(mount.mountId));
      if (touched.length === 0) {
        return { picks: [], note: NO_DIFF_NO_SCOUT_REASON };
      }
      return composeRoster({
        plans: touched.map((mount) => ({
          mount,
          roles: [ARTIFACT_SCOUT_ROLES['diff-context']],
        })),
      });
    }
    default: {
      const unreachable: never = choice;
      return unreachable;
    }
  }
};

export const artifactScoutPlanEntries = ({
  picks,
  agentIds,
}: Readonly<{
  picks: ReadonlyArray<ArtifactScoutPick>;
  agentIds: ReadonlyArray<AgentId | null>;
}>): ReadonlyArray<ArtifactScoutPlanEntry> =>
  picks.map((pick, index) => ({
    roleId: pick.roleId,
    mountId: pick.mountId,
    reason: pick.reason,
    agentId: agentIds[index] ?? null,
  }));
