/**
 * Single switch for the shadergradient hero background.
 * Disable with VITE_SHADER_BG=0 (or false/off) at build time.
 */
export function isShaderBgEnabled(): boolean {
  const raw = (import.meta.env.VITE_SHADER_BG as string | undefined)?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return false;
  // default on for brand hero only
  return true;
}
