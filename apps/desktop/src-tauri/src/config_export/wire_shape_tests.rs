use crate::config_export::apply::{ImportResult, ImportStats};
use crate::config_export::bundle::{
    AppPreferencesBundle, BudgetRuleBundle, ConfigBundle, PermissionRuleBundle,
    PhaseDefinitionBundle, PhaseTemplateBundle, ProfileBundle, ProjectBundle, ScriptBundle,
    SkillBundle, ToolBindingBundle, WorkspaceBundle, WorkspaceOverridesBundle,
};
use crate::config_export::groups::{ExportCounts, ExportGroups, ExportPreview, LeftOutFinding};
use crate::config_export::preview::{
    ImportGroupStat, ImportManifest, ImportPreview, ProjectMatch, WorkspaceMatch,
};
use crate::config_export::validate::ValidationError;
use serde::Serialize;

fn assert_roundtrip<T: serde::de::DeserializeOwned + Serialize>(json: &str) {
    let value: T = serde_json::from_str(json).unwrap();
    assert_eq!(serde_json::to_string(&value).unwrap(), json);
}

#[test]
fn profile_bundle_wire_json_is_pinned() {
    assert_roundtrip::<ProfileBundle>(
        r#"{"rolesJson":"v_rolesJson","aboutWork":"v_aboutWork","workingRules":"v_workingRules","explainMoreJson":"v_explainMoreJson"}"#,
    );
}

#[test]
fn workspace_bundle_wire_json_is_pinned() {
    assert_roundtrip::<WorkspaceBundle>(
        r#"{"id":"v_id","name":"v_name","rootPath":"v_rootPath","projects":[{"id":"v_id","name":"v_name","rootPath":"v_rootPath","kind":"v_kind","description":"v_description","starredAt":"v_starredAt","baseBranch":"v_baseBranch","rootCommit":"v_rootCommit","remoteUrl":"v_remoteUrl","createdAt":"v_createdAt","updatedAt":"v_updatedAt"}],"createdAt":"v_createdAt","updatedAt":"v_updatedAt","overrides":{"defaultProviderId":"v_defaultProviderId","defaultBranchPrefix":"v_defaultBranchPrefix","defaultVerbosity":"v_defaultVerbosity","providerBindings":{"k":1},"taskModels":{"k":1},"roleModels":{"k":1},"parallelAgents":true,"providerPool":{"k":1},"attributionFooter":true,"replyVoice":"v_replyVoice","replyStyleNote":"v_replyStyleNote","replyTemplateFixed":"v_replyTemplateFixed","replyTemplateNoChange":"v_replyTemplateNoChange","resolveOnGithub":true,"resolveCommitStyle":"v_resolveCommitStyle","defaultBranchTemplate":"v_defaultBranchTemplate"},"profile":{"rolesJson":"v_rolesJson","aboutWork":"v_aboutWork","workingRules":"v_workingRules","explainMoreJson":"v_explainMoreJson"}}"#,
    );
}

#[test]
fn project_bundle_wire_json_is_pinned() {
    assert_roundtrip::<ProjectBundle>(
        r#"{"id":"v_id","name":"v_name","rootPath":"v_rootPath","kind":"v_kind","description":"v_description","starredAt":"v_starredAt","baseBranch":"v_baseBranch","rootCommit":"v_rootCommit","remoteUrl":"v_remoteUrl","createdAt":"v_createdAt","updatedAt":"v_updatedAt"}"#,
    );
}

#[test]
fn workspace_overrides_bundle_wire_json_is_pinned() {
    assert_roundtrip::<WorkspaceOverridesBundle>(
        r#"{"defaultProviderId":"v_defaultProviderId","defaultBranchPrefix":"v_defaultBranchPrefix","defaultVerbosity":"v_defaultVerbosity","providerBindings":{"k":1},"taskModels":{"k":1},"roleModels":{"k":1},"parallelAgents":true,"providerPool":{"k":1},"attributionFooter":true,"replyVoice":"v_replyVoice","replyStyleNote":"v_replyStyleNote","replyTemplateFixed":"v_replyTemplateFixed","replyTemplateNoChange":"v_replyTemplateNoChange","resolveOnGithub":true,"resolveCommitStyle":"v_resolveCommitStyle","defaultBranchTemplate":"v_defaultBranchTemplate"}"#,
    );
}

#[test]
fn skill_bundle_wire_json_is_pinned() {
    assert_roundtrip::<SkillBundle>(
        r#"{"id":"v_id","workspaceId":"v_workspaceId","name":"v_name","description":"v_description","filePath":"v_filePath","body":"v_body","frontmatterJson":"v_frontmatterJson","createdAt":"v_createdAt","updatedAt":"v_updatedAt"}"#,
    );
}

