import {
  ArchiveRestore,
  Copy,
  ExternalLink,
  FileDown,
  FolderOpen,
  Pencil,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
} from 'lucide-react';
import type {
  AgentId,
  ArtifactKind,
  ArtifactStatus,
  ArtifactId,
  PlanWithCount,
  ReportArtifact,
  SessionArtifact,
  WireframeArtifact,
  SessionId,
} from '@goodboy/types';
import { planAsArtifact } from '../../plans/planAsArtifact';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { agentPlace, sessionPlace } from '../../../store/slices/navigation/place';
import type { ArtifactGeneration } from '../../artifacts/artifactCollection';
import {
  artifactKickoff,
  artifactSourceContents,
  openArtifactCopy,
  otherWireframeFidelity,
  regenerateReport,
  retryArtifactGeneration,
  revealArtifactCopy,
  saveArtifactSource,
  spawnWireframeVariant,
} from '../../artifacts/artifactActionRuns';
import { artifactSourceExport } from '../../artifacts/hooks/useArtifactExport/artifactSourceExport';
import { REGENERATE_BLOCKED_HINT, REGENERATE_READY_HINT } from '../../reports/useReportRegenerate';
import { WIREFRAME_FIDELITY_VARIANT_LABEL } from '../../wireframes/wireframeFidelity';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import type {
  ActionDefinition,
  ActionEnv,
  ArtifactActionTarget,
  ArtifactPort,
  ArtifactPortId,
  ArtifactPorts,
  ObjectKindDefinition,
} from '../types';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';

export const ARTIFACT_EDIT_EVENT = 'goodboy:artifact-edit';

export type ArtifactFacts = {
  readonly sessionId: SessionId;
  readonly workspaceSlug: string | null;
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly plan: PlanWithCount | null;
  readonly stored: SessionArtifact | null;
  readonly planStatus: ArtifactStatus | null;
  readonly isPlanRunning: boolean;
  readonly generation: ArtifactGeneration | null;
  readonly kickoff: string | null;
  readonly ports: ArtifactPorts;
};

const NO_PORTS: ArtifactPorts = {};

type FactsOnly = { readonly facts: ArtifactFacts };

const portOf = ({ facts, id }: FactsOnly & { readonly id: ArtifactPortId }): ArtifactPort | null =>
  facts.ports[id] ?? null;

const artifactOf = ({ facts }: FactsOnly): SessionArtifact | null =>
  facts.plan === null ? facts.stored : planAsArtifact({ plan: facts.plan, stored: facts.stored });

const wireframeDescription = ({
  artifact,
}: {
  readonly artifact: WireframeArtifact | null;
}): string | null =>
  artifact === null
    ? null
    : `Runs the wireframe again as a separate ${WIREFRAME_FIDELITY_VARIANT_LABEL[otherWireframeFidelity({ artifact })]}, leaving this one untouched`;

const noCopyReason = ({ facts }: FactsOnly): string | null =>
  facts.workspaceSlug === null ? 'This session has no workspace folder' : null;

const idOf = ({ facts }: FactsOnly): ArtifactId | null =>
  facts.plan?.id ?? facts.stored?.id ?? null;

const reportOf = ({ facts }: FactsOnly): ReportArtifact | null =>
  facts.stored?.kind === 'report' ? facts.stored : null;

const wireframeOf = ({ facts }: FactsOnly): WireframeArtifact | null =>
  facts.stored?.kind === 'wireframe' ? facts.stored : null;

const sentence = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

const isIdlePlan = ({ facts }: FactsOnly): boolean =>
  facts.kind === 'plan' && artifactOf({ facts }) !== null && !facts.isPlanRunning;

const planIn = ({
  facts,
  statuses,
}: FactsOnly & { readonly statuses: ReadonlyArray<ArtifactStatus> }): boolean =>
  isIdlePlan({ facts }) && facts.planStatus !== null && statuses.includes(facts.planStatus);

const isStored = ({ facts }: FactsOnly): boolean => facts.plan !== null || facts.stored !== null;

const agentOf = ({ facts }: FactsOnly): AgentId | null =>
  facts.generation?.agentId ?? artifactOf({ facts })?.agentId ?? null;

const openArtifact = ({ facts, env }: FactsOnly & { readonly env: ActionEnv }): void => {
  const artifactId = idOf({ facts });
  if (artifactId === null) {
    return;
  }
  env.getState().navigate({
    to: sessionPlace({
      sessionId: facts.sessionId,
      lens: 'plans',
      target: { kind: 'artifact', artifactId },
    }),
  });
};

