import { useCallback, useEffect } from 'react';
import { REPLY_VOICES, RESOLVE_COMMIT_STYLES, type WorkspaceId } from '@goodboy/types';
import { Band, BandStack, Markdown, SectionHeader, SegmentedTabs, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import { useSettingSave } from '../../hooks/useSettingSave';
import { useWorkspaceOverrideSave } from '../../hooks/useWorkspaceOverrideSave';
import { settingRowKey } from '../../settingRowKey';
import { SWITCH_SETTING } from '../../switchSetting';
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
};

type ValueParams<Value> = {
  readonly value: Value;
};

export const WorkspaceReviewRepliesSection = ({ workspaceId }: Props) => {
  const overrides = useAppStore((s) => s.workspaceOverrides[workspaceId] ?? null);
  const editKey = editPostedReplyKey({ workspaceId });
  const rawEdit = useAppStore((s) => s.settings[editKey]);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const settings = replySettingsOf({ layers: [overrides] });

  useEffect(() => {
    void loadSetting(editKey);
  }, [loadSetting, editKey]);

  const voiceSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'replyVoice',
    saved: settings.voice,
    patchOf: ({ value }) => ({ replyVoice: value }),
  });
  const noteSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'replyStyleNote',
    saved: settings.styleNote ?? '',
    patchOf: ({ value }) => ({ replyStyleNote: value.trim() === '' ? null : value }),
  });
  const fixedSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'replyTemplateFixed',
    saved: settings.templateFixed,
    patchOf: ({ value }) => ({
      replyTemplateFixed: value.trim() === REPLY_TEMPLATE_FIXED_DEFAULT ? null : value,
    }),
  });
  const noChangeSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'replyTemplateNoChange',
    saved: settings.templateNoChange,
    patchOf: ({ value }) => ({
      replyTemplateNoChange: value.trim() === REPLY_TEMPLATE_NO_CHANGE_DEFAULT ? null : value,
    }),
  });
  const resolveSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'resolveOnGithub',
    saved: settings.resolveOnGithub,
    patchOf: ({ value: isOn }) => ({ resolveOnGithub: isOn }),
  });
  const commitSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'resolveCommitStyle',
    saved: settings.commitStyle,
    patchOf: ({ value }) => ({ resolveCommitStyle: value }),
  });
  const writeEdit = useCallback(
    ({ value: isOn }: ValueParams<boolean>) =>
      saveSetting(editKey, isOn ? EDIT_POSTED_REPLY_ON : EDIT_POSTED_REPLY_OFF),
    [editKey, saveSetting],
  );
  const editSave = useSettingSave({
    rowKey: settingRowKey({ workspaceId, row: 'editPostedReply' }),
    saved: isEditPostedReplyOn({ raw: rawEdit }),
    write: writeEdit,
    display: SWITCH_SETTING.display,
    failureTitle: "Couldn't save the review reply settings",
    workspaceId,
  });

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
              value={voiceSave.value}
              options={REPLY_VOICES.map((voice) => ({
                value: voice,
                label: VOICE_LABEL[voice],
              }))}
              onChange={(voice) => void voiceSave.save({ value: voice })}
            />
          </WorkspaceFieldRow>
          {voiceSave.value === 'mine' && (
            <ReplyStyleNoteField
              workspaceId={workspaceId}
              value={noteSave.value === '' ? null : noteSave.value}
              isDisabled={noteSave.isSaving}
              save={noteSave}
              onSave={(note) => void noteSave.save({ value: note ?? '' })}
            />
          )}
        </Band>
        <Band
          inset="content"
          label="Templates"
          ariaLabel="Templates"
          hint="What a reply says around the reason."
          headingLevel={2}
        >
          <ReplyTemplateField
            label="When fixed"
            value={fixedSave.value}
            isDisabled={fixedSave.isSaving}
            save={fixedSave}
            onSave={(value) => void fixedSave.save({ value })}
          />
          <ReplyTemplateField
            label="When not changing"
            value={noChangeSave.value}
            isDisabled={noChangeSave.isSaving}
            save={noChangeSave}
            onSave={(value) => void noChangeSave.save({ value })}
          />
        </Band>
        <Band
          inset="content"
          label="Threads"
          ariaLabel="Threads"
          hint="What happens to a thread after a reply."
          headingLevel={2}
        >
          <WorkspaceFieldRow
            workspaceId={workspaceId}
            field="resolveOnGithub"
            help="Off leaves it open for the reviewer to resolve. Bitbucket threads always stay open."
          >
            <Switch
              ariaLabel={NAMES.markThreadResolved}
              checked={resolveSave.value}
              onChange={(isNext) => void resolveSave.save({ value: isNext })}
            />
          </WorkspaceFieldRow>
          <WorkspaceFieldRow
            workspaceId={workspaceId}
            field="editPostedReply"
            help="After a squash or fixup, adds an Update line to a reply Goodboy already posted. GitHub may notify people."
          >
            <Switch
              ariaLabel="Edit the posted reply"
              checked={editSave.value}
              onChange={(isNext) => void editSave.save({ value: isNext })}
            />
          </WorkspaceFieldRow>
        </Band>
        <Band
          inset="content"
          label="Commits"
          ariaLabel="Commits"
          hint="For fixes made to answer a comment."
          headingLevel={2}
        >
          <WorkspaceFieldRow workspaceId={workspaceId} field="resolveCommitStyle" layout="stacked">
            <SegmentedTabs
              ariaLabel="Commit style"
              size="sm"
              value={commitSave.value}
              options={RESOLVE_COMMIT_STYLES.map((style) => ({
                value: style,
                label: COMMIT_STYLE_LABEL[style],
              }))}
              onChange={(style) => void commitSave.save({ value: style })}
            />
          </WorkspaceFieldRow>
        </Band>
      </div>
      <section aria-label="Reply preview" className="flex min-w-0 flex-col gap-2">
        <SectionHeader label="Preview" headingLevel={2} />
        <BandStack>
          <Band inset="content">
            <p className="text-meta text-muted-foreground">When fixed</p>
            {preview !== null && (
              <Markdown text={preview} variant="preview" className="text-meta text-foreground" />
            )}
          </Band>
          <Band inset="content">
            <p className="text-meta text-muted-foreground">When not changing</p>
            {noChangePreview !== null && (
              <Markdown
                text={noChangePreview}
                variant="preview"
                className="text-meta text-foreground"
              />
            )}
          </Band>
        </BandStack>
      </section>
    </div>
  );
};
