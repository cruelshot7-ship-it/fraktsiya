/** Production stub. Full bridge lives in the Grok sandbox; Vercel runs top-level. */

export type PreviewHostBridgeOptions = {
  navigate?: (path: string) => void;
  getRoutePaths?: () => string[];
};

export function installPreviewHostBridge(
  _options: PreviewHostBridgeOptions = {},
): () => void {
  return () => {};
}

export function collectRoutePathsFromTree(_routeTree: unknown): string[] {
  return [];
}
