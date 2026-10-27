use serde_json::json;

use super::*;
use crate::util::wire_shape::assert_wire_roundtrip;

#[test]
fn wire_shape_settings_overrides() {
    assert_wire_roundtrip::<SettingsOverrides>(json!({
        "defaultProviderId": "claude",
        "defaultBranchPrefix": "ak",
        "defaultVerbosity": "terse",
        "providerBindings": { "a": "b" },
        "taskModels": { "a": "b" },
        "roleModels": { "a": "b" },
        "parallelAgents": true,
        "providerPool": ["claude", "codex"],
        "attributionFooter": false,
        "replyVoice": "plain",
        "replyStyleNote": "short",
        "replyTemplateFixed": "fixed",
        "replyTemplateNoChange": "unchanged",
        "resolveOnGithub": true,
        "resolveCommitStyle": "conventional",
        "afterMerge": "archive",
        "defaultBranchTemplate": "{user}/{slug}",
        "workflowRules": { "a": "b" },
    }));
}