#[test]
fn phase_definition_bundle_wire_json_is_pinned() {
    assert_roundtrip::<PhaseDefinitionBundle>(
        r#"{"id":"v_id","workflowId":"v_workflowId","ordinal":7,"name":"v_name","promptPrefix":"v_promptPrefix","providerOverride":"v_providerOverride","modelOverride":"v_modelOverride","role":"v_role","effort":"v_effort","expectedOutput":"v_expectedOutput","orchestratorReason":"v_orchestratorReason"}"#,
    );
}

#[test]
fn phase_template_bundle_wire_json_is_pinned() {
    assert_roundtrip::<PhaseTemplateBundle>(
        r#"{"id":"v_id","workspaceId":"v_workspaceId","name":"v_name","description":"v_description","steps":[{"id":"v_id","workflowId":"v_workflowId","ordinal":7,"name":"v_name","promptPrefix":"v_promptPrefix","providerOverride":"v_providerOverride","modelOverride":"v_modelOverride","role":"v_role","effort":"v_effort","expectedOutput":"v_expectedOutput","orchestratorReason":"v_orchestratorReason"}],"createdAt":"v_createdAt","updatedAt":"v_updatedAt","isPreset":true,"origin":"v_origin","goal":"v_goal","processText":"v_processText"}"#,
    );
}

#[test]
fn permission_rule_bundle_wire_json_is_pinned() {
    assert_roundtrip::<PermissionRuleBundle>(
        r#"{"id":"v_id","scope":"v_scope","workspaceId":"v_workspaceId","sessionId":"v_sessionId","patternTool":"v_patternTool","patternArgsMatcher":"v_patternArgsMatcher","decision":"v_decision","priority":7,"createdAt":"v_createdAt","updatedAt":"v_updatedAt"}"#,
    );
}

#[test]
fn budget_rule_bundle_wire_json_is_pinned() {
    assert_roundtrip::<BudgetRuleBundle>(
        r#"{"id":"v_id","provider":"v_provider","period":"v_period","capUsd":1.5,"alertThresholdPct":1.5,"createdAt":"v_createdAt"}"#,
    );
}

#[test]
fn script_bundle_wire_json_is_pinned() {
    assert_roundtrip::<ScriptBundle>(
        r#"{"id":"v_id","projectId":"v_projectId","name":"v_name","body":"v_body","sortOrder":7,"createdAt":"v_createdAt","updatedAt":"v_updatedAt"}"#,
    );
}

#[test]
fn tool_binding_bundle_wire_json_is_pinned() {
    assert_roundtrip::<ToolBindingBundle>(
        r#"{"workspaceId":"v_workspaceId","projectId":"v_projectId","provider":"v_provider","configJson":"v_configJson"}"#,
    );
}

#[test]
fn app_preferences_bundle_wire_json_is_pinned() {
    assert_roundtrip::<AppPreferencesBundle>(
        r#"{"editorBinary":"v_editorBinary","hiddenModelsJson":"v_hiddenModelsJson"}"#,
    );
}

