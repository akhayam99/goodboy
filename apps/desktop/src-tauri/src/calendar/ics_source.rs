use super::error::CalendarError;
use super::event::{CalendarEvent, CalendarInfo};
use super::ics::{parse_calendar, ParsedCalendar, Window};
use super::source::{CalendarSource, Range};

pub(crate) struct IcsSource {
    id: String,
    host: String,
    calendar: ParsedCalendar,
}

impl IcsSource {
    pub(crate) fn parse(id: &str, host: &str, body: &str) -> Result<Self, CalendarError> {
        Ok(Self {
            id: id.to_string(),
            host: host.to_string(),
            calendar: parse_calendar(body)?,
        })
    }
}

impl CalendarSource for IcsSource {
    fn calendars(&self) -> Result<Vec<CalendarInfo>, CalendarError> {
        Ok(vec![CalendarInfo {
            id: self.id.clone(),
            source_id: self.id.clone(),
            title: self
                .calendar
                .name
                .clone()
                .unwrap_or_else(|| self.host.clone()),
            account: Some(self.host.clone()),
        }])
    }

    fn events(&self, range: Range) -> Result<Vec<CalendarEvent>, CalendarError> {
        Ok(self.calendar.events(&Window {
            source_id: &self.id,
            calendar_id: &self.id,
            from_ms: range.from_ms,
            to_ms: range.to_ms,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_link_is_one_calendar_named_by_the_feed_or_its_host() {
        let named = IcsSource::parse(
            "src-1",
            "calendar.northwind.example",
            "BEGIN:VCALENDAR\r\nX-WR-CALNAME:Northwind team\r\nEND:VCALENDAR\r\n",
        )
        .unwrap();
        let calendars = named.calendars().unwrap();
        assert_eq!(calendars[0].id, "src-1");
        assert_eq!(calendars[0].title, "Northwind team");
        assert_eq!(
            calendars[0].account.as_deref(),
            Some("calendar.northwind.example")
        );
        let bare = IcsSource::parse(
            "src-2",
            "ics.acme.example",
            "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
        )
        .unwrap();
        assert_eq!(bare.calendars().unwrap()[0].title, "ics.acme.example");
    }
}
