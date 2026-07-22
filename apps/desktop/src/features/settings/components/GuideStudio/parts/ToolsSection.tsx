import { Wrench } from 'lucide-react';
import { WORKSPACE_FEATURES } from '../../../../../shared/lib/features';
import { Block } from './Block';
import { InlineCode } from './InlineCode';
import { SectionHeader } from './SectionHeader';

type Props = Record<never, never>;

export const ToolsSection = ({}: Props) => (
  <div className="flex flex-col gap-7">
    <SectionHeader
      icon={<Wrench size={14} aria-hidden className="text-warning" />}
      title="Tools"
      description="Actions the agent takes beyond writing a reply: reading files, running shell commands, editing code, fetching docs."
      tone="warning"
    />

    <Block title="How they show up">
      <p className="text-sm leading-relaxed text-muted-foreground">
        In the transcript, each tool invocation collapses to a single row (
        <InlineCode>Bash</InlineCode>, <InlineCode>Read</InlineCode>, <InlineCode>Edit</InlineCode>
        ). Click to expand input and output. Consecutive tool rows are visually grouped to keep the
        chat readable.
      </p>
    </Block>

    <Block title="Permissions">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Goodboy proxies the CLI's own permission system. Above the input you see{' '}
        <InlineCode>permissions: X allow / Y deny</InlineCode>, the rule set the next turn will run
        under. Click it to manage rules in settings.
      </p>
    </Block>

    {WORKSPACE_FEATURES.skills ? (
      <Block title="Skills">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Type <InlineCode>/</InlineCode> in the input to invoke a workspace skill, a pre-defined
          prompt template stored alongside your repo. Useful for repeatable flows: release notes,
          security reviews, migration plans.
        </p>
      </Block>
    ) : null}
  </div>
);