type PortedParams = {
  readonly id: ArtifactPortId;
  readonly fallback: (params: FactsOnly & { readonly env: ActionEnv }) => void | Promise<void>;
};

const ported =
  ({ id, fallback }: PortedParams) =>
  async ({ facts, env }: FactsOnly & { readonly env: ActionEnv }): Promise<void> => {
    const port = portOf({ facts, id });
    if (port !== null) {
      await port.run();
      return;
    }
    await fallback({ facts, env });
  };

const portLabel = ({
  facts,
  id,
  fallback,
}: FactsOnly & { readonly id: ArtifactPortId; readonly fallback: string }): string =>
  portOf({ facts, id })?.label ?? fallback;

const portBlocked = ({ facts, id }: FactsOnly & { readonly id: ArtifactPortId }): string | null =>
  portOf({ facts, id })?.blockedReason ?? null;

const portBusy = ({ facts, id }: FactsOnly & { readonly id: ArtifactPortId }): boolean =>
  portOf({ facts, id })?.isBusy === true;

const runPlan = async ({ facts, env }: FactsOnly & { readonly env: ActionEnv }): Promise<void> => {
  const planId = idOf({ facts });
  if (planId === null) {
    return;
  }
  await env.getState().runPlan(facts.sessionId, planId);
  env.showToast({
    kind: 'info',
    title: 'Implementer started',
    message: 'An agent is running this plan. You can keep working.',
  });
};

