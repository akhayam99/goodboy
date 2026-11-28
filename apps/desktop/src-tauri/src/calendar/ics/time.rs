use std::collections::HashMap;

use chrono::{
    Datelike, Days, Local, NaiveDate, NaiveDateTime, NaiveTime, TimeDelta, TimeZone, Weekday,
};

use super::lines::{Component, Property};

const UTC_NAMES: [&str; 6] = ["UTC", "GMT", "ETC/UTC", "ETC/GMT", "Z", "ZULU"];
const WEEKDAYS: [(&str, Weekday); 7] = [
    ("MO", Weekday::Mon),
    ("TU", Weekday::Tue),
    ("WE", Weekday::Wed),
    ("TH", Weekday::Thu),
    ("FR", Weekday::Fri),
    ("SA", Weekday::Sat),
    ("SU", Weekday::Sun),
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Zone {
    Utc,
    Floating,
    Named(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Stamp {
    pub local: NaiveDateTime,
    pub zone: Zone,
    pub is_date: bool,
}

fn digits(text: &str) -> Option<u32> {
    if text.is_empty() || !text.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    text.parse().ok()
}

fn parse_date(text: &str) -> Option<NaiveDate> {
    if text.len() != 8 {
        return None;
    }
    let year = i32::try_from(digits(&text[0..4])?).ok()?;
    NaiveDate::from_ymd_opt(year, digits(&text[4..6])?, digits(&text[6..8])?)
}

pub(crate) fn parse_local(text: &str) -> Option<(NaiveDateTime, bool, bool)> {
    let text = text.trim();
    let (body, is_utc) = match text.strip_suffix('Z') {
        Some(body) => (body, true),
        None => (text, false),
    };
    let Some((day, clock)) = body.split_once('T') else {
        let date = parse_date(body)?;
        return Some((date.and_time(NaiveTime::MIN), true, false));
    };
    if clock.len() != 6 {
        return None;
    }
    let time = NaiveTime::from_hms_opt(
        digits(&clock[0..2])?,
        digits(&clock[2..4])?,
        digits(&clock[4..6])?,
    )?;
    Some((parse_date(day)?.and_time(time), false, is_utc))
}

fn zone_of(tzid: Option<&str>, is_utc: bool) -> Zone {
    if is_utc {
        return Zone::Utc;
    }
    let Some(tzid) = tzid.map(str::trim).filter(|tzid| !tzid.is_empty()) else {
        return Zone::Floating;
    };
    if UTC_NAMES.contains(&tzid.to_ascii_uppercase().as_str()) {
        return Zone::Utc;
    }
    Zone::Named(tzid.to_string())
}

pub(crate) fn parse_value(value: &str, tzid: Option<&str>, is_date_param: bool) -> Option<Stamp> {
    let (local, is_date, is_utc) = parse_local(value)?;
    if is_date || is_date_param {
        return Some(Stamp {
            local: local.date().and_time(NaiveTime::MIN),
            zone: Zone::Floating,
            is_date: true,
        });
    }
    Some(Stamp {
        local,
        zone: zone_of(tzid, is_utc),
        is_date: false,
    })
}

pub(crate) fn parse_stamp(property: &Property) -> Option<Stamp> {
    let is_date = property
        .param("VALUE")
        .is_some_and(|value| value.eq_ignore_ascii_case("DATE"));
    parse_value(&property.value, property.param("TZID"), is_date)
}

pub(crate) fn parse_stamps(property: &Property) -> Vec<Stamp> {
    let is_date = property
        .param("VALUE")
        .is_some_and(|value| value.eq_ignore_ascii_case("DATE"));
    property
        .value
        .split(',')
        .filter_map(|value| parse_value(value, property.param("TZID"), is_date))
        .collect()
}

pub(crate) fn weekday_of(token: &str) -> Option<Weekday> {
    WEEKDAYS
        .iter()
        .find(|(code, _)| token.eq_ignore_ascii_case(code))
        .map(|(_, weekday)| *weekday)
}

pub(crate) fn parse_weekday_token(token: &str) -> Option<(i32, Weekday)> {
    let token = token.trim();
    if token.len() < 2 {
        return None;
    }
    let (ordinal, code) = token.split_at(token.len() - 2);
    let weekday = weekday_of(code)?;
    if ordinal.is_empty() {
        return Some((0, weekday));
    }
    let ordinal: i32 = ordinal.trim_start_matches('+').parse().ok()?;
    (ordinal != 0 && ordinal.abs() <= 5).then_some((ordinal, weekday))
}

pub(crate) fn first_of_next_month(year: i32, month: u32) -> Option<NaiveDate> {
    match month {
        12 => NaiveDate::from_ymd_opt(year + 1, 1, 1),
        _ => NaiveDate::from_ymd_opt(year, month + 1, 1),
    }
}

pub(crate) fn nth_weekday(
    year: i32,
    month: u32,
    ordinal: i32,
    weekday: Weekday,
) -> Option<NaiveDate> {
    let first = NaiveDate::from_ymd_opt(year, month, 1)?;
    if ordinal > 0 {
        let shift =
            (7 + weekday.num_days_from_monday() - first.weekday().num_days_from_monday()) % 7;
        let date =
            first.checked_add_days(Days::new(u64::from(shift) + 7 * (ordinal as u64 - 1)))?;
        return (date.month() == month).then_some(date);
    }
    let last = first_of_next_month(year, month)?.pred_opt()?;
    let shift = (7 + last.weekday().num_days_from_monday() - weekday.num_days_from_monday()) % 7;
    let back = u64::from(shift) + 7 * (ordinal.unsigned_abs() as u64 - 1);
    let date = last.checked_sub_days(Days::new(back))?;
    (date.month() == month).then_some(date)
}

fn parse_offset(text: &str) -> Option<i64> {
    let text = text.trim();
    let (sign, body) = match text.split_at_checked(1)? {
        ("+", body) => (1, body),
        ("-", body) => (-1, body),
        _ => return None,
    };
    if body.len() != 4 && body.len() != 6 {
        return None;
    }
    let hours = i64::from(digits(&body[0..2])?);
    let minutes = i64::from(digits(&body[2..4])?);
    let seconds = body
        .get(4..6)
        .map_or(Some(0), |part| digits(part).map(i64::from))?;
    Some(sign * (hours * 3_600 + minutes * 60 + seconds))
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct YearlyRule {
    month: u32,
    ordinal: i32,
    weekday: Weekday,
    until: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Observance {
    onset: NaiveDateTime,
    offset_from: i64,
    offset_to: i64,
    rule: Option<YearlyRule>,
}

fn yearly_rule_of(value: &str) -> Option<YearlyRule> {
    let mut month = None;
    let mut day = None;
    let mut until = None;
    let mut is_yearly = false;
    for part in value.split(';') {
        let Some((key, raw)) = part.split_once('=') else {
            continue;
        };
        match key.trim().to_ascii_uppercase().as_str() {
            "FREQ" => is_yearly = raw.eq_ignore_ascii_case("YEARLY"),
            "BYMONTH" => month = digits(raw.trim()),
            "BYDAY" => day = parse_weekday_token(raw),
            "UNTIL" => until = parse_local(raw).map(|(local, _, _)| local),
            _ => {}
        }
    }
    let (ordinal, weekday) = day?;
    if !is_yearly || ordinal == 0 {
        return None;
    }
    Some(YearlyRule {
        month: month?,
        ordinal,
        weekday,
        until,
    })
}

fn observance_of(component: &Component) -> Option<Observance> {
    let onset = parse_local(&component.first("DTSTART")?.value)?.0;
    Some(Observance {
        onset,
        offset_from: parse_offset(&component.first("TZOFFSETFROM")?.value)?,
        offset_to: parse_offset(&component.first("TZOFFSETTO")?.value)?,
        rule: component
            .first("RRULE")
            .and_then(|rule| yearly_rule_of(&rule.value)),
    })
}

fn latest_onset(observance: &Observance, local: NaiveDateTime) -> Option<NaiveDateTime> {
    let Some(rule) = &observance.rule else {
        return (observance.onset <= local).then_some(observance.onset);
    };
    [local.year(), local.year() - 1]
        .into_iter()
        .filter_map(|year| nth_weekday(year, rule.month, rule.ordinal, rule.weekday))
        .map(|date| date.and_time(observance.onset.time()))
        .filter(|onset| *onset >= observance.onset && *onset <= local)
        .find(|onset| {
            rule.until
                .is_none_or(|until| *onset <= until + TimeDelta::hours(24))
        })
}

#[derive(Debug, Clone, Default)]
pub(crate) struct Zones {
    by_id: HashMap<String, Vec<Observance>>,
}

impl Zones {
    pub(crate) fn from_calendar(calendar: &Component) -> Self {
        let by_id = calendar
            .children
            .iter()
            .filter(|child| child.name == "VTIMEZONE")
            .filter_map(|zone| {
                let id = zone.first("TZID")?.value.trim().to_string();
                let observances = zone.children.iter().filter_map(observance_of).collect();
                Some((id, observances))
            })
            .collect();
        Self { by_id }
    }

    fn offset_of(&self, tzid: &str, local: NaiveDateTime) -> Option<i64> {
        let observances = self.by_id.get(tzid).filter(|list| !list.is_empty())?;
        let latest = observances
            .iter()
            .filter_map(|observance| latest_onset(observance, local).map(|at| (at, observance)))
            .max_by_key(|(at, _)| *at);
        if let Some((_, observance)) = latest {
            return Some(observance.offset_to);
        }
        observances
            .iter()
            .min_by_key(|observance| observance.onset)
            .map(|observance| observance.offset_from)
    }

    pub(crate) fn instant_ms(&self, local: NaiveDateTime, zone: &Zone) -> i64 {
        match zone {
            Zone::Utc => local.and_utc().timestamp_millis(),
            Zone::Named(tzid) => match self.offset_of(tzid, local) {
                Some(offset) => (local.and_utc().timestamp() - offset) * 1_000,
                None => floating_ms(local),
            },
            Zone::Floating => floating_ms(local),
        }
    }
}

pub(crate) fn floating_ms(local: NaiveDateTime) -> i64 {
    let resolved = Local.from_local_datetime(&local).earliest().or_else(|| {
        Local
            .from_local_datetime(&(local + TimeDelta::hours(1)))
            .earliest()
    });
    match resolved {
        Some(at) => at.timestamp_millis(),
        None => local.and_utc().timestamp_millis(),
    }
}

pub(crate) fn parse_duration_secs(text: &str) -> Option<i64> {
    let text = text.trim();
    let (sign, body) = match text.strip_prefix('-') {
        Some(body) => (-1, body),
        None => (1, text.strip_prefix('+').unwrap_or(text)),
    };
    let body = body.strip_prefix('P')?;
    let mut total = 0i64;
    let mut number = String::new();
    let mut is_time = false;
    for character in body.chars() {
        if character == 'T' {
            is_time = true;
            continue;
        }
        if character.is_ascii_digit() {
            number.push(character);
            continue;
        }
        let value: i64 = number.parse().ok()?;
        number.clear();
        let unit = match (character, is_time) {
            ('W', false) => 604_800,
            ('D', false) => 86_400,
            ('H', true) => 3_600,
            ('M', true) => 60,
            ('S', true) => 1,
            _ => return None,
        };
        total = total.checked_add(value.checked_mul(unit)?)?;
    }
    number.is_empty().then_some(sign * total)
}

#[cfg(test)]
mod tests {
    use super::super::lines::parse_components;
    use super::*;

    const ROME: &str = "BEGIN:VCALENDAR\nBEGIN:VTIMEZONE\nTZID:Europe/Rome\nBEGIN:DAYLIGHT\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200\nDTSTART:19700329T020000\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\nEND:DAYLIGHT\nBEGIN:STANDARD\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nDTSTART:19701025T030000\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\nEND:STANDARD\nEND:VTIMEZONE\nEND:VCALENDAR\n";

    fn at(text: &str) -> NaiveDateTime {
        parse_local(text).unwrap().0
    }

    fn utc_ms(text: &str) -> i64 {
        at(text).and_utc().timestamp_millis()
    }

    fn zones() -> Zones {
        Zones::from_calendar(&parse_components(ROME)[0])
    }

    #[test]
    fn a_tzid_with_its_vtimezone_follows_summer_and_winter_time() {
        let zone = Zone::Named("Europe/Rome".to_string());
        assert_eq!(
            zones().instant_ms(at("20260715T100000"), &zone),
            utc_ms("20260715T080000")
        );
        assert_eq!(
            zones().instant_ms(at("20261127T100000"), &zone),
            utc_ms("20261127T090000")
        );
        assert_eq!(
            zones().instant_ms(at("20260329T040000"), &zone),
            utc_ms("20260329T020000")
        );
        assert_eq!(
            zones().instant_ms(at("20260328T230000"), &zone),
            utc_ms("20260328T220000")
        );
    }

    #[test]
    fn utc_values_and_utc_names_are_utc() {
        let property = super::super::lines::parse_line("DTSTART:20261127T090000Z").unwrap();
        let stamp = parse_stamp(&property).unwrap();
        assert_eq!(stamp.zone, Zone::Utc);
        assert_eq!(
            zones().instant_ms(stamp.local, &stamp.zone),
            utc_ms("20261127T090000")
        );
        let named =
            super::super::lines::parse_line("DTSTART;TZID=Etc/UTC:20261127T090000").unwrap();
        assert_eq!(parse_stamp(&named).unwrap().zone, Zone::Utc);
    }

    #[test]
    fn a_date_value_is_an_all_day_stamp() {
        let property = super::super::lines::parse_line("DTSTART;VALUE=DATE:20261127").unwrap();
        let stamp = parse_stamp(&property).unwrap();
        assert!(stamp.is_date);
        assert_eq!(stamp.local, at("20261127T000000"));
        assert_eq!(stamp.zone, Zone::Floating);
    }

    #[test]
    fn an_unknown_tzid_falls_back_to_local_time() {
        let zone = Zone::Named("Cascadia/Nowhere".to_string());
        let local = at("20261127T100000");
        assert_eq!(zones().instant_ms(local, &zone), floating_ms(local));
    }

    #[test]
    fn broken_values_are_refused() {
        for broken in [
            "",
            "2026",
            "20261327T100000",
            "20261127T25",
            "2026112xT100000Z",
        ] {
            assert!(parse_local(broken).is_none(), "{broken}");
        }
    }

    #[test]
    fn the_nth_weekday_counts_from_either_end() {
        assert_eq!(
            nth_weekday(2026, 3, -1, Weekday::Sun),
            NaiveDate::from_ymd_opt(2026, 3, 29)
        );
        assert_eq!(
            nth_weekday(2026, 11, 2, Weekday::Tue),
            NaiveDate::from_ymd_opt(2026, 11, 10)
        );
        assert_eq!(nth_weekday(2026, 2, 5, Weekday::Mon), None);
    }

    #[test]
    fn durations_parse() {
        assert_eq!(parse_duration_secs("PT15M"), Some(900));
        assert_eq!(parse_duration_secs("P1DT2H30M"), Some(95_400));
        assert_eq!(parse_duration_secs("P1W"), Some(604_800));
        assert_eq!(parse_duration_secs("-PT5M"), Some(-300));
        assert_eq!(parse_duration_secs("PT5"), None);
        assert_eq!(parse_duration_secs("15M"), None);
    }

    #[test]
    fn weekday_tokens_carry_an_optional_ordinal() {
        assert_eq!(parse_weekday_token("MO"), Some((0, Weekday::Mon)));
        assert_eq!(parse_weekday_token("-1SU"), Some((-1, Weekday::Sun)));
        assert_eq!(parse_weekday_token("+2TU"), Some((2, Weekday::Tue)));
        assert_eq!(parse_weekday_token("9MO"), None);
        assert_eq!(parse_weekday_token("XX"), None);
    }
}
