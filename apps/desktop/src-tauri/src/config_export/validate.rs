use crate::config_export::bundle::{ConfigBundle, PermissionRuleBundle};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

pub(super) fn is_wildcard_allow(rule: &PermissionRuleBundle) -> bool {
    if rule.decision != "allow" {
        return false;
    }
    let matcher = rule.pattern_args_matcher.as_deref().unwrap_or("").trim();
    rule.pattern_tool.contains('*') || matcher.is_empty() || matcher.contains('*')
}

pub(super) fn validate_bundle(
    bundle: &ConfigBundle,
    accept_wildcard_allow: bool,
) -> Vec<ValidationError> {
    let mut errors: Vec<ValidationError> = Vec::new();
    for (i, w) in bundle.workspaces.iter().enumerate() {
        if w.id.trim().is_empty() {
            errors.push(ValidationError {
                field: format!("workspaces[{i}].id"),
                message: "id must not be empty".to_string(),
            });
        }
        if w.name.trim().is_empty() {
            errors.push(ValidationError {
                field: format!("workspaces[{i}].name"),
                message: "name must not be empty".to_string(),
            });
        }
    }
    for (i, r) in bundle.permission_rules.iter().enumerate() {
        if !matches!(r.scope.as_str(), "global" | "workspace") {
            errors.push(ValidationError {
                field: format!("permissionRules[{i}].scope"),
                message: format!("invalid scope '{}'; expected global|workspace", r.scope),
            });
        }
        if !matches!(r.decision.as_str(), "allow" | "deny" | "ask") {
            errors.push(ValidationError {
                field: format!("permissionRules[{i}].decision"),
                message: format!("invalid decision '{}'", r.decision),
            });
        }
        if !accept_wildcard_allow && is_wildcard_allow(r) {
            errors.push(ValidationError {
                field: format!("permissionRules[{i}].decision"),
                message: format!(
                    "wildcard allow rule for '{}' needs its own consent",
                    r.pattern_tool
                ),
            });
        }
    }
    for (i, b) in bundle.budget_rules.iter().enumerate() {
        if b.cap_usd < 0.0 {
            errors.push(ValidationError {
                field: format!("budgetRules[{i}].capUsd"),
                message: "capUsd must be non-negative".to_string(),
            });
        }
        if b.alert_threshold_pct < 0.0 || b.alert_threshold_pct > 100.0 {
            errors.push(ValidationError {
                field: format!("budgetRules[{i}].alertThresholdPct"),
                message: "alertThresholdPct must be 0-100".to_string(),
            });
        }
    }
    errors
}