const ARTIFACT_ACTIONS: ReadonlyArray<ActionDefinition<ArtifactFacts>> = [
  {
    id: 'artifact.open',
    label: 'Open',
    icon: CONCEPT_ICONS.artifacts,
    group: 'open',
    when: ({ facts, viewing }) =>
      isStored({ facts }) && !(viewing?.kind === 'artifact' && viewing.id === idOf({ facts })),
    run: openArtifact,
  },
  {
    id: 'artifact.openAgent',
    label: 'Open agent',
    icon: CONCEPT_ICONS.agents,
    group: 'open',
    when: ({ facts }) =>
      (facts.kind === 'plan' || facts.generation !== null) && agentOf({ facts }) !== null,
    run: ({ facts, env }) => {
      const agentId = agentOf({ facts });
      if (agentId !== null) {
        env.getState().navigate({ to: agentPlace({ sessionId: facts.sessionId, agentId }) });
      }
    },
  },
  {
    id: 'artifact.runPlan',
    label: 'Run plan',
    icon: Play,
    group: 'act',
    slot: () => 'primary',
    when: ({ facts }) => planIn({ facts, statuses: ['active'] }),
    blockedReason: ({ facts }) => portBlocked({ facts, id: 'runPlan' }),
    isBusy: ({ facts }) => portBusy({ facts, id: 'runPlan' }),
    run: ported({ id: 'runPlan', fallback: runPlan }),
  },
  {
    id: 'artifact.edit',
    label: 'Edit',
    icon: Pencil,
    group: 'act',
    slot: () => 'secondary',
    when: ({ facts }) =>
      planIn({ facts, statuses: ['active'] }) || (facts.kind === 'report' && isStored({ facts })),
    run: ported({
      id: 'edit',
      fallback: ({ facts, env }) => {
        openArtifact({ facts, env });
        dispatchAfterNavigation({
          name: ARTIFACT_EDIT_EVENT,
          detail: { artifactId: artifactOf({ facts })?.id ?? null },
        });
      },
    }),
  },
  {
    id: 'artifact.runAgain',
    label: 'Run again',
    icon: RotateCw,
    group: 'act',
    slot: () => 'secondary',
    when: ({ facts }) => planIn({ facts, statuses: ['consumed', 'superseded'] }),
    blockedReason: ({ facts }) => portBlocked({ facts, id: 'runAgain' }),
    isBusy: ({ facts }) => portBusy({ facts, id: 'runAgain' }),
    confirm: () => ({
      title: 'Run this plan again?',
      description: 'It already ran once. Running it again starts a new agent.',
      confirmLabel: 'Run again',
      role: 'alert',
    }),
    run: ported({ id: 'runAgain', fallback: runPlan }),
  },
  {
    id: 'artifact.restore',
    label: 'Restore',
    icon: ArchiveRestore,
    group: 'act',
    slot: () => 'secondary',
    when: ({ facts }) => planIn({ facts, statuses: ['discarded'] }),
    run: ported({
      id: 'restore',
      fallback: async ({ facts, env }) => {
        const planId = idOf({ facts });
        if (planId !== null) {
          await env.getState().restorePlan(facts.sessionId, planId);
        }
      },
    }),
  },
  {
    id: 'artifact.regenerate',
    label: 'Regenerate',
    icon: RotateCcw,
    group: 'act',
    when: ({ facts }) => facts.kind === 'report' && isStored({ facts }),
    description: ({ facts }) => (facts.kickoff === null ? null : REGENERATE_READY_HINT),
    blockedReason: ({ facts }) =>
      portBlocked({ facts, id: 'regenerate' }) ??
      (facts.kickoff === null ? sentence(REGENERATE_BLOCKED_HINT) : null),
    isBusy: ({ facts }) => portBusy({ facts, id: 'regenerate' }),
    run: ported({
      id: 'regenerate',
      fallback: async ({ facts, env }) => {
        const report = reportOf({ facts });
        if (report !== null && facts.kickoff !== null) {
          await regenerateReport({
            getState: env.getState,
            sessionId: facts.sessionId,
            artifact: report,
            kickoff: facts.kickoff,
          });
        }
      },
    }),
  },
  {
    id: 'artifact.newVariant',
    label: 'New variant',
    icon: RotateCcw,
    group: 'act',
    when: ({ facts }) => facts.kind === 'wireframe' && isStored({ facts }),
    description: ({ facts }) => wireframeDescription({ artifact: wireframeOf({ facts }) }),
    blockedReason: ({ facts }) => portBlocked({ facts, id: 'newVariant' }),
    isBusy: ({ facts }) => portBusy({ facts, id: 'newVariant' }),
    run: ported({
      id: 'newVariant',
      fallback: async ({ facts, env }) => {
        const wireframe = wireframeOf({ facts });
        if (wireframe !== null) {
          await spawnWireframeVariant({
            getState: env.getState,
            sessionId: facts.sessionId,
            artifact: wireframe,
          });
        }
      },
    }),
  },
  {
    id: 'artifact.stop',
    label: 'Stop',
    icon: Square,
    group: 'act',
    slot: () => 'secondary',
    when: ({ facts }) => facts.generation?.canStop === true,
    run: async ({ facts, env }) => {
      if (facts.generation !== null) {
        await env.getState().stopArtifactGeneration({
          sessionId: facts.sessionId,
          agentId: facts.generation.agentId,
        });
      }
    },
  },
  {
    id: 'artifact.retry',
    label: 'Try again',
    icon: RotateCcw,
    group: 'act',
    slot: () => 'secondary',
    when: ({ facts }) => facts.generation?.state === 'unproduced',
    run: async ({ facts, env }) => {
      if (facts.generation !== null) {
        await retryArtifactGeneration({
          getState: env.getState,
          sessionId: facts.sessionId,
          generation: facts.generation,
        });
      }
    },
  },
  {
    id: 'artifact.copySource',
    label: ({ facts }) =>
      portLabel({
        facts,
        id: 'copySource',
        fallback:
          facts.kind === 'wireframe'
            ? 'Copy spec'
            : facts.stored?.sourceFormat === 'json'
              ? 'Copy JSON'
              : 'Copy markdown',
      }),
    icon: Copy,
    group: 'copy',
    when: isStored,
    blockedReason: ({ facts }) => portBlocked({ facts, id: 'copySource' }),
    run: ported({
      id: 'copySource',
      fallback: ({ facts, env }) => {
        const artifact = artifactOf({ facts });
        return artifact === null
          ? undefined
          : env.copyText({ text: artifactSourceContents({ artifact }) });
      },
    }),
  },
  {
    id: 'artifact.saveSource',
    label: ({ facts }) =>
      portLabel({
        facts,
        id: 'saveSource',
        fallback:
          facts.kind === 'wireframe'
            ? 'Save a copy to…'
            : `${artifactSourceExport({ sourceFormat: artifactOf({ facts })?.sourceFormat ?? 'markdown' }).actionLabel} to…`,
      }),
    icon: FileDown,
    group: 'copy',
    when: isStored,
    blockedReason: ({ facts }) => portBlocked({ facts, id: 'saveSource' }),
    run: ported({
      id: 'saveSource',
      fallback: async ({ facts, env }) => {
        const artifact = artifactOf({ facts });
        if (artifact === null) {
          return;
        }
        const path = await saveArtifactSource({ artifact });
        if (path !== null) {
          env.showToast({ kind: 'success', title: 'Saved a copy', message: path });
        }
      },
    }),
  },
  {
    id: 'artifact.openInBrowser',
    label: 'Open in browser',
    icon: ExternalLink,
    group: 'copy',
    slot: ({ facts }) => (facts.kind === 'wireframe' ? 'secondary' : 'menu'),
    when: isStored,
    description: ({ facts }) =>
      portOf({ facts, id: 'openInBrowser' })?.description ??
      (facts.kind === 'wireframe'
        ? 'Opens the saved folder in your browser'
        : 'Opens the saved file. Print it from there as a PDF.'),
    blockedReason: ({ facts }) =>
      portBlocked({ facts, id: 'openInBrowser' }) ?? noCopyReason({ facts }),
    isBusy: ({ facts }) => portBusy({ facts, id: 'openInBrowser' }),
    run: ported({
      id: 'openInBrowser',
      fallback: ({ facts }) => {
        const artifact = artifactOf({ facts });
        return artifact === null || facts.workspaceSlug === null
          ? undefined
          : openArtifactCopy({ artifact, workspaceSlug: facts.workspaceSlug });
      },
    }),
  },
  {
    id: 'artifact.showInFinder',
    label: 'Show in Finder',
    icon: FolderOpen,
    group: 'copy',
    when: isStored,
    description: () => 'The copy Goodboy keeps on disk for this artifact',
    blockedReason: ({ facts }) =>
      portBlocked({ facts, id: 'showInFinder' }) ?? noCopyReason({ facts }),
    run: ported({
      id: 'showInFinder',
      fallback: ({ facts }) => {
        const artifact = artifactOf({ facts });
        return artifact === null || facts.workspaceSlug === null
          ? undefined
          : revealArtifactCopy({ artifact, workspaceSlug: facts.workspaceSlug });
      },
    }),
  },
  {
    id: 'artifact.discard',
    label: 'Discard',
    icon: Trash2,
    group: 'danger',
    when: ({ facts }) => planIn({ facts, statuses: ['active', 'superseded'] }),
    confirm: ({ facts }) => ({
      title: `Discard "${facts.title}"?`,
      description: 'It stays in the list, faint, and can be restored.',
      confirmLabel: 'Discard',
      role: 'danger',
    }),
    run: ported({
      id: 'discard',
      fallback: async ({ facts, env }) => {
        const planId = idOf({ facts });
        if (planId !== null) {
          await env.getState().deletePlan(facts.sessionId, planId);
        }
      },
    }),
  },
];

