import { useEffect, type ReactNode } from 'react';
import { BranchPushScene } from '../BranchPushScene';
import { MountsScene } from '../MountsScene';
import { ArtifactReportScene } from '../ArtifactScenes';
import { WorkflowRunScene } from '../flow-audit/WorkflowRunScene';
import { ScriptsLensScene } from '../SurfaceAuditScenes';
import { AgentPageScene } from './AgentPageScene';

const POLL_MS = 150;

type Step = (root: ParentNode) => HTMLElement | undefined;

const buttonNamed =
  ({ name }: { readonly name: string }): Step =>
  (root) =>
    [...root.querySelectorAll<HTMLElement>('button')].find(
      (button) => button.getAttribute('aria-label') === name,
    );

const menuItemStarting =
  ({ prefix }: { readonly prefix: string }): Step =>
  (root) =>
    [...root.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.startsWith(prefix) === true,
    );

const byTestId =
  ({ id }: { readonly id: string }): Step =>
  (root) =>
    root.querySelector<HTMLElement>(`[data-testid="${id}"]`) ?? undefined;

type Props = {
  readonly steps: ReadonlyArray<Step>;
  readonly children: ReactNode;
};

const ClickThrough = ({ steps, children }: Props) => {
  useEffect(() => {
    let done = 0;
    const interval = window.setInterval(() => {
      const step = steps[done];
      if (step === undefined) {
        window.clearInterval(interval);
        return;
      }
      const target = step(document);
      if (target === undefined) {
        return;
      }
      target.click();
      done += 1;
    }, POLL_MS);
    return () => window.clearInterval(interval);
  }, [steps]);
  return <>{children}</>;
};

const DELETE_SESSION: ReadonlyArray<Step> = [
  buttonNamed({ name: 'More session actions' }),
  menuItemStarting({ prefix: 'Delete session' }),
];

const DELETE_AGENT: ReadonlyArray<Step> = [
  buttonNamed({ name: 'More agent actions' }),
  menuItemStarting({ prefix: 'Delete agent' }),
];

const OPEN_DETAILS: ReadonlyArray<Step> = [byTestId({ id: 'artifact-drawer-details' })];

export const U23_HEADERS_SCENES = {
  'header-overview-overflow': () => (
    <ClickThrough steps={DELETE_SESSION}>
      <MountsScene variant="mounts" />
    </ClickThrough>
  ),
  'header-agent': () => (
    <ClickThrough steps={DELETE_AGENT}>
      <AgentPageScene isRunning />
    </ClickThrough>
  ),
  'header-artifact-details': () => (
    <ClickThrough steps={OPEN_DETAILS}>
      <ArtifactReportScene />
    </ClickThrough>
  ),
  'header-run': () => <WorkflowRunScene />,
  'header-branch-push-confirm': () => <BranchPushScene />,
  'header-scripts': () => <ScriptsLensScene />,
};
