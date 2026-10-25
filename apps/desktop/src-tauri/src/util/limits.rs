const KIB: u64 = 1024;
const MIB: u64 = 1024 * KIB;

pub(crate) const MAX_IMAGE_BYTES: usize = (10 * MIB) as usize;
pub(crate) const MAX_LOCAL_IMAGE_BYTES: u64 = 15 * MIB;
pub(crate) const MAX_TURN_LINE_BYTES: usize = (64 * MIB) as usize;
pub(crate) const MAX_PAGES: u32 = 20;

pub(crate) fn format_limit(bytes: u64) -> String {
    if bytes != 0 && bytes.is_multiple_of(MIB) {
        return format!("{} MiB", bytes / MIB);
    }
    if bytes != 0 && bytes.is_multiple_of(KIB) {
        return format!("{} KiB", bytes / KIB);
    }
    format!("{bytes} bytes")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_limit_prints_in_the_largest_whole_unit() {
        assert_eq!(format_limit(15 * MIB), "15 MiB");
        assert_eq!(format_limit(64 * MIB), "64 MiB");
        assert_eq!(format_limit(512 * KIB), "512 KiB");
        assert_eq!(format_limit(1_000), "1000 bytes");
        assert_eq!(format_limit(0), "0 bytes");
    }

    #[test]
    fn every_message_names_the_number_the_code_enforces() {
        assert_eq!(format_limit(MAX_IMAGE_BYTES as u64), "10 MiB");
        assert_eq!(format_limit(MAX_LOCAL_IMAGE_BYTES), "15 MiB");
        assert_eq!(format_limit(MAX_TURN_LINE_BYTES as u64), "64 MiB");
    }

    #[test]
    fn one_page_cap_serves_every_paged_read() {
        assert_eq!(MAX_PAGES, 20);
    }
}
