import { useCallback, useEffect } from 'react';
import { REPLY_VOICES, RESOLVE_COMMIT_STYLES, type WorkspaceId } from '@goodboy/types';
import { Band, SegmentedTabs, Switch } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import { isAttributionEnabled } from '../../../../shared/utils/attribution';
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
import { COMMIT_STYLE_LABEL, VOICE_LABEL, VOICE_SAMPLE } from '../../../resolve/replySettingsCopy';
import { ReplyPreview } from './ReplyPreview';
import { ReplyStyleNoteField } from './ReplyStyleNoteField';
import { ReplyTemplatesBand } from './ReplyTemplatesBand';
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
  const attributionSave = useWorkspaceOverrideSave({
    workspaceId,
    field: 'attribution',
    saved: isAttributionEnabled({ overrides }),
    patchOf: ({ value: isOn }) => ({ attributionFooter: isOn }),
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

  const previewSettings = {
    ...settings,
    voice: voiceSave.value,
    isSigned: attributionSave.value,
    templateFixed: fixedSave.value,
    templateNoChange: noChangeSave.value,
  };
  const preview = buildResolutionReplyBody({
    closure: { commitSha: PREVIEW_SHA, reply: VOICE_SAMPLE[voiceSave.value] },
    prUrl: PREVIEW_PR_URL,
    settings: previewSettings,
  });
  const noChangePreview = buildResolutionReplyBody({
    closure: { reason: 'The sibling routes use the same name.' },
    prUrl: PREVIEW_PR_URL,
    settings: previewSettings,
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Band inset="content" label="How replies read" ariaLabel="How replies read" headingLevel={2}>
        <WorkspaceFieldRow workspaceId={workspaceId} field="replyVoice">
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
        <ReplyPreview label="Preview, a fixed comment" text={preview} />
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="attribution"
          help='Adds "Written by Goodboy" to every comment and reply.'
        >
          <Switch
            ariaLabel={NAMES.signReplies}
            checked={attributionSave.value}
            onChange={(isOn) => void attributionSave.save({ value: isOn })}
          />
        </WorkspaceFieldRow>
        <ReplyTemplatesBand
          saves={{ replyTemplateFixed: fixedSave, replyTemplateNoChange: noChangeSave }}
          noChangePreview={noChangePreview}
        />
      </Band>
      <Band inset="content" label="After a reply" ariaLabel="After a reply" headingLevel={2}>
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="resolveOnGithub"
          help="Off leaves it to the reviewer. Bitbucket threads stay open."
        >
          <Switch
            ariaLabel={NAMES.resolveTheThread}
            checked={resolveSave.value}
            onChange={(isNext) => void resolveSave.save({ value: isNext })}
          />
        </WorkspaceFieldRow>
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="editPostedReply"
          help="Also after a fixup. Adds an Update line, and GitHub may notify."
        >
          <Switch
            ariaLabel={NAMES.updateReplyAfterSquash}
            checked={editSave.value}
            onChange={(isNext) => void editSave.save({ value: isNext })}
          />
        </WorkspaceFieldRow>
      </Band>
      <Band inset="content" label="Commits" ariaLabel="Commits" headingLevel={2}>
        <WorkspaceFieldRow
          workspaceId={workspaceId}
          field="resolveCommitStyle"
          help="A fixup targets the commit that added the line."
        >
          <SegmentedTabs
            ariaLabel="A fix for a comment lands as"
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
  );
};
