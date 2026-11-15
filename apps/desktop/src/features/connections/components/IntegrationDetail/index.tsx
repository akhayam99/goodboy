import { PaneShell, RefreshIconButton, ScrollFade, tintClasses } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import {
  IntegrationGlyph,
  type IntegrationGlyphProvider,
} from '../../../../shared/components/IntegrationGlyph';
import { StudioTrail } from '../../../../shared/components/StudioShell/StudioTrail';
import { NAMES } from '../../../../shared/utils/names';
import { IntegrationMenu } from '../../../actions/IntegrationMenu';
import { useToolPage } from '../../hooks/useToolPage';
import { githubFactsOf } from '../../model/githubFactsOf';
import { toolAccountOf } from '../../model/toolAccountOf';
import { GithubBody } from './GithubBody';
import { KeychainLine } from './KeychainLine';
import { StateWord } from './StateWord';
import { ToolBody } from './ToolBody';
import { ToolFacts } from './ToolFacts';
import { ToolSetupSection } from './ToolSetupSection';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly tool: IntegrationGlyphProvider;
  readonly onUp: () => void;
};

type FactsParams = {
  readonly page: ReturnType<typeof useToolPage>;
  readonly workspaceName: string;
};

const headFactsOf = ({ page, workspaceName }: FactsParams) => {
  if (page.binding !== null) {
    const account = toolAccountOf({ binding: page.binding });
    return { who: account.who, facts: [account.where, account.keyKind] };
  }
  return {
    who: page.githubIdentity,
    facts: githubFactsOf({
      status: page.githubStatus,
      isScoped: page.github.isScoped,
      workspaceName,
    }),
  };
};

export const IntegrationDetail = ({ workspaceId, workspaceName, tool, onUp }: Props) => {
  const page = useToolPage({ workspaceId, tool });
  const { label, binding, toolState } = page;
  const head = headFactsOf({ page, workspaceName });

  return (
    <>
      <StudioTrail
        segments={[
          {
            id: 'connections',
            label: NAMES.connections,
            icon: CONCEPT_ICONS.connections,
            iconClassName: tintClasses(CONCEPT_TONE.connections).icon,
            onSelect: onUp,
          },
          {
            id: tool,
            label,
            icon: CONCEPT_ICONS.connections,
            glyph: <IntegrationGlyph provider={tool} size="xs" />,
          },
        ]}
      />
      <PaneShell
        page="connections"
        scroll="body"
        title={
          <span className="inline-flex min-w-0 items-center gap-2">
            <span aria-hidden className="inline-flex shrink-0">
              <IntegrationGlyph provider={tool} />
            </span>
            {label}
          </span>
        }
        badge={<StateWord toolState={toolState} />}
        actions={
          page.isConnected ? (
            <>
              <RefreshIconButton label={`Check ${label} again`} onClick={() => void page.check()} />
              <IntegrationMenu target={page.target} />
            </>
          ) : null
        }
        subheader={
          page.isConnected ? (
            <ToolFacts
              who={head.who}
              facts={head.facts}
              checkedAt={page.keyCheck?.checkedAt ?? null}
              checkError={page.checkError}
            />
          ) : null
        }
      >
        <ScrollFade viewportClassName="flex flex-col gap-6 pb-6">
          {binding !== null ? (
            <ToolBody
              workspaceId={workspaceId}
              workspaceName={workspaceName}
              binding={binding}
              label={label}
              toolState={toolState}
            />
          ) : null}
          {page.isGithub ? (
            <GithubBody
              workspaceId={workspaceId}
              workspaceName={workspaceName}
              isConnected={page.isConnected}
              connection={page.github}
            />
          ) : null}
          {binding === null && tool !== 'github' ? (
            <ToolSetupSection workspaceId={workspaceId} tool={tool} label={label} />
          ) : null}
          {page.isConnected ? <KeychainLine /> : null}
        </ScrollFade>
      </PaneShell>
    </>
  );
};
