use regex::Regex;
use sha2::{Digest, Sha256};

const MAX_SLUG_LEN: usize = 48;

pub fn slugify(input: &str, max_len: usize) -> String {
    let lowered = input.to_ascii_lowercase();
    let alnum_dash = Regex::new(r"[^a-z0-9-]+").unwrap();
    let collapsed_dashes = Regex::new(r"-+").unwrap();
    let edge_dashes = Regex::new(r"^-+|-+$").unwrap();

    let stage1 = alnum_dash.replace_all(&lowered, "-");
    let stage2 = collapsed_dashes.replace_all(&stage1, "-");
    let stage3 = edge_dashes.replace_all(&stage2, "");
    let truncated: String = stage3.chars().take(max_len).collect();
    let trimmed = truncated.trim_end_matches('-').to_string();

    if trimmed.is_empty() {
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        format!("{:x}", hasher.finalize()).chars().take(8).collect()
    } else {
        trimmed
    }
}

pub fn sanitize_slug(input: &str) -> String {
    slugify(input, MAX_SLUG_LEN)
}

#[cfg(test)]
mod tests;
