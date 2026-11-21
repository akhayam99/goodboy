use serde_json::Value;

const MAX_HELD_LINES: usize = 64;
const MAX_HELD_BYTES: usize = 256 * 1024;

fn escape_control_chars_in_strings(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut is_in_string = false;
    let mut is_escaped = false;
    for ch in value.chars() {
        let replacement = match ch {
            '\n' => Some("\\n"),
            '\r' => Some("\\r"),
            '\t' => Some("\\t"),
            _ => None,
        };
        if let Some(replacement) = replacement.filter(|_| is_in_string && !is_escaped) {
            out.push_str(replacement);
            continue;
        }
        out.push(ch);
        if is_escaped {
            is_escaped = false;
            continue;
        }
        if ch == '\\' {
            is_escaped = true;
            continue;
        }
        if ch == '"' {
            is_in_string = !is_in_string;
        }
    }
    out
}

fn parse_loose(text: &str) -> Option<Value> {
    let text = text.trim();
    serde_json::from_str::<Value>(text)
        .ok()
        .or_else(|| serde_json::from_str::<Value>(&escape_control_chars_in_strings(text)).ok())
        .filter(Value::is_object)
}

fn opens_object(line: &str) -> bool {
    line.trim_start().starts_with('{')
}

#[derive(Default)]
pub(super) struct LineAssembler {
    held: Vec<String>,
    held_bytes: usize,
}

impl LineAssembler {
    pub(super) fn push(&mut self, line: &str) -> Vec<Value> {
        if self.held.is_empty() {
            if !opens_object(line) {
                return Vec::new();
            }
            return match parse_loose(line) {
                Some(value) => vec![value],
                None => self.hold(line),
            };
        }
        let mut joined = self.held.join("\n");
        joined.push('\n');
        joined.push_str(line);
        if let Some(value) = parse_loose(&joined) {
            self.release();
            return vec![value];
        }
        if opens_object(line) {
            if let Some(value) = parse_loose(line) {
                let mut values = self.release_values();
                values.push(value);
                return values;
            }
        }
        self.hold(line)
    }

    fn hold(&mut self, line: &str) -> Vec<Value> {
        self.held.push(line.to_string());
        self.held_bytes += line.len();
        if self.held.len() >= MAX_HELD_LINES || self.held_bytes >= MAX_HELD_BYTES {
            return self.release_values();
        }
        Vec::new()
    }

    fn release(&mut self) -> Vec<String> {
        self.held_bytes = 0;
        std::mem::take(&mut self.held)
    }

    fn release_values(&mut self) -> Vec<Value> {
        self.release()
            .iter()
            .filter_map(|line| parse_loose(line))
            .collect()
    }

    #[cfg(test)]
    pub(super) fn held_lines(&self) -> usize {
        self.held.len()
    }
}
