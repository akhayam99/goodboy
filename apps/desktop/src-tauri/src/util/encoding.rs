pub(crate) fn percent_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::percent_encode;

    #[test]
    fn percent_encode_escapes_branch_slashes_and_reserved() {
        assert_eq!(percent_encode("ak/feat-x"), "ak%2Ffeat-x");
        assert_eq!(percent_encode("a b"), "a%20b");
        assert_eq!(percent_encode("keep-._~"), "keep-._~");
    }

    #[test]
    fn percent_encode_escapes_each_utf8_byte_in_uppercase_hex() {
        assert_eq!(percent_encode("caf\u{e9}"), "caf%C3%A9");
        assert_eq!(percent_encode("a+b&c=d"), "a%2Bb%26c%3Dd");
        assert_eq!(percent_encode(""), "");
    }
}
