import { useEffect, useState } from 'react';
import { RotateCcw, Smartphone } from 'lucide-react';
import {
  Button,
  cn,
  Divider,
  FieldRow,
  formatError,
  PANE_RHYTHM,
  ScrollFade,
  SectionHeader,
  Select,
} from '@goodboy/ui';
import { GithubPanel } from '../../../../features/github/components/Panel';
import { ImportConfigDialog } from '../ImportConfigDialog';
import type { ConfigBundleImportResult } from '@goodboy/types';
import {
  DEFAULT_EDITOR_BINARY,
  SETTING_EDITOR_BINARY,
} from '../../../../features/settings/settings';
import { reopenWizard } from '../../../onboarding/onboarding-store';
import { useToast } from '../../../../app/components/Toast';
import { useAppStore } from '../../../../store';
import { useThemeStore } from '../../../../shared/lib/theme';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../reportIssueStudioEvent';
import { ShortcutsSection } from './ShortcutsSection';
import { StorageSection } from './StorageSection';
import { useSectionAnchors } from '../../hooks/useSectionAnchors';

type Props = {
  readonly initialSection?: string;
  readonly requestClose: () => void;
};

export const AppScopePanel = ({ initialSection, requestClose }: Props) => {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const exportConfig = useAppStore((s) => s.exportConfig);
  const importConfig = useAppStore((s) => s.importConfig);
  const wipeLocalDatabase = useAppStore((s) => s.wipeLocalDatabase);
  const loadDetectedEditors = useAppStore((s) => s.loadDetectedEditors);
  const detectedEditors = useAppStore((s) => s.detectedEditors);
  const { showToast } = useToast();

  const [editorBinary, setEditorBinary] = useState(DEFAULT_EDITOR_BINARY);

  useEffect(() => {
    if (detectedEditors.length === 0) {
      void loadDetectedEditors();
    }
  }, []);
  const [exportState, setExportState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ConfigBundleImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [wipeState, setWipeState] = useState<'idle' | 'confirm' | 'wiping' | 'done'>('idle');

  const { anchor } = useSectionAnchors({ section: initialSection });

  useEffect(() => {
    void loadSetting(SETTING_EDITOR_BINARY).then((v) =>
      setEditorBinary(v ?? DEFAULT_EDITOR_BINARY),
    );
  }, [loadSetting]);

  const onExport = async () => {
    setExportState('busy');
    try {
      const path = await exportConfig();
      setExportState(path ? 'done' : 'idle');
    } catch (err) {
      setExportState('error');
      showToast('error', formatError(err));
    }
  };

  const onImport = async () => {
    setImportResult(null);
    setImportError(null);
    try {
      const result = await importConfig();
      if (!result) {
        return;
      }
      setImportResult(result);
      setImportDialogOpen(true);
    } catch (err) {
      setImportError(formatError(err));
      setImportDialogOpen(true);
    }
  };

  const onChangeEditor = async (binary: string) => {
    setEditorBinary(binary);
    try {
      await saveSetting(SETTING_EDITOR_BINARY, binary || DEFAULT_EDITOR_BINARY);
      showToast('success', 'default editor saved');
    } catch (err) {
      showToast('error', formatError(err));
    }
  };

  const onWipe = async () => {
    setWipeState('wiping');
    try {
      await wipeLocalDatabase();
      setWipeState('done');
    } catch (err) {
      setWipeState('confirm');
      showToast('error', formatError(err));
    }
  };

  const editorOptions = detectedEditors.some((ed) => ed.binary === editorBinary)
    ? detectedEditors
    : [...detectedEditors, { binary: editorBinary, label: editorBinary }];

  return (
    <ScrollFade className="h-full w-full" viewportClassName={PANE_RHYTHM.body}>
      <div className={`flex flex-col ${PANE_RHYTHM.column} ${PANE_RHYTHM.measure.reading}`}>
        <div className="flex flex-col gap-6">
          <section
            id="appearance"
            ref={anchor({ id: 'appearance' })}
            className="flex flex-col gap-4"
          >
            <SectionHeader label="Appearance" hint="How the app looks on this computer." />
            <div className="flex flex-col">
              <FieldRow label="Theme" help="Applies to every window.">
                <Select
                  size="sm"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value === 'light' ? 'light' : 'dark')}
                  aria-label="Theme"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </Select>
              </FieldRow>
            </div>
          </section>

          <Divider />

          <section id="editor" ref={anchor({ id: 'editor' })} className="flex flex-col gap-4">
            <SectionHeader label="Editor" hint="How session worktrees open." />
            <div className="flex flex-col">
              <FieldRow label="Default editor" help="Opens session worktrees.">
                <Select
                  size="sm"
                  value={editorBinary}
                  onChange={(e) => void onChangeEditor(e.target.value)}
                  aria-label="Default editor"
                >
                  {editorOptions.map((editor) => (
                    <option key={editor.binary} value={editor.binary}>
                      {editor.label}
                    </option>
                  ))}
                </Select>
              </FieldRow>
            </div>
          </section>

          <Divider />

          <section id="shortcuts" ref={anchor({ id: 'shortcuts' })}>
            <ShortcutsSection initiallyExpanded={initialSection === 'shortcuts'} />
          </section>

          <Divider />

          <section
            id="integrations"
            ref={anchor({ id: 'integrations' })}
            className="flex flex-col gap-4"
          >
            <SectionHeader label="GitHub" hint="Global fallback token used by every workspace." />
            <GithubPanel hideSectionHeader />
          </section>

          <Divider />

          <section id="advanced" ref={anchor({ id: 'advanced' })} className="flex flex-col gap-4">
            <SectionHeader
              label="Config backup"
              hint="Export or import workspaces, skills, workflows, rules, and settings as JSON."
            />
            <FieldRow label="Backup file" help="API keys are never included.">
              <span className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void onExport()}
                  disabled={exportState === 'busy'}
                  className={exportState === 'busy' ? 'animate-border-pulse' : undefined}
                >
                  {exportState === 'busy'
                    ? 'Exporting…'
                    : exportState === 'done'
                      ? 'Exported'
                      : 'Export'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void onImport()}>
                  Import
                </Button>
              </span>
            </FieldRow>
          </section>

          <Divider />

          <section
            id="report-issue"
            ref={anchor({ id: 'report-issue' })}
            className="flex flex-col gap-4"
          >
            <SectionHeader label="Help" hint="Guides, your phone, and feedback." />
            <div className="flex flex-col">
              <FieldRow label="Setup guide" help="Replay the first-run walkthrough.">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    requestClose();
                    reopenWizard();
                  }}
                >
                  <RotateCcw size={14} aria-hidden /> Run setup again
                </Button>
              </FieldRow>

              <FieldRow label="Getting started" help="Open the guide.">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    requestClose();
                    window.dispatchEvent(new CustomEvent('goodboy:open-guide'));
                  }}
                >
                  <CONCEPT_ICONS.guide size={14} aria-hidden /> Open guide
                </Button>
              </FieldRow>

              <FieldRow label="iPhone" help="Follow your sessions from your phone.">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    requestClose();
                    window.dispatchEvent(new CustomEvent('goodboy:open-pair-device'));
                  }}
                >
                  <Smartphone size={14} aria-hidden /> Pair your iPhone
                </Button>
              </FieldRow>

              <FieldRow label="Feedback" help="You see exactly what gets sent before you send it.">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    requestClose();
                    window.dispatchEvent(new CustomEvent(REPORT_ISSUE_STUDIO_EVENT));
                  }}
                >
                  <CONCEPT_ICONS.reportIssue size={14} aria-hidden /> Report an issue
                </Button>
              </FieldRow>
            </div>
          </section>

          <Divider />

          <section id="storage" ref={anchor({ id: 'storage' })}>
            <StorageSection />
          </section>

          <Divider />

          <section
            id="initialization"
            ref={anchor({ id: 'initialization' })}
            className="flex flex-col gap-4"
          >
            <SectionHeader label="Danger zone" hint="Destructive local data controls." />
            <FieldRow
              label="Wipe local database"
              help="Every workspace, session, transcript, and rule. Keychain keys are untouched. Fresh schema on next boot."
            >
              {wipeState === 'done' ? (
                <span className="text-xs text-success">Wiped. Restart the app to start fresh.</span>
              ) : wipeState === 'confirm' || wipeState === 'wiping' ? (
                <span className="flex items-center gap-2 rounded-md bg-danger/5 px-2 py-1.5">
                  <span className="text-xs font-medium text-danger">Irreversible.</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWipeState('idle')}
                    disabled={wipeState === 'wiping'}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void onWipe()}
                    disabled={wipeState === 'wiping'}
                    className={cn(
                      'text-danger',
                      wipeState === 'wiping' && 'animate-border-pulse spin-border-danger',
                    )}
                  >
                    {wipeState === 'wiping' ? 'Wiping…' : 'Confirm'}
                  </Button>
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWipeState('confirm')}
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                >
                  Wipe
                </Button>
              )}
            </FieldRow>
          </section>
        </div>
      </div>

      <ImportConfigDialog
        open={importDialogOpen}
        result={importResult}
        error={importError}
        onClose={() => setImportDialogOpen(false)}
      />
    </ScrollFade>
  );
};