#[test]
fn config_bundle_wire_json_is_pinned() {
    assert_roundtrip::<ConfigBundle>(
        r#"{"schemaVersion":7,"exportedAt":"v_exportedAt","workspaces":[{"id":"v_id","name":"v_name","rootPath":"v_rootPath","projects":[{"id":"v_id","name":"v_name","rootPath":"v_rootPath","kind":"v_kind","description":"v_description","starredAt":"v_starredAt","baseBranch":"v_baseBranch","rootCommit":"v_rootCommit","remoteUrl":"v_remoteUrl","createdAt":"v_createdAt","updatedAt":"v_updatedAt"}],"createdAt":"v_createdAt","updatedAt":"v_updatedAt","overrides":{"defaultProviderId":"v_defaultProviderId","defaultBranchPrefix":"v_defaultBranchPrefix","defaultVerbosity":"v_defaultVerbosity","providerBindings":{"k":1},"taskModels":{"k":1},"roleModels":{"k":1},"parallelAgents":true,"providerPool":{"k":1},"attributionFooter":true,"replyVoice":"v_replyVoice","replyStyleNote":"v_replyStyleNote","replyTemplateFixed":"v_replyTemplateFixed","replyTemplateNoChange":"v_replyTemplateNoChange","resolveOnGithub":true,"resolveCommitStyle":"v_resolveCommitStyle","defaultBranchTemplate":"v_defaultBranchTemplate"},"profile":{"rolesJson":"v_rolesJson","aboutWork":"v_aboutWork","workingRules":"v_workingRules","explainMoreJson":"v_explainMoreJson"}}],"skills":[{"id":"v_id","workspaceId":"v_workspaceId","name":"v_name","description":"v_description","filePath":"v_filePath","body":"v_body","frontmatterJson":"v_frontmatterJson","createdAt":"v_createdAt","updatedAt":"v_updatedAt"}],"phaseTemplates":[{"id":"v_id","workspaceId":"v_workspaceId","name":"v_name","description":"v_description","steps":[{"id":"v_id","workflowId":"v_workflowId","ordinal":7,"name":"v_name","promptPrefix":"v_promptPrefix","providerOverride":"v_providerOverride","modelOverride":"v_modelOverride","role":"v_role","effort":"v_effort","expectedOutput":"v_expectedOutput","orchestratorReason":"v_orchestratorReason"}],"createdAt":"v_createdAt","updatedAt":"v_updatedAt","isPreset":true,"origin":"v_origin","goal":"v_goal","processText":"v_processText"}],"permissionRules":[{"id":"v_id","scope":"v_scope","workspaceId":"v_workspaceId","sessionId":"v_sessionId","patternTool":"v_patternTool","patternArgsMatcher":"v_patternArgsMatcher","decision":"v_decision","priority":7,"createdAt":"v_createdAt","updatedAt":"v_updatedAt"}],"budgetRules":[{"id":"v_id","provider":"v_provider","period":"v_period","capUsd":1.5,"alertThresholdPct":1.5,"createdAt":"v_createdAt"}],"scripts":[{"id":"v_id","projectId":"v_projectId","name":"v_name","body":"v_body","sortOrder":7,"createdAt":"v_createdAt","updatedAt":"v_updatedAt"}],"toolBindings":[{"workspaceId":"v_workspaceId","projectId":"v_projectId","provider":"v_provider","configJson":"v_configJson"}],"appPreferences":{"editorBinary":"v_editorBinary","hiddenModelsJson":"v_hiddenModelsJson"}}"#,
    );
}

#[test]
fn export_groups_wire_json_is_pinned() {
    assert_roundtrip::<ExportGroups>(
        r#"{"workspaces":true,"projects":true,"folderPaths":true,"profile":true,"workflowsYours":true,"workflowsOrchestrated":true,"scripts":true,"permissionRules":true,"budgetRules":true,"integrations":true,"appPreferences":true}"#,
    );
}

#[test]
fn left_out_finding_wire_json_is_pinned() {
    let value = LeftOutFinding {
        fingerprint: "v_fingerprint".to_string(),
        subject_kind: "v_subjectKind".to_string(),
        subject_id: "v_subjectId".to_string(),
        secret_kind: "v_secretKind".to_string(),
        last4: "v_last4".to_string(),
    };
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"fingerprint":"v_fingerprint","subjectKind":"v_subjectKind","subjectId":"v_subjectId","secretKind":"v_secretKind","last4":"v_last4"}"#
    );
}

#[test]
fn export_counts_wire_json_is_pinned() {
    let value = ExportCounts {
        workspaces: 7,
        projects: 7,
        skills: 7,
        phase_templates: 7,
        permission_rules: 7,
        budget_rules: 7,
        scripts: 7,
        tool_bindings: 7,
    };
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"workspaces":7,"projects":7,"skills":7,"phaseTemplates":7,"permissionRules":7,"budgetRules":7,"scripts":7,"toolBindings":7}"#
    );
}

#[test]
fn export_preview_wire_json_is_pinned() {
    let value = ExportPreview {
        counts: ExportCounts {
            workspaces: 7,
            projects: 7,
            skills: 7,
            phase_templates: 7,
            permission_rules: 7,
            budget_rules: 7,
            scripts: 7,
            tool_bindings: 7,
        },
        left_out_findings: vec![LeftOutFinding {
            fingerprint: "v_fingerprint".to_string(),
            subject_kind: "v_subjectKind".to_string(),
            subject_id: "v_subjectId".to_string(),
            secret_kind: "v_secretKind".to_string(),
            last4: "v_last4".to_string(),
        }],
    };
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"counts":{"workspaces":7,"projects":7,"skills":7,"phaseTemplates":7,"permissionRules":7,"budgetRules":7,"scripts":7,"toolBindings":7},"leftOutFindings":[{"fingerprint":"v_fingerprint","subjectKind":"v_subjectKind","subjectId":"v_subjectId","secretKind":"v_secretKind","last4":"v_last4"}]}"#
    );
}

#[test]
fn validation_error_wire_json_is_pinned() {
    let value = ValidationError {
        field: "v_field".to_string(),
        message: "v_message".to_string(),
    };
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"field":"v_field","message":"v_message"}"#
    );
}

