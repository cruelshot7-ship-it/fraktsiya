/**
 * Reads a product code out of whatever the camera, the Telegram QR popup, a photo or the keyboard gives us.
 * Pure: no network, no storage, so it is tested on its own.
 */

/** GTIN digits: 13 digits (EAN-13) with zeros added, 14 digits (ITF-14) without the leading zero. */
export function normalizeGtin(digits: string): string {
  let d = digits.replace(/\D/g, "");
  if (d.length === 12) d = d.padStart(13, "0");
  if (d.length === 14 && d.startsWith("0")) d = d.slice(1);
  return d;
}

function gtinOrEmpty(digits: string): string {
  return [8, 12, 13, 14].includes(digits.length) ? normalizeGtin(digits) : "";
}

/**
 * GS1 element strings: "(01)04600690101081(21)…", "0104600690101081…" and the symbology prefixes
 * "]C1" (GS1-128) and "]d2" (GS1 DataMatrix / QR). Application identifier 01 is the GTIN.
 */
function gs1Gtin(s: string): string {
  const bare = s.replace(/^\][A-Za-z]\d/, "").replace(/\x1d/g, "");
  const m = bare.match(/^(?:\(01\)|01)(\d{14})/);
  return m?.[1] ? normalizeGtin(m[1]) : "";
}

export function parseScanText(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  // a plain code first: a 14-digit GTIN that starts with "01" must not be read as a GS1 element string
  const plain = gtinOrEmpty(s.replace(/\s/g, ""));
  if (/^\d+$/.test(s.replace(/\s/g, "")) && plain) return plain;
  const gs1 = gs1Gtin(s);
  if (gs1) return gs1;
  const fromUrl = s.match(/(?:openfoodfacts\.org\/(?:product|продукт)\/|id\.gs1\.org\/01\/)(\d{8,14})/i);
  if (fromUrl?.[1]) return normalizeGtin(fromUrl[1]);
  let isUrl = false;
  try {
    const u = new URL(s);
    isUrl = true;
    for (const key of ["ean", "gtin", "barcode", "code", "ean13"]) {
      const v = u.searchParams.get(key);
      if (v && /^\d{8,14}$/.test(v)) return normalizeGtin(v);
    }
  } catch {
    /* not a URL */
  }
  // a link without a code in it: do not read the digits of its path and query as a barcode
  if (isUrl || /^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return "";
  // free text with the code printed in it, e.g. "EAN 4600 6901 01081"
  return gtinOrEmpty(s.replace(/\D/g, ""));
}
