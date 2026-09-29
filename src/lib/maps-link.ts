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

export function openMapsRoute(destination: string): void {
  const url = mapsRouteUrl(destination);
  if (!url || typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}
