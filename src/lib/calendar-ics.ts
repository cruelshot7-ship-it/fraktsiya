/**
 * Export a single training booking as RFC5545 .ics (UTC timestamps).
 * No external calendar sync — client downloads the file.
 */

export type IcsEvent = {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  durationMin: number;
  timezone?: string;
  location?: string;
  url?: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toUtcStamp(date: string, time: string, timezone: string): string {
  const isoLocal = `${date}T${time.length === 5 ? time + ":00" : time}`;
  if (timezone === "Europe/Minsk" || timezone === "Europe/Moscow") {
    const d = new Date(`${isoLocal}+03:00`);
    return (
      `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
      `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
    );
  }
  const d = new Date(isoLocal);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildIcs(event: IcsEvent): string {
  const tz = event.timezone || "Europe/Minsk";
  const start = toUtcStamp(event.date, event.time, tz);
  const [hh, mm] = event.time.split(":").map(Number);
  const endMin = hh * 60 + mm + event.durationMin;
  const endH = Math.floor(endMin / 60) % 24;
  const endM = endMin % 60;
  const endDayOffset = Math.floor(endMin / (24 * 60));
  let endDate = event.date;
  if (endDayOffset > 0) {
    const d = new Date(`${event.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + endDayOffset);
    endDate = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const end = toUtcStamp(endDate, `${pad(endH)}:${pad(endM)}`, tz);
  const uid = `${event.id}@ruksha`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ruksha Discipline//Training//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toUtcStamp(event.date, event.time, tz)}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push("END:VEVENT", "END:VCALENDAR", "");
  return lines.join("\r\n");
}

export function downloadIcs(event: IcsEvent, filename?: string) {
  const body = buildIcs(event);
  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `training-${event.date}-${event.time.replace(":", "")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
