import { useEffect, useId, useState } from 'react';
import { REPLY_VOICES, RESOLVE_COMMIT_STYLES, type WorkspaceId } from '@goodboy/types';
import { Button, InlineConfirm, Markdown, SegmentedTabs, Switch, Textarea } from '@goodboy/ui';
import { RotateCcw } from 'lucide-react';
import { useAppStore } from '../../../../store';
import type { WorkspaceOverridesPatch } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { buildResolutionReplyBody } from '../../../../store/slices/github/buildResolutionReplyBody';
import {
  REPLY_TEMPLATE_FIXED_DEFAULT,
  REPLY_TEMPLATE_NO_CHANGE_DEFAULT,
  replySettingsOf,
} from '../../../resolve/replySettings';
import {
  COMMIT_STYLE_LABEL,
  REVIEW_REPLIES_SECTION_ID,
  VOICE_HELP,
  VOICE_LABEL,
  VOICE_SAMPLE,
} from '../../../resolve/replySettingsCopy';
import { ReplyTemplateField } from './ReplyTemplateField';
import { WorkspaceDefaultRow } from './WorkspaceDefaultRow';
import { WorkspaceEyebrow } from './WorkspaceEyebrow';

const PREVIEW_SHA = '4f21c8b9a7d3e6015482ba9c7d3e6f0158249bcd';
const PREVIEW_PR_URL = 'https://github.com/acme/payments-api/pull/528';

