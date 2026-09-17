import { describe, expect, it, vi } from 'vitest';
import type { MountId } from '@goodboy/types';
import {
  ARTIFACT_SCOUT_ROLES,
  MERGED_SCOUT_ROLE_ID,
  MOBILE_SCREENS_SENTENCE,
} from './artifactScoutRoles';
import {
  NO_DIFF_NO_SCOUT_REASON,
  NO_MOUNT_NO_SCOUT_REASON,
  SESSION_SUMMARY_NO_SCOUT_REASON,
  pickArtifactScouts,
  artifactScoutPlanEntries,
  type ArtifactScoutMount,
  type ArtifactScoutProbe,
} from './pickArtifactScouts';

const mount = ({ id, root }: Readonly<{ id: string; root: string }>): ArtifactScoutMount => ({
  mountId: id as MountId,
  label: id,
  root,
});

const ONE = mount({ id: 'mount-1', root: 'apps/web' });
const TWO = mount({ id: 'mount-2', root: '.' });
const THREE = mount({ id: 'mount-3', root: 'services/api' });

const emptyProbe: ArtifactScoutProbe = async () => [];

const designProbe: ArtifactScoutProbe = async ({ relPath }) =>
  relPath === 'src' ? ['components', 'tokens'] : ['src'];

type Row = Readonly<{
  name: string;
  mounts: ReadonlyArray<ArtifactScoutMount>;
  fidelity: 'low' | 'high';
  target: 'mobile' | 'desktop' | 'both';
  probe: ArtifactScoutProbe;
  roleIds: ReadonlyArray<string>;
}>;

const WIREFRAME_ROWS: ReadonlyArray<Row> = [
  {
    name: 'low fidelity on desktop reads screens and data',
    mounts: [ONE],
    fidelity: 'low',
    target: 'desktop',
    probe: designProbe,
    roleIds: ['screens', 'data'],
  },
  {
    name: 'low fidelity on mobile still reads screens and data',
    mounts: [ONE],
    fidelity: 'low',
    target: 'mobile',
    probe: designProbe,
    roleIds: ['screens', 'data'],
  },
  {
    name: 'high fidelity adds the vocabulary scout when a design directory exists',
    mounts: [ONE],
    fidelity: 'high',
    target: 'desktop',
    probe: designProbe,
    roleIds: ['screens', 'data', 'design'],
  },
  {
    name: 'high fidelity without a design directory stays at two',
    mounts: [ONE],
    fidelity: 'high',
    target: 'desktop',
    probe: emptyProbe,
    roleIds: ['screens', 'data'],
  },
  {
    name: 'two mounts at two roles each fill the cap exactly',
    mounts: [ONE, TWO],
    fidelity: 'low',
    target: 'both',
    probe: emptyProbe,
    roleIds: ['screens', 'data', 'screens', 'data'],
  },
  {
    name: 'three mounts merge into one scout per mount',
    mounts: [ONE, TWO, THREE],
    fidelity: 'low',
    target: 'both',
    probe: emptyProbe,
    roleIds: [MERGED_SCOUT_ROLE_ID, MERGED_SCOUT_ROLE_ID, MERGED_SCOUT_ROLE_ID],
  },
  {
    name: 'two mounts at three roles merge rather than overflow the cap',
    mounts: [ONE, TWO],
    fidelity: 'high',
    target: 'desktop',
    probe: designProbe,
    roleIds: [MERGED_SCOUT_ROLE_ID, MERGED_SCOUT_ROLE_ID],
  },
];

