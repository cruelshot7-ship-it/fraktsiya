/**
 * Одна кнопка «Маршрут»: открывает карты, которые подходят устройству клиента.
 * iPhone и iPad → Apple Карты, Android → Google Maps, остальное (компьютер, веб) → Яндекс Карты.
 * Геолокация не нужна: маршрут строится до адреса зала.
 */

export type MapPlatform = "ios" | "android" | "other";
export type Venue = { name: string; address: string; yandexOrgUrl?: string };

const STOP_WORDS = new Set(["улица", "ул", "г", "город"]);

export function mapPlatform(userAgent: string): MapPlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

/** Адрес без написания: «Гродно, Лидская 1» и «Гродно, улица Лидская, 1» — один и тот же адрес. */
export function normalizeAddress(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !STOP_WORDS.has(word))
    .join(" ");
}

export function isVenueAddress(address: string, venue: Venue): boolean {
  const typed = normalizeAddress(address);
  return typed !== "" && typed === normalizeAddress(venue.address);
}

/**
 * Ссылка маршрута для устройства. Пусто, если адреса нет.
 * Адрес самого зала берётся в каноническом написании; карточка Яндекса открывается, если она известна.
 */
export function routeUrl(address: string, platform: MapPlatform, venue?: Venue): string {
  const typed = address.trim();
  if (!typed) return "";
  const atVenue = venue !== undefined && isVenueAddress(typed, venue);
  const q = atVenue ? venue.address : typed;
  const encoded = encodeURIComponent(q);
  if (platform === "ios") return `https://maps.apple.com/?daddr=${encoded}&dirflg=d`;
  if (platform === "android") return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  if (atVenue && venue.yandexOrgUrl) return venue.yandexOrgUrl;
  return `https://yandex.ru/maps/?rtext=~${encoded}&rtt=auto`;
}
