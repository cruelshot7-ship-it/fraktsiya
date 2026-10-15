/**
 * Route link without requiring client geolocation.
 * Opens maps app / site with destination only.
 */

export function mapsRouteUrl(destination: string, provider: "yandex" | "google" = "yandex"): string {
  const q = destination.trim();
  if (!q) return "";
  const encoded = encodeURIComponent(q);
  if (provider === "google") {
    return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  }
  return `https://yandex.ru/maps/?rtext=~${encoded}&rtt=auto`;
}

export type MapAppLink = { label: string; url: string };
export type Venue = { name: string; yandexOrgUrl?: string };

/**
 * Кнопки маршрута: Яндекс Карты и Google Maps. С известным залом (venue) Яндекс открывает его карточку,
 * а Google ведёт до «название, адрес». Без зала — поиск по адресу. Яндекс Навигатор не даём:
 * схема yandexnavi:// для маршрута по тексту адреса не подтверждена документацией.
 */
export function mapsAppLinks(address: string, venue?: Venue): MapAppLink[] {
  const q = address.trim();
  if (!q) return [];
  const place = venue?.name ? `${venue.name}, ${q}` : q;
  return [
    {
      label: "Яндекс Карты",
      url: venue?.yandexOrgUrl ?? `https://yandex.ru/maps/?text=${encodeURIComponent(place)}`,
    },
    { label: "Google Maps", url: mapsRouteUrl(place, "google") },
  ];
}
