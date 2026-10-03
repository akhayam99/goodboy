pub const MAX_BRANCH_NAME_LEN: usize = 100;

fn is_forbidden_char(c: char) -> bool {
    matches!(c, '~' | '^' | ':' | '?' | '*' | '[' | '\\') || c.is_ascii_control()
}

pub fn branch_name_problem(name: &str) -> Option<&'static str> {
    if name.is_empty() {
        return Some("empty");
    }
    if name.chars().any(char::is_whitespace) {
        return Some("whitespace");
    }
    if name.chars().any(is_forbidden_char) {
        return Some("character");
    }
    if name.contains("..") {
        return Some("double-dot");
    }
    if name.contains("@{") {
        return Some("at-brace");
    }
    if name == "@" {
        return Some("lone-at");
    }
    if name.starts_with('-') {
        return Some("starts-with-dash");
    }
    if name.starts_with('/') || name.ends_with('/') || name.contains("//") {
        return Some("slash");
    }
    if name.split('/').any(|segment| segment.starts_with('.')) {
        return Some("dot-segment");
    }
    if name.split('/').any(|segment| segment.ends_with(".lock")) {
        return Some("lock-segment");
    }
    if name.ends_with('.') {
        return Some("trailing-dot");
    }
    if name.chars().count() > MAX_BRANCH_NAME_LEN {
        return Some("too-long");
    }
    None
}

#[cfg(test)]
mod tests;
