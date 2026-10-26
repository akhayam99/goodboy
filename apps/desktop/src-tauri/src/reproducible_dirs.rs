#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Scope {
    Dependency,
    Output,
    TopOnly,
}

pub(crate) struct ReproducibleDir {
    pub(crate) name: &'static str,
    pub(crate) scope: Scope,
}

pub(crate) const REPRODUCIBLE_DIRS: &[ReproducibleDir] = &[
    ReproducibleDir {
        name: "node_modules",
        scope: Scope::Dependency,
    },
    ReproducibleDir {
        name: "__pycache__",
        scope: Scope::Dependency,
    },
    ReproducibleDir {
        name: ".venv",
        scope: Scope::Dependency,
    },
    ReproducibleDir {
        name: "venv",
        scope: Scope::Dependency,
    },
    ReproducibleDir {
        name: "Pods",
        scope: Scope::Dependency,
    },
    ReproducibleDir {
        name: "vendor",
        scope: Scope::Dependency,
    },
    ReproducibleDir {
        name: "dist",
        scope: Scope::Output,
    },
    ReproducibleDir {
        name: "build",
        scope: Scope::Output,
    },
    ReproducibleDir {
        name: "out",
        scope: Scope::Output,
    },
    ReproducibleDir {
        name: "target",
        scope: Scope::Output,
    },
    ReproducibleDir {
        name: "DerivedData",
        scope: Scope::Output,
    },
    ReproducibleDir {
        name: ".next",
        scope: Scope::Output,
    },
    ReproducibleDir {
        name: ".turbo",
        scope: Scope::Output,
    },
    ReproducibleDir {
        name: ".gradle",
        scope: Scope::Output,
    },
    ReproducibleDir {
        name: "coverage",
        scope: Scope::TopOnly,
    },
];

fn scope_of(name: &str) -> Option<Scope> {
    REPRODUCIBLE_DIRS
        .iter()
        .find(|entry| entry.name == name)
        .map(|entry| entry.scope)
}

pub(crate) fn is_dependency(name: &str) -> bool {
    scope_of(name) == Some(Scope::Dependency)
}

pub(crate) fn is_output_at_top(name: &str) -> bool {
    matches!(scope_of(name), Some(Scope::Output | Scope::TopOnly))
}

pub(crate) fn is_skipped_in_walk(name: &str) -> bool {
    matches!(scope_of(name), Some(Scope::Dependency | Scope::Output))
}

pub(crate) fn is_reproducible_at_top(name: &str) -> bool {
    scope_of(name).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn every_name_is_listed_once() {
        let names: HashSet<&str> = REPRODUCIBLE_DIRS.iter().map(|entry| entry.name).collect();

        assert_eq!(names.len(), REPRODUCIBLE_DIRS.len());
    }

    #[test]
    fn dependency_folders_count_at_any_depth_and_everywhere() {
        for name in [
            "node_modules",
            ".venv",
            "venv",
            "Pods",
            "__pycache__",
            "vendor",
        ] {
            assert!(is_dependency(name), "{name}");
            assert!(is_skipped_in_walk(name), "{name}");
            assert!(is_reproducible_at_top(name), "{name}");
            assert!(!is_output_at_top(name), "{name}");
        }
    }

    #[test]
    fn build_output_counts_at_the_top_and_is_skipped_by_the_version_walk() {
        for name in [
            "dist",
            "build",
            "out",
            "target",
            "DerivedData",
            ".next",
            ".turbo",
            ".gradle",
        ] {
            assert!(is_output_at_top(name), "{name}");
            assert!(is_skipped_in_walk(name), "{name}");
            assert!(!is_dependency(name), "{name}");
        }
    }

    #[test]
    fn coverage_is_reproducible_at_the_top_only() {
        assert!(is_output_at_top("coverage"));
        assert!(is_reproducible_at_top("coverage"));
        assert!(!is_skipped_in_walk("coverage"));
        assert!(!is_dependency("coverage"));
    }

    #[test]
    fn a_name_that_is_not_listed_is_never_reproducible() {
        for name in ["src", "notes", "Coverage", ".git", ".goodboy"] {
            assert!(!is_dependency(name), "{name}");
            assert!(!is_output_at_top(name), "{name}");
            assert!(!is_skipped_in_walk(name), "{name}");
            assert!(!is_reproducible_at_top(name), "{name}");
        }
    }
}
