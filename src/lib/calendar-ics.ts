/**
 * RFC5545 .ics + open paths that work inside Telegram Mini App WebView.
 * Blob a.download is often blocked on iOS/Android Telegram.
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
  const t = time.length === 5 ? `${time}:00` : time;
  const isoLocal = `${date}T${t}`;
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
  const endMin = (hh || 0) * 60 + (mm || 0) + event.durationMin;
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
  const uid = `${event.id.replace(/[^a-zA-Z0-9_-]/g, "")}@ruksha`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ruksha Discipline//Training//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${start}`,
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

export function googleCalendarUrl(event: IcsEvent): string {
  const tz = event.timezone || "Europe/Minsk";
  const start = toUtcStamp(event.date, event.time, tz).replace(/Z$/, "");
  const [hh, mm] = event.time.split(":").map(Number);
  const endMin = (hh || 0) * 60 + (mm || 0) + event.durationMin;
  const endH = Math.floor(endMin / 60) % 24;
  const endM = endMin % 60;
  let endDate = event.date;
  if (endMin >= 24 * 60) {
    const d = new Date(`${event.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Math.floor(endMin / (24 * 60)));
    endDate = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const end = toUtcStamp(endDate, `${pad(endH)}:${pad(endM)}`, tz).replace(/Z$/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description || "",
    location: event.location || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function telegramOpenLink(url: string) {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } })
      .Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function openCalendarEvent(event: IcsEvent): "google" | "data" | "download" {
  const gcal = googleCalendarUrl(event);
  if (telegramOpenLink(gcal)) return "google";

  try {
    window.open(gcal, "_blank", "noopener,noreferrer");
    return "google";
  } catch {
    /* continue */
  }

  const body = buildIcs(event);
  const dataUrl = `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
  if (telegramOpenLink(dataUrl)) return "data";

  try {
    const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ruksha-${event.date}-${event.time.replace(":", "")}.ics`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return "download";
  } catch {
    window.location.href = dataUrl;
    return "data";
  }
}

export function downloadIcs(event: IcsEvent, filename?: string) {
  openCalendarEvent(event);
  void filename;
}
