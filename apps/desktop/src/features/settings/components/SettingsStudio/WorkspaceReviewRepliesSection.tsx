import { useEffect, useState } from 'react';
import { REPLY_VOICES, RESOLVE_COMMIT_STYLES, type WorkspaceId } from '@goodboy/types';
import {
  Band,
  BandStack,
  Button,
  FieldRow,
  Markdown,
  SectionHeader,
  SegmentedTabs,
  Switch,
} from '@goodboy/ui';
import { ChevronRight } from 'lucide-react';
import { useAppStore } from '../../../../store';
import type { WorkspaceOverridesPatch } from '../../../../store/slices/overrides/patchWorkspaceOverrides';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { buildResolutionReplyBody } from '../../../../store/slices/github/buildResolutionReplyBody';
import {
  EDIT_POSTED_REPLY_OFF,
  EDIT_POSTED_REPLY_ON,
  editPostedReplyKey,
  isEditPostedReplyOn,
} from '../../../resolve/editPostedReplySetting';
import {
  REPLY_TEMPLATE_FIXED_DEFAULT,
  REPLY_TEMPLATE_NO_CHANGE_DEFAULT,
  replySettingsOf,
} from '../../../resolve/replySettings';
import {
  COMMIT_STYLE_LABEL,
  VOICE_HELP,
  VOICE_LABEL,
  VOICE_SAMPLE,
} from '../../../resolve/replySettingsCopy';
import { ReplyStyleNoteField } from './ReplyStyleNoteField';
import { ReplyTemplateField } from './ReplyTemplateField';
import { WorkspaceFieldRow } from './WorkspaceFieldRow';

const PREVIEW_SHA = '4f21c8b9a7d3e6015482ba9c7d3e6f0158249bcd';
const PREVIEW_PR_URL = 'https://github.com/acme/payments-api/pull/528';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly onEditAttribution: () => void;
};

export const WorkspaceReviewRepliesSection = ({ workspaceId, onEditAttribution }: Props) => {
  const overrides = useAppStore((s) => s.workspaceOverrides[workspaceId] ?? null);
  const patchWorkspaceOverrides = useAppStore((s) => s.patchWorkspaceOverrides);
  const reportError = useAppStore((s) => s.reportError);
  const editKey = editPostedReplyKey({ workspaceId });
  const rawEdit = useAppStore((s) => s.settings[editKey]);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const [isBusy, setIsBusy] = useState(false);
  const settings = replySettingsOf({ layers: [overrides] });

  useEffect(() => {
    void loadSetting(editKey);
  }, [loadSetting, editKey]);

  const saveEditPostedReply = ({ isOn }: { readonly isOn: boolean }) => {
    saveSetting(editKey, isOn ? EDIT_POSTED_REPLY_ON : EDIT_POSTED_REPLY_OFF).catch(
      (error: unknown) =>
        void reportError({ title: "Couldn't save the review reply settings", error, workspaceId }),
    );
  };

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
    <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Band
          inset="content"
          label="Voice"
          ariaLabel="Voice"
          hint="The tone every reply starts from."
          icon={<CONCEPT_ICONS.message size={ICON_SIZE.row} aria-hidden />}
          headingLevel={2}
        >
          <WorkspaceFieldRow
            workspaceId={workspaceId}
            field="replyVoice"
            layout="stacked"
            help={VOICE_HELP[settings.voice]}
          >
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
          </WorkspaceFieldRow>
          {settings.voice === 'mine' && (
            <ReplyStyleNoteField
              workspaceId={workspaceId}
              value={settings.styleNote}
              isDisabled={isBusy}
              onSave={(note) => void persist({ patch: { replyStyleNote: note } })}
            />
          )}
        </Band>
        <Band
          inset="content"
          label="Templates"
          ariaLabel="Templates"
          hint="What a reply says around the reason."
          icon={<CONCEPT_ICONS.report size={ICON_SIZE.row} aria-hidden />}
          headingLevel={2}
        >
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
        </Band>
        <Band
          inset="content"
          label="Threads"
          ariaLabel="Threads"
          hint="What happens to a thread after a reply."
          icon={<CONCEPT_ICONS.comments size={ICON_SIZE.row} aria-hidden />}
          headingLevel={2}
        >
          <WorkspaceFieldRow
            workspaceId={workspaceId}
            field="resolveOnGithub"
            help="Off leaves it open for the reviewer to resolve. Bitbucket threads always stay open."
          >
            <Switch
              label={settings.resolveOnGithub ? 'On' : 'Off'}
              checked={settings.resolveOnGithub}
              disabled={isBusy}
              onChange={(next) => void persist({ patch: { resolveOnGithub: next } })}
            />
          </WorkspaceFieldRow>
          <WorkspaceFieldRow
            workspaceId={workspaceId}
            field="editPostedReply"
            help="After a squash or fixup, adds an Update line to a reply Goodboy already posted. GitHub may notify people."
          >
            <Switch
              label={isEditPostedReplyOn({ raw: rawEdit }) ? 'On' : 'Off'}
              checked={isEditPostedReplyOn({ raw: rawEdit })}
              onChange={(next) => saveEditPostedReply({ isOn: next })}
            />
          </WorkspaceFieldRow>
          <FieldRow
            label="Attribution line"
            help={`Adds "Written by Goodboy". One setting for comments and replies, so it lives on New sessions. It is ${settings.isSigned ? 'on' : 'off'}.`}
          >
            <Button variant="ghost" size="sm" onClick={onEditAttribution}>
              Edit in New sessions
              <ChevronRight size={ICON_SIZE.row} aria-hidden />
            </Button>
          </FieldRow>
        </Band>
        <Band
          inset="content"
          label="Commits"
          ariaLabel="Commits"
          hint="For fixes made to answer a comment."
          icon={<CONCEPT_ICONS.commits size={ICON_SIZE.row} aria-hidden />}
          headingLevel={2}
        >
          <WorkspaceFieldRow workspaceId={workspaceId} field="resolveCommitStyle" layout="stacked">
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
          </WorkspaceFieldRow>
        </Band>
      </div>
      <section aria-label="Reply preview" className="flex min-w-0 flex-col gap-2">
        <SectionHeader
          label="Preview"
          hint="A reply with the settings on this page."
          headingLevel={2}
        />
        <BandStack>
          <Band inset="content">
            <p className="text-secondary text-muted-foreground">When fixed</p>
            {preview !== null && (
              <Markdown text={preview} variant="preview" className="text-label text-foreground" />
            )}
          </Band>
          <Band inset="content">
            <p className="text-secondary text-muted-foreground">When not changing</p>
            {noChangePreview !== null && (
              <Markdown
                text={noChangePreview}
                variant="preview"
                className="text-label text-foreground"
              />
            )}
          </Band>
        </BandStack>
      </section>
    </div>
  );
};