const RESET_PATCH: WorkspaceOverridesPatch = {
  replyVoice: null,
  replyStyleNote: null,
  replyTemplateFixed: null,
  replyTemplateNoChange: null,
  resolveOnGithub: null,
  resolveCommitStyle: null,
};

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceReviewRepliesSection = ({ workspaceId }: Props) => {
  const overrides = useAppStore((s) => s.workspaceOverrides[workspaceId] ?? null);
  const patchWorkspaceOverrides = useAppStore((s) => s.patchWorkspaceOverrides);
  const reportError = useAppStore((s) => s.reportError);
  const [isBusy, setIsBusy] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const settings = replySettingsOf({ layers: [overrides] });
  const [styleNote, setStyleNote] = useState(settings.styleNote ?? '');
  const noteId = useId();

  useEffect(() => {
    setStyleNote(settings.styleNote ?? '');
  }, [settings.styleNote]);

  const persist = async ({ patch }: { readonly patch: WorkspaceOverridesPatch }) => {
    setIsBusy(true);
    try {
      await patchWorkspaceOverrides({ workspaceId, patch });
    } catch (error) {
      void reportError({ title: "Couldn't save the review reply settings", error, workspaceId });
    } finally {
      setIsBusy(false);
    }
  };

  const saveTemplate = ({
    key,
    value,
    fallback,
  }: {
    readonly key: 'replyTemplateFixed' | 'replyTemplateNoChange';
    readonly value: string;
    readonly fallback: string;
  }) => void persist({ patch: { [key]: value.trim() === fallback ? null : value } });

  const preview = buildResolutionReplyBody({
    closure: { commitSha: PREVIEW_SHA, reply: VOICE_SAMPLE[settings.voice] },
    prUrl: PREVIEW_PR_URL,
    settings,
  });
  const noChangePreview = buildResolutionReplyBody({
    closure: { reason: 'the sibling routes use the same name' },
    prUrl: PREVIEW_PR_URL,
    settings,
  });

  return (
    <section aria-labelledby={REVIEW_REPLIES_SECTION_ID} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <WorkspaceEyebrow id={REVIEW_REPLIES_SECTION_ID} label="Review replies" />
        <p className="text-xs text-muted-foreground">
          How Goodboy answers review comments on your pull requests.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Voice</span>
            <SegmentedTabs
              ariaLabel="Reply voice"
              size="sm"
              value={settings.voice}
              options={REPLY_VOICES.map((voice) => ({
                value: voice,
                label: VOICE_LABEL[voice],
                disabled: isBusy,
              }))}
              onChange={(voice) => void persist({ patch: { replyVoice: voice } })}
            />
            <p className="text-2xs text-muted-foreground">{VOICE_HELP[settings.voice]}</p>
          </div>
          {settings.voice === 'mine' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={noteId} className="text-xs font-medium text-foreground">
                Style note
              </label>
              <Textarea
                id={noteId}
                value={styleNote}
                autoGrow
                minRows={2}
                disabled={isBusy}
                placeholder="Short. Starts lowercase. Never thanks."
                onChange={(event) => setStyleNote(event.target.value)}
                onBlur={() => {
                  if (styleNote !== (settings.styleNote ?? '')) {
                    void persist({ patch: { replyStyleNote: styleNote.trim() || null } });
                  }
                }}
              />
              <p className="text-2xs text-muted-foreground">
                Agents follow this note instead of a preset. Until it has text, replies stay terse.
              </p>
            </div>
          )}
          <ReplyTemplateField
            label="When fixed"
            value={settings.templateFixed}
            isDisabled={isBusy}
            onSave={(value) =>
              saveTemplate({
                key: 'replyTemplateFixed',
                value,
                fallback: REPLY_TEMPLATE_FIXED_DEFAULT,
              })
            }
          />
          <ReplyTemplateField
            label="When not changing"
            value={settings.templateNoChange}
            isDisabled={isBusy}
            onSave={(value) =>
              saveTemplate({
                key: 'replyTemplateNoChange',
                value,
                fallback: REPLY_TEMPLATE_NO_CHANGE_DEFAULT,
              })
            }
          />
          <div className="flex flex-col gap-1">
            <WorkspaceDefaultRow
              label="Sign replies"
              help='Adds "Written by Goodboy". The same switch as the attribution line.'
            >
              <Switch
                label={settings.isSigned ? 'On' : 'Off'}
                checked={settings.isSigned}
                disabled={isBusy}
                onChange={(next) => void persist({ patch: { attributionFooter: next } })}
              />
            </WorkspaceDefaultRow>
            <WorkspaceDefaultRow
              label="Resolve the thread after replying"
              help="Off leaves it open for the reviewer to resolve."
            >
              <Switch
                label={settings.resolveOnGithub ? 'On' : 'Off'}
                checked={settings.resolveOnGithub}
                disabled={isBusy}
                onChange={(next) => void persist({ patch: { resolveOnGithub: next } })}
              />
            </WorkspaceDefaultRow>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">Commits</span>
            <SegmentedTabs
              ariaLabel="Commit style"
              size="sm"
              value={settings.commitStyle}
              options={RESOLVE_COMMIT_STYLES.map((style) => ({
                value: style,
                label: COMMIT_STYLE_LABEL[style],
                disabled: isBusy,
              }))}
              onChange={(style) => void persist({ patch: { resolveCommitStyle: style } })}
            />
          </div>
          {isResetting ? (
            <InlineConfirm
              role="alert"
              icon={<RotateCcw size={ICON_SIZE.row} aria-hidden />}
              title="Reset review replies to the default?"
              description="Voice, style note, templates, resolving on GitHub and the commit style go back to the default. Signing stays as it is."
              confirmLabel="Reset"
              isBusy={isBusy}
              onConfirm={() => {
                void persist({ patch: RESET_PATCH }).then(() => setIsResetting(false));
              }}
              onCancel={() => setIsResetting(false)}
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="self-start text-muted-foreground"
              onClick={() => setIsResetting(true)}
            >
              Reset to default
            </Button>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2" aria-label="Reply preview">
          <span className="text-xs font-medium text-foreground">Preview</span>
          <div className="flex flex-col gap-2 rounded-md border border-border bg-subtle px-3 py-2.5">
            <p className="text-2xs text-muted-foreground">When fixed</p>
            {preview !== null && (
              <Markdown text={preview} variant="preview" className="text-xs text-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-border bg-subtle px-3 py-2.5">
            <p className="text-2xs text-muted-foreground">When not changing</p>
            {noChangePreview !== null && (
              <Markdown
                text={noChangePreview}
                variant="preview"
                className="text-xs text-foreground"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