#[test]
fn import_stats_wire_json_is_pinned() {
    let value = ImportStats {
        workspaces: 7,
        skills: 7,
        phase_templates: 7,
        permission_rules: 7,
        budget_rules: 7,
        scripts: 7,
        tool_bindings: 7,
        unresolved_projects: 7,
    };
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"workspaces":7,"skills":7,"phaseTemplates":7,"permissionRules":7,"budgetRules":7,"scripts":7,"toolBindings":7,"unresolvedProjects":7}"#
    );
}

#[test]
fn import_result_wire_json_is_pinned() {
    let value = ImportResult {
        ok: true,
        errors: vec![ValidationError {
            field: "v_field".to_string(),
            message: "v_message".to_string(),
        }],
        stats: ImportStats {
            workspaces: 7,
            skills: 7,
            phase_templates: 7,
            permission_rules: 7,
            budget_rules: 7,
            scripts: 7,
            tool_bindings: 7,
            unresolved_projects: 7,
        },
    };
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"ok":true,"errors":[{"field":"v_field","message":"v_message"}],"stats":{"workspaces":7,"skills":7,"phaseTemplates":7,"permissionRules":7,"budgetRules":7,"scripts":7,"toolBindings":7,"unresolvedProjects":7}}"#
    );
}

#[test]
fn import_manifest_wire_json_is_pinned() {
    let value = ImportManifest {
        schema_version: 7,
        exported_at: "v_exportedAt".to_string(),
        workspace_count: 7,
        project_count: 7,
        workflow_count: 7,
    };
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"schemaVersion":7,"exportedAt":"v_exportedAt","workspaceCount":7,"projectCount":7,"workflowCount":7}"#
    );
}

#[test]
fn workspace_match_wire_json_is_pinned() {
    let value = WorkspaceMatch {
        bundle_id: "v_bundleId".to_string(),
        name: "v_name".to_string(),
        existing_id: Some("v_existingId".to_string()),
        action: "v_action".to_string(),
    };
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"bundleId":"v_bundleId","name":"v_name","existingId":"v_existingId","action":"v_action"}"#
    );
}

#[test]
fn project_match_wire_json_is_pinned() {
    let value = ProjectMatch {
        bundle_project_id: "v_bundleProjectId".to_string(),
        name: "v_name".to_string(),
        has_path: true,
        resolved_path: Some("v_resolvedPath".to_string()),
        verdict: "v_verdict".to_string(),
    };
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"bundleProjectId":"v_bundleProjectId","name":"v_name","hasPath":true,"resolvedPath":"v_resolvedPath","verdict":"v_verdict"}"#
    );
}

#[test]
fn import_group_stat_wire_json_is_pinned() {
    let value = ImportGroupStat {
        group: "v_group".to_string(),
        adds: 7,
        updates: 7,
    };
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"group":"v_group","adds":7,"updates":7}"#
    );
}

#[test]
fn import_preview_wire_json_is_pinned() {
    let value = ImportPreview {
        manifest: ImportManifest {
            schema_version: 7,
            exported_at: "v_exportedAt".to_string(),
            workspace_count: 7,
            project_count: 7,
            workflow_count: 7,
        },
        workspace_matches: vec![WorkspaceMatch {
            bundle_id: "v_bundleId".to_string(),
            name: "v_name".to_string(),
            existing_id: Some("v_existingId".to_string()),
            action: "v_action".to_string(),
        }],
        project_matches: vec![ProjectMatch {
            bundle_project_id: "v_bundleProjectId".to_string(),
            name: "v_name".to_string(),
            has_path: true,
            resolved_path: Some("v_resolvedPath".to_string()),
            verdict: "v_verdict".to_string(),
        }],
        group_stats: vec![ImportGroupStat {
            group: "v_group".to_string(),
            adds: 7,
            updates: 7,
        }],
    };
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"manifest":{"schemaVersion":7,"exportedAt":"v_exportedAt","workspaceCount":7,"projectCount":7,"workflowCount":7},"workspaceMatches":[{"bundleId":"v_bundleId","name":"v_name","existingId":"v_existingId","action":"v_action"}],"projectMatches":[{"bundleProjectId":"v_bundleProjectId","name":"v_name","hasPath":true,"resolvedPath":"v_resolvedPath","verdict":"v_verdict"}],"groupStats":[{"group":"v_group","adds":7,"updates":7}]}"#
    );
}

#[test]
fn app_preferences_bundle_reads_editor_default_but_never_writes_it() {
    let value: AppPreferencesBundle = serde_json::from_str(
        r#"{"editorBinary":null,"editorDefault":"v_editorDefault","hiddenModelsJson":null}"#,
    )
    .unwrap();
    assert_eq!(value.editor_default.as_deref(), Some("v_editorDefault"));
    assert_eq!(
        serde_json::to_string(&value).unwrap(),
        r#"{"editorBinary":null,"hiddenModelsJson":null}"#
    );
}