export const ARTIFACT_KIND: ObjectKindDefinition<ArtifactActionTarget, ArtifactFacts> = {
  noun: 'artifact',
  facts: ({ state, target }) => {
    const session = sessionById(state.sessions, target.sessionId) ?? null;
    const workspaceSlug =
      state.workspaces.find((workspace) => workspace.id === session?.workspaceId)?.slug ?? null;
    const ports = target.ports ?? NO_PORTS;
    if (target.subject.kind === 'generation') {
      const { generation } = target.subject;
      return {
        sessionId: target.sessionId,
        workspaceSlug,
        kind: generation.kind,
        title: generation.title,
        plan: null,
        stored: null,
        planStatus: null,
        isPlanRunning: false,
        generation,
        kickoff: null,
        ports,
      };
    }
    const { artifactId, isPlanRunning } = target.subject;
    const stored =
      (state.sessionArtifacts[target.sessionId] ?? []).find(
        (candidate) => candidate.id === artifactId,
      ) ?? null;
    const plan =
      (state.sessionPlans[target.sessionId] ?? []).find(
        (candidate) => candidate.id === artifactId,
      ) ?? null;
    if (stored === null && plan === null) {
      return null;
    }
    const kind: ArtifactKind = plan === null ? (stored?.kind ?? 'plan') : 'plan';
    return {
      sessionId: target.sessionId,
      workspaceSlug,
      kind,
      title: plan?.title ?? stored?.title ?? '',
      plan,
      stored,
      planStatus: plan?.status ?? (stored?.kind === 'plan' ? stored.status : null),
      isPlanRunning,
      generation: null,
      kickoff:
        stored?.kind === 'report'
          ? artifactKickoff({ getState: () => state, artifact: stored })
          : null,
      ports,
    };
  },
  actions: ARTIFACT_ACTIONS,
};
