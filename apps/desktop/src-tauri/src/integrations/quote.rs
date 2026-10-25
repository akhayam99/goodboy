pub(crate) fn quoted_literal(value: &str) -> String {
    let mut quoted = String::with_capacity(value.len() + 2);
    quoted.push('"');
    for character in value.chars() {
        if character == '"' || character == '\\' {
            quoted.push('\\');
        }
        quoted.push(character);
    }
    quoted.push('"');
    quoted
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_plain_value_is_only_wrapped() {
        assert_eq!(quoted_literal("GB"), "\"GB\"");
        assert_eq!(quoted_literal(""), "\"\"");
    }

    #[test]
    fn a_slash_and_a_space_pass_through() {
        assert_eq!(quoted_literal("ak/feat x"), "\"ak/feat x\"");
    }

    #[test]
    fn a_quote_and_a_backslash_are_escaped_so_the_value_cannot_close_the_literal() {
        assert_eq!(quoted_literal("x\" OR a = \"y"), "\"x\\\" OR a = \\\"y\"");
        assert_eq!(quoted_literal("back\\slash"), "\"back\\\\slash\"");
        assert_eq!(quoted_literal("\\\""), "\"\\\\\\\"\"");
    }
}
