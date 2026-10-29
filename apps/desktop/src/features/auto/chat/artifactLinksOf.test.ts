import { describe, expect, it } from 'vitest';
import type { AutoDeliveredArtifact, AutoTreeView } from '../../../store/slices/auto-view/state';
import { anArtifactRow, aPlanRow, aView } from '../testing/autoViewFixtures';
import { artifactLinksOf, type ArtifactLinkModel } from './artifactLinksOf';
import { isAwaitingApproval } from './isAwaitingApproval';

const REPORT_SOURCE = [
  '<<summary>>',
  'Safe to merge **ledger-core** once the unique index lands.',
  '<</summary>>',
  '',
  '## Findings',
].join('\n');

type OneParams = {
  readonly view: AutoTreeView;
  readonly artifact: AutoDeliveredArtifact;
};

const oneLinkOf = ({ view, artifact }: OneParams): ArtifactLinkModel => {
  const [link] = artifactLinksOf({ view, artifacts: [artifact] });
  if (link === undefined) {
    throw new Error('expected one link');
  }
  return link;
};

describe('artifactLinksOf', () => {
  it('links a report with its title, revision and the lead of its summary', () => {
    const view = aView({
      artifacts: [
        anArtifactRow({
          id: 'artifact-report',
          kind: 'report',
          title: 'Certify ledger-core, branch vs main',
          revision: 2,
          sourceText: REPORT_SOURCE,
        }),
      ],
    });

    const link = oneLinkOf({
      view,
      artifact: { artifactId: 'artifact-report', kind: 'report', title: 'old title', revision: 1 },
    });

    expect(link).toEqual({
      artifactId: 'artifact-report',
      kind: 'report',
      kindLabel: 'Report',
      title: 'Certify ledger-core, branch vs main',
      revision: 2,
      lead: 'Safe to merge ledger-core once the unique index lands.',
      approval: null,
    });
    expect(isAwaitingApproval({ link })).toBe(false);
  });

  it('links a wireframe with no lead and no approval', () => {
    const view = aView({
      artifacts: [
        anArtifactRow({
          id: 'artifact-wire',
          kind: 'wireframe',
          title: 'Checkout screen',
          sourceText: '<html></html>',
        }),
      ],
    });

    const link = oneLinkOf({
      view,
      artifact: { artifactId: 'artifact-wire', kind: 'wireframe', title: 'x', revision: 1 },
    });

    expect(link.kindLabel).toBe('Wireframe');
    expect(link.lead).toBeNull();
    expect(link.approval).toBeNull();
  });

  it('marks a plan that needs approval, so the ask owns it', () => {
    const link = oneLinkOf({
      view: aView({ artifacts: [aPlanRow()] }),
      artifact: { artifactId: 'artifact-plan', kind: 'plan', title: 'x', revision: 1 },
    });

    expect(link.approval?.state).toBe('needs_approval');
    expect(isAwaitingApproval({ link })).toBe(true);
  });

  it('marks an approved plan as approved, which stays a row', () => {
    const link = oneLinkOf({
      view: aView({ artifacts: [aPlanRow({ approvalState: 'approved', approvedRevision: 1 })] }),
      artifact: { artifactId: 'artifact-plan', kind: 'plan', title: 'x', revision: 1 },
    });

    expect(link.approval).toEqual({ word: 'Approved', tone: 'merged', state: 'approved' });
    expect(isAwaitingApproval({ link })).toBe(false);
  });

  it('falls back to the result when the ledger has no row', () => {
    const link = oneLinkOf({
      view: aView(),
      artifact: {
        artifactId: 'artifact-gone',
        kind: 'report',
        title: 'Notify-relay audit',
        revision: 3,
      },
    });

    expect(link).toEqual({
      artifactId: 'artifact-gone',
      kind: 'report',
      kindLabel: 'Report',
      title: 'Notify-relay audit',
      revision: 3,
      lead: null,
      approval: null,
    });
  });

  it('names an unknown kind Artifact', () => {
    const link = oneLinkOf({
      view: aView(),
      artifact: { artifactId: 'a', kind: 'artifact', title: 'Misc', revision: null },
    });

    expect(link.kindLabel).toBe('Artifact');
    expect(link.revision).toBeNull();
  });
});
