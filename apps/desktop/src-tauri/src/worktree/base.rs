use super::git::{commit_ref_exists, git};
use super::inspect::parse_porcelain;
use super::status::current_branch_name;
use super::types::BranchIntegration;
use std::path::Path;

fn default_base_ref(cwd: &Path) -> Option<String> {
    base_candidates(cwd, None)
        .into_iter()
        .find(|candidate| commit_ref_exists(cwd, candidate))
}

pub(crate) fn resolve_base_ref(cwd: &Path, base_branch: Option<&str>) -> Option<String> {
    let named = base_branch
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string);
    let Some(name) = named else {
        return default_base_ref(cwd);
    };
    let stripped = name
        .strip_prefix("refs/heads/")
        .or_else(|| name.strip_prefix("refs/remotes/"))
        .unwrap_or(name.as_str())
        .to_string();
    [
        format!("refs/remotes/origin/{stripped}"),
        format!("refs/heads/{stripped}"),
        stripped.clone(),
    ]
    .into_iter()
    .find(|candidate| commit_ref_exists(cwd, candidate))
}

pub(super) fn base_label(base_ref: &str) -> String {
    base_ref
        .strip_prefix("refs/remotes/")
        .or_else(|| base_ref.strip_prefix("refs/heads/"))
        .unwrap_or(base_ref)
        .to_string()
}

pub(super) fn branch_integration(
    cwd: &Path,
    base_branch: Option<&str>,
    has_head: bool,
) -> BranchIntegration {
    let Some(base_ref) = resolve_base_ref(cwd, base_branch) else {
        return BranchIntegration::Unknown;
    };
    let base = base_label(&base_ref);
    if !has_head {
        return BranchIntegration::Merged { base };
    }
    let Ok(raw) = git(cwd, &["rev-list", "--count", &format!("{base_ref}..HEAD")]) else {
        return BranchIntegration::Unknown;
    };
    let Ok(ahead) = raw.trim().parse::<u32>() else {
        return BranchIntegration::Unknown;
    };
    match ahead {
        0 => BranchIntegration::Merged { base },
        _ => BranchIntegration::Unmerged { base, ahead },
    }
}

pub(super) fn resolve_branch_range(cwd: &Path) -> String {
    resolve_base(cwd, None)
        .map(|(_, merge_base)| format!("{merge_base}..HEAD"))
        .unwrap_or_else(|| "HEAD".to_string())
}

pub(super) fn normalized_base(base: Option<&str>) -> Option<&str> {
    base.map(str::trim)
        .filter(|candidate| !candidate.is_empty())
}

pub(super) fn resolve_origin_head(cwd: &Path) -> Option<String> {
    git(cwd, &["symbolic-ref", "refs/remotes/origin/HEAD"])
        .ok()
        .map(|output| output.trim().to_string())
        .and_then(|reference| {
            reference
                .strip_prefix("refs/remotes/origin/")
                .map(str::to_string)
        })
        .filter(|branch| !branch.is_empty())
}

const KNOWN_DEFAULT_BRANCHES: [&str; 3] = ["main", "master", "develop"];

fn main_checkout_branch(cwd: &Path, allow_own: bool) -> Option<String> {
    let listing = git(cwd, &["worktree", "list", "--porcelain"]).ok()?;
    let checkout = parse_porcelain(&listing)
        .into_iter()
        .find(|entry| entry.is_main)?
        .branch?;
    match !allow_own && current_branch_name(cwd).as_deref() == Some(checkout.as_str()) {
        true => None,
        false => Some(checkout),
    }
}

pub(crate) fn default_base_name(cwd: &Path, allow_own_checkout: bool) -> Option<String> {
    base_candidates_with(cwd, None, allow_own_checkout)
        .into_iter()
        .find(|candidate| commit_ref_exists(cwd, candidate))
        .map(|candidate| {
            candidate
                .strip_prefix("origin/")
                .map(str::to_string)
                .unwrap_or(candidate)
        })
}

pub(super) fn base_candidates(cwd: &Path, configured_base: Option<&str>) -> Vec<String> {
    base_candidates_with(cwd, configured_base, false)
}

pub(super) fn base_candidates_with(
    cwd: &Path,
    configured_base: Option<&str>,
    allow_own_checkout: bool,
) -> Vec<String> {
    if let Some(base) = configured_base {
        return vec![format!("origin/{base}"), base.to_string()];
    }
    let mut candidates = Vec::new();
    let mut add = |candidate: String| {
        if candidates.iter().all(|existing| existing != &candidate) {
            candidates.push(candidate);
        }
    };
    if let Some(base) = resolve_origin_head(cwd) {
        add(format!("origin/{base}"));
        add(base);
    }
    let own = match allow_own_checkout {
        true => None,
        false => current_branch_name(cwd),
    };
    let known: Vec<&str> = KNOWN_DEFAULT_BRANCHES
        .into_iter()
        .filter(|name| own.as_deref() != Some(*name))
        .collect();
    for name in &known {
        add(format!("origin/{name}"));
    }
    for name in &known {
        add((*name).to_string());
    }
    if let Some(base) = main_checkout_branch(cwd, allow_own_checkout) {
        add(format!("origin/{base}"));
        add(base);
    }
    candidates
}

pub(crate) fn resolve_base(cwd: &Path, configured_base: Option<&str>) -> Option<(String, String)> {
    for base_ref in base_candidates(cwd, configured_base) {
        let merge_base = git(cwd, &["merge-base", "HEAD", &base_ref])
            .ok()
            .map(|out| out.trim().to_string())
            .filter(|sha| !sha.is_empty());
        if let Some(merge_base) = merge_base {
            return Some((base_ref, merge_base));
        }
    }
    None
}
