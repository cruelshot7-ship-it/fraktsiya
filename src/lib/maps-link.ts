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

/**
 * Кнопки маршрута для адреса зала: Яндекс и Google. Яндекс Навигатор отдельно не даём:
 * схема yandexnavi:// для маршрута по тексту адреса не подтверждена документацией.
 */
export function mapsAppLinks(address: string): MapAppLink[] {
  const url = (provider: "yandex" | "google") => mapsRouteUrl(address, provider);
  if (!address.trim()) return [];
  return [
    { label: "Яндекс Карты", url: url("yandex") },
    { label: "Google Maps", url: url("google") },
  ];
}