describe('pickArtifactScouts for a wireframe', () => {
  for (const row of WIREFRAME_ROWS) {
    it(row.name, async () => {
      const roster = await pickArtifactScouts({
        kind: 'wireframe',
        fidelity: row.fidelity,
        target: row.target,
        mounts: row.mounts,
        probe: row.probe,
      });
      expect(roster.picks.map((pick) => pick.roleId)).toEqual(row.roleIds);
      expect(roster.picks.length).toBeLessThanOrEqual(4);
    });
  }

  it('gives every pick a reason that names the root it was pointed at', async () => {
    const roster = await pickArtifactScouts({
      kind: 'wireframe',
      fidelity: 'low',
      target: 'both',
      mounts: [ONE],
      probe: emptyProbe,
    });
    expect(roster.picks.every((pick) => pick.reason.includes('apps/web'))).toBe(true);
    expect(roster.note).toBeNull();
  });

  it('adds the phone sentence to the screens scope only on mobile', async () => {
    const onPhone = await pickArtifactScouts({
      kind: 'wireframe',
      fidelity: 'low',
      target: 'mobile',
      mounts: [ONE],
      probe: emptyProbe,
    });
    const onDesktop = await pickArtifactScouts({
      kind: 'wireframe',
      fidelity: 'low',
      target: 'desktop',
      mounts: [ONE],
      probe: emptyProbe,
    });
    expect(onPhone.picks[0]?.scope).toContain(MOBILE_SCREENS_SENTENCE);
    expect(onDesktop.picks[0]?.scope).not.toContain(MOBILE_SCREENS_SENTENCE);
    expect(onDesktop.picks[0]?.scope).toBe(ARTIFACT_SCOUT_ROLES.screens.scope);
  });

  it('keeps the vocabulary scout off the token files the app already read', async () => {
    const roster = await pickArtifactScouts({
      kind: 'wireframe',
      fidelity: 'high',
      target: 'desktop',
      mounts: [ONE],
      probe: designProbe,
    });
    const design = roster.picks.find((pick) => pick.roleId === 'design');
    expect(design?.scope).toContain('never reopen them');
  });

  it('names every scout by its mount when more than one repository is read', async () => {
    const roster = await pickArtifactScouts({
      kind: 'wireframe',
      fidelity: 'low',
      target: 'both',
      mounts: [ONE, TWO],
      probe: emptyProbe,
    });
    expect(new Set(roster.picks.map((pick) => pick.name)).size).toBe(roster.picks.length);
    expect(roster.picks.every((pick) => pick.name.includes(' in mount-'))).toBe(true);
  });

  it('leaves the extra repositories unread and says so past the cap', async () => {
    const roster = await pickArtifactScouts({
      kind: 'wireframe',
      fidelity: 'low',
      target: 'both',
      mounts: [
        ONE,
        TWO,
        THREE,
        mount({ id: 'mount-4', root: 'x' }),
        mount({ id: 'mount-5', root: 'y' }),
      ],
      probe: emptyProbe,
    });
    expect(roster.picks).toHaveLength(4);
    expect(roster.note).toContain('left unread');
  });

  it('probes each root at most twice and stops once it has found one', async () => {
    const probe = vi.fn(async ({ relPath }: Readonly<{ relPath: string }>) =>
      relPath === '' ? ['tokens'] : [],
    );
    await pickArtifactScouts({
      kind: 'wireframe',
      fidelity: 'high',
      target: 'desktop',
      mounts: [ONE],
      probe: probe as unknown as ArtifactScoutProbe,
    });
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('never probes at low fidelity', async () => {
    const probe = vi.fn(async () => ['tokens']);
    await pickArtifactScouts({
      kind: 'wireframe',
      fidelity: 'low',
      target: 'desktop',
      mounts: [ONE],
      probe: probe as unknown as ArtifactScoutProbe,
    });
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('pickArtifactScouts for a report', () => {
  it('spawns nothing for a session summary and says why', async () => {
    const roster = await pickArtifactScouts({
      kind: 'report',
      reportType: 'session-summary',
      changedMountIds: [ONE.mountId],
      mounts: [ONE],
      probe: emptyProbe,
    });
    expect(roster.picks).toEqual([]);
    expect(roster.note).toBe(SESSION_SUMMARY_NO_SCOUT_REASON);
  });

  it('reads the diff context once per mount the diff touched', async () => {
    const roster = await pickArtifactScouts({
      kind: 'report',
      reportType: 'change-summary',
      changedMountIds: [ONE.mountId, THREE.mountId],
      mounts: [ONE, TWO, THREE],
      probe: emptyProbe,
    });
    expect(roster.picks.map((pick) => pick.roleId)).toEqual(['diff-context', 'diff-context']);
    expect(roster.picks.map((pick) => pick.mountId)).toEqual([ONE.mountId, THREE.mountId]);
    expect(roster.picks[0]?.scope).toBe(ARTIFACT_SCOUT_ROLES['diff-context'].scope);
  });

  it('spawns nothing when the diff touches no chosen repository', async () => {
    const roster = await pickArtifactScouts({
      kind: 'report',
      reportType: 'change-summary',
      changedMountIds: [],
      mounts: [ONE],
      probe: emptyProbe,
    });
    expect(roster.picks).toEqual([]);
    expect(roster.note).toBe(NO_DIFF_NO_SCOUT_REASON);
  });

  it('never probes the filesystem for a report', async () => {
    const probe = vi.fn(async () => ['tokens']);
    await pickArtifactScouts({
      kind: 'report',
      reportType: 'change-summary',
      changedMountIds: [ONE.mountId],
      mounts: [ONE],
      probe: probe as unknown as ArtifactScoutProbe,
    });
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('pickArtifactScouts with nothing mounted', () => {
  it('returns an empty roster with a reason for either kind', async () => {
    const wireframe = await pickArtifactScouts({
      kind: 'wireframe',
      fidelity: 'high',
      target: 'both',
      mounts: [],
      probe: emptyProbe,
    });
    const report = await pickArtifactScouts({
      kind: 'report',
      reportType: 'change-summary',
      changedMountIds: [],
      mounts: [],
      probe: emptyProbe,
    });
    expect(wireframe).toEqual({ picks: [], note: NO_MOUNT_NO_SCOUT_REASON });
    expect(report).toEqual({ picks: [], note: NO_MOUNT_NO_SCOUT_REASON });
  });
});

describe('artifactScoutPlanEntries', () => {
  it('carries the role, the mount and the reason, with no agent before the child exists', async () => {
    const roster = await pickArtifactScouts({
      kind: 'wireframe',
      fidelity: 'low',
      target: 'both',
      mounts: [ONE],
      probe: emptyProbe,
    });
    const entries = artifactScoutPlanEntries({ picks: roster.picks, agentIds: [] });
    expect(entries).toHaveLength(2);
    expect(entries[0]?.roleId).toBe('screens');
    expect(entries[0]?.mountId).toBe(ONE.mountId);
    expect(entries[0]?.reason).toContain('apps/web');
    expect(entries.every((entry) => entry.agentId === null)).toBe(true);
  });
});
