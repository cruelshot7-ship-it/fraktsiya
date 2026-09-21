import { BARCODE_CATALOG, type Kbju, type ScanProduct } from "@/data/studio";
import { getTelegram } from "@/lib/telegram";

const OFF_HOST = "https://world.openfoodfacts.org";
const OFF_UA = "Ruksha/1.0 (telegram-miniapp; studio-fit-by)";
const OFF_APP = "app_name=Ruksha&app_version=1.0.0";
/** Request the nutriments object — never individual nutrient keys (OFF flattens and drops the rest). */
const OFF_FIELDS = [
  "code",
  "product_name",
  "product_name_ru",
  "generic_name",
  "brands",
  "quantity",
  "product_quantity",
  "product_quantity_unit",
  "serving_size",
  "serving_quantity",
  "serving_quantity_unit",
  "nutrition_data_per",
  "no_nutrition_data",
  "nutriments",
  "image_front_small_url",
  "last_modified_t",
  "lang",
  "lc",
].join(",");

const CACHE_KEY = "ruksha:off-cache:v2";
const OVERLAY_KEY = "ruksha:food-overlay:v2";
const CIRCUIT_KEY = "ruksha:off-circuit:v2";
const META_KEY = "ruksha:food-meta:v2";
const REMOTE_KEY = "ruksha:food-remote:v2";

const FRESH_TTL = 7 * 86400000;
const STALE_TTL = 30 * 86400000;
const MISS_TTL = 24 * 3600000;
const OFF_TIMEOUT = 8000;
const OFF_MAX_PER_MIN = 12;
const OFF_GAP_MS = 500;
const CIRCUIT_FAILS = 3;
const CIRCUIT_MS = 5 * 60 * 1000;
const PRIME_TTL = 2 * 60 * 1000;

export type LookupReason =
  | "invalid"
  | "not_found"
  | "offline"
  | "rate_limit"
  | "timeout"
  | "disabled"
  | "error";

export type LookupResult =
  | { ok: true; product: ScanProduct }
  | { ok: false; code: string; reason: LookupReason; message: string };

type CatalogEntry = Omit<ScanProduct, "source" | "barcode">;
type OverlayMap = Record<string, CatalogEntry>;
type CacheEntry = { at: number; ttl: number; miss?: true; product?: ScanProduct; modified?: number };
type CircuitState = { fails: number; openUntil: number };
type FoodFeatures = { offLookup: boolean; remoteSearch: boolean };
type FoodMeta = { version: number; primedAt: number; sku: number; features?: FoodFeatures };

const LOOKUP_COPY: Record<LookupReason, string> = {
  invalid: "Не удалось распознать штрихкод. Снимите ещё раз или введите 8–14 цифр с упаковки.",
  not_found: "Штрихкода нет в Open Food Facts. Введите название и КБЖУ — сохраним в каталог студии.",
  offline: "Нет связи с базой продуктов. Каталог студии и кэш работают, OFF подождёт сеть.",
  rate_limit: "Слишком много запросов к Open Food Facts. Минута паузы — каталог и кэш на месте.",
  timeout: "Open Food Facts не ответил. Повторите или введите КБЖУ вручную — дневник не блокируется.",
  disabled: "Поиск в Open Food Facts выключен обновлением каталога. Студийный список работает.",
  error: "Сбой базы продуктов. Приложение не останавливается — введите КБЖУ или выберите из каталога.",
};

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<LookupResult>>();
const offStamps: number[] = [];
let lastOffAt = 0;
let overlay: OverlayMap = {};
let overlayReady = false;
let remoteCatalog: OverlayMap = {};
let features: FoodFeatures = { offLookup: true, remoteSearch: false };
let catalogVersion = 0;
let primedAt = 0;
let primeLock: Promise<void> | null = null;

function now() {
  return Date.now();
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    let raw = localStorage.getItem(key);
    if (!raw && key.startsWith("ruksha:")) {
      raw = localStorage.getItem(key.replace(/^ruksha:/, "fraktsiya:"));
    }
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota — app still runs */
  }
}

function loadOverlay() {
  if (overlayReady) return;
  overlay = readJson<OverlayMap>(OVERLAY_KEY, {});
  remoteCatalog = readJson<OverlayMap>(REMOTE_KEY, {});
  const meta = readJson<FoodMeta | null>(META_KEY, null);
  if (meta?.version) catalogVersion = meta.version;
  if (meta?.features) features = meta.features;
  overlayReady = true;
}

function circuit(): CircuitState {
  return readJson<CircuitState>(CIRCUIT_KEY, { fails: 0, openUntil: 0 });
}

function setCircuit(next: CircuitState) {
  writeJson(CIRCUIT_KEY, next);
}

export function foodDbStatus(): { label: string; paused: boolean; version: number; sku: number } {
  const sku = Object.keys(remoteCatalog).length || Object.keys(BARCODE_CATALOG).length;
  const c = circuit();
  if (!features.offLookup) {
    return { label: `Каталог студии v${catalogVersion || 1} · OFF выключен обновлением`, paused: true, version: catalogVersion, sku };
  }
  if (c.openUntil > now()) {
    const min = Math.max(1, Math.ceil((c.openUntil - now()) / 60000));
    return { label: `Open Food Facts на паузе ~${min} мин · каталог v${catalogVersion || 1} работает`, paused: true, version: catalogVersion, sku };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { label: `Офлайн · каталог студии v${catalogVersion || 1}`, paused: true, version: catalogVersion, sku };
  }
  return {
    label: `Open Food Facts + каталог v${catalogVersion || 1} · ${sku} SKU`,
    paused: false,
    version: catalogVersion,
    sku,
  };
}

function cacheGet(code: string): CacheEntry | null {
  const mem = memory.get(code);
  if (mem) return mem;
  const disk = readJson<Record<string, CacheEntry>>(CACHE_KEY, {});
  const hit = disk[code];
  if (!hit) return null;
  memory.set(code, hit);
  return hit;
}

function cacheSet(code: string, entry: CacheEntry) {
  memory.set(code, entry);
  const disk = readJson<Record<string, CacheEntry>>(CACHE_KEY, {});
  disk[code] = entry;
  const keys = Object.keys(disk);
  if (keys.length > 250) {
    keys
      .sort((a, b) => disk[a].at - disk[b].at)
      .slice(0, keys.length - 200)
      .forEach((k) => delete disk[k]);
  }
  writeJson(CACHE_KEY, disk);
}

export function rememberProduct(product: ScanProduct) {
  loadOverlay();
  overlay[product.barcode] = {
    name: product.name,
    brand: product.brand,
    per100: product.per100,
    quantity: product.quantity,
    servingGrams: product.servingGrams,
    image: product.image,
  };
  const keys = Object.keys(overlay);
  if (keys.length > 400) delete overlay[keys[0]];
  writeJson(OVERLAY_KEY, overlay);
}

function fromLayers(code: string): ScanProduct | null {
  loadOverlay();
  const studio = overlay[code];
  if (studio) return { barcode: code, ...studio, source: "studio" };
  const remote = remoteCatalog[code];
  if (remote) return { barcode: code, ...remote, source: "studio" };
  const local = BARCODE_CATALOG[code];
  if (local) return { barcode: code, ...local, source: "local" };
  return null;
}

function finiteNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function readOffKcal(n: Record<string, unknown>): number | null {
  const kcal = finiteNum(n["energy-kcal_100g"]);
  if (kcal !== null) return Math.round(kcal * 10) / 10;
  const kj = finiteNum(n["energy-kj_100g"]) ?? finiteNum(n.energy_100g);
  if (kj !== null) return Math.round(kj / 4.184);
  return null;
}

export function parseServingGrams(raw: string | number | undefined): number | undefined {
  if (typeof raw === "number" && raw > 0) return Math.round(raw);
  if (!raw) return undefined;
  const text = String(raw).replace(",", ".");
  const match = text.match(/(\d+(?:\.\d+)?)\s*(г|g|гр|ml|мл)/i);
  if (!match) return undefined;
  return Math.round(Number(match[1]));
}

function servingFromOff(product: Record<string, unknown>): number | undefined {
  const serving = finiteNum(product.serving_quantity);
  if (serving !== null && serving > 0 && serving <= 500) return Math.round(serving);
  const pack = finiteNum(product.product_quantity);
  if (pack !== null && pack > 0 && pack <= 500) return Math.round(pack);
  return parseServingGrams(product.serving_size as string | undefined);
}

function fromOff(barcode: string, product: Record<string, unknown>): ScanProduct {
  const nutriments = (product.nutriments ?? {}) as Record<string, unknown>;
  const kcal = readOffKcal(nutriments);
  const protein = finiteNum(nutriments.proteins_100g);
  const fat = finiteNum(nutriments.fat_100g);
  const carbs = finiteNum(nutriments.carbohydrates_100g);
  const rawName = String(
    product.product_name_ru || product.product_name || product.generic_name || "",
  ).trim();
  const unnamed = !rawName || /^\d{8,14}$/.test(rawName);
  const noTable = String(product.no_nutrition_data || "") === "on";
  const noNutri = noTable || (kcal === null && protein === null && fat === null && carbs === null);
  const image = String(product.image_front_small_url || "");
  return {
    barcode,
    name: unnamed ? `Товар ${barcode}` : rawName,
    brand: String(product.brands || "").split(",")[0]?.trim() || undefined,
    per100: {
      calories: kcal ?? 0,
      protein: protein ?? 0,
      fat: fat ?? 0,
      carbs: carbs ?? 0,
    },
    source: "off",
    quantity: String(product.quantity || "") || undefined,
    servingGrams: servingFromOff(product),
    incomplete: unnamed || noNutri,
    image: image.startsWith("http") ? image : undefined,
  };
}

export function normalizeGtin(digits: string): string {
  let d = digits.replace(/\D/g, "");
  if (d.length === 12) d = d.padStart(13, "0");
  if (d.length === 14 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export function parseScanText(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const fromUrl = s.match(/(?:openfoodfacts\.org\/(?:product|продукт)\/|id\.gs1\.org\/01\/)(\d{8,14})/i);
  if (fromUrl?.[1]) return normalizeGtin(fromUrl[1]);
  try {
    const u = new URL(s);
    for (const key of ["ean", "gtin", "barcode", "code", "ean13"]) {
      const v = u.searchParams.get(key);
      if (v && /^\d{8,14}$/.test(v)) return normalizeGtin(v);
    }
  } catch {
    /* not a URL */
  }
  const digits = s.replace(/\D/g, "");
  if ([8, 12, 13, 14].includes(digits.length)) return normalizeGtin(digits);
  return "";
}

function allowOffCall(): boolean {
  const t = now();
  while (offStamps.length && t - offStamps[0] > 60000) offStamps.shift();
  if (offStamps.length >= OFF_MAX_PER_MIN) return false;
  offStamps.push(t);
  return true;
}

function fail(code: string, reason: LookupReason): LookupResult {
  return { ok: false, code, reason, message: LOOKUP_COPY[reason] };
}

function sleep(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function readBody(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type OffKind = "found" | "miss" | LookupReason;

async function fetchOffOnce(code: string): Promise<{ kind: OffKind; product?: ScanProduct }> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), OFF_TIMEOUT);
  try {
    const wait = OFF_GAP_MS - (now() - lastOffAt);
    if (wait > 0) await sleep(wait);
    lastOffAt = now();
    const url = `${OFF_HOST}/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}&lc=ru&cc=by&${OFF_APP}`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "X-User-Agent": OFF_UA },
    });
    const data = await readBody(res);
    if (res.status === 429) return { kind: "rate_limit" };
    if (res.status === 503 || res.status === 502 || res.status >= 500) return { kind: "error" };
    if (!data) {
      if (res.status === 404) return { kind: "miss" };
      return { kind: "error" };
    }
    const status = typeof data.status === "number" ? data.status : null;
    const verbose = String(data.status_verbose || "");
    if (status === 0 && /invalid/i.test(verbose)) return { kind: "invalid" };
    if (res.status === 404 || status === 0 || !data.product) return { kind: "miss" };
    if (status === 1 && data.product && typeof data.product === "object") {
      return { kind: "found", product: fromOff(code, data.product as Record<string, unknown>) };
    }
    if (!res.ok) return { kind: "error" };
    return { kind: "error" };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError" || name === "TimeoutError") return { kind: "timeout" };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { kind: "offline" };
    return { kind: "error" };
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchOff(code: string): Promise<LookupResult> {
  if (!features.offLookup) return fail(code, "disabled");
  const gate = circuit();
  if (gate.openUntil > now()) return fail(code, "rate_limit");
  if (typeof navigator !== "undefined" && navigator.onLine === false) return fail(code, "offline");
  if (!allowOffCall()) return fail(code, "rate_limit");

  let result = await fetchOffOnce(code);
  if (result.kind === "timeout" || result.kind === "error") {
    await sleep(400);
    result = await fetchOffOnce(code);
  }

  if (result.kind === "found" && result.product) {
    setCircuit({ fails: 0, openUntil: 0 });
    cacheSet(code, { at: now(), ttl: STALE_TTL, product: { ...result.product, source: "cache" } });
    return { ok: true, product: result.product };
  }
  if (result.kind === "miss") {
    setCircuit({ fails: 0, openUntil: 0 });
    cacheSet(code, { at: now(), ttl: MISS_TTL, miss: true });
    return fail(code, "not_found");
  }
  if (result.kind === "invalid") {
    setCircuit({ fails: 0, openUntil: 0 });
    return fail(code, "invalid");
  }

  const fails = gate.fails + 1;
  setCircuit({
    fails,
    openUntil: fails >= CIRCUIT_FAILS ? now() + CIRCUIT_MS : 0,
  });
  const reason: LookupReason =
    result.kind === "timeout" || result.kind === "rate_limit" || result.kind === "offline" || result.kind === "disabled"
      ? result.kind
      : "error";
  return fail(code, reason);
}

function cacheFresh(entry: CacheEntry): boolean {
  return now() - entry.at < FRESH_TTL;
}

function cacheUsable(entry: CacheEntry): boolean {
  return now() - entry.at < (entry.miss ? MISS_TTL : STALE_TTL);
}

async function lookupUniq(code: string): Promise<LookupResult> {
  if (!/^\d{8,14}$/.test(code)) return fail(code, "invalid");

  const bundled = fromLayers(code);
  if (bundled) return { ok: true, product: bundled };

  const cached = cacheGet(code);
  if (cached && cacheUsable(cached)) {
    if (cached.product) {
      if (!cacheFresh(cached) && features.offLookup) void fetchOff(code);
      return {
        ok: true,
        product: { ...cached.product, source: "cache", stale: !cacheFresh(cached) },
      };
    }
    if (cached.miss && cacheFresh(cached)) return fail(code, "not_found");
  }

  const live = await fetchOff(code);
  if (!live.ok && cached?.product) {
    return { ok: true, product: { ...cached.product, source: "cache", stale: true } };
  }
  return live;
}

export function lookupBarcode(raw: string): Promise<LookupResult> {
  const code = parseScanText(raw);
  if (!code) return Promise.resolve(fail("", "invalid"));
  const pending = inflight.get(code);
  if (pending) return pending;
  const job = lookupUniq(code).finally(() => inflight.delete(code));
  inflight.set(code, job);
  return job;
}

export async function lookupBarcodeProduct(raw: string): Promise<ScanProduct | null> {
  try {
    const result = await lookupBarcode(raw);
    return result.ok ? result.product : null;
  } catch {
    return null;
  }
}

function allKnown(): ScanProduct[] {
  loadOverlay();
  const map = new Map<string, ScanProduct>();
  for (const [code, item] of Object.entries(BARCODE_CATALOG)) {
    map.set(code, { barcode: code, ...item, source: "local" });
  }
  for (const [code, item] of Object.entries(remoteCatalog)) {
    map.set(code, { barcode: code, ...item, source: "studio" });
  }
  for (const [code, item] of Object.entries(overlay)) {
    map.set(code, { barcode: code, ...item, source: "studio" });
  }
  const disk = readJson<Record<string, CacheEntry>>(CACHE_KEY, {});
  for (const [code, entry] of Object.entries(disk)) {
    if (entry.product && !map.has(code)) map.set(code, { ...entry.product, source: "cache" });
  }
  return [...map.values()];
}

export function searchCatalog(query: string): ScanProduct[] {
  const q = query.trim().toLocaleLowerCase("ru-RU");
  if (q.length < 2) return [];
  return allKnown()
    .filter((item) => {
      const name = item.name.toLocaleLowerCase("ru-RU");
      const brand = (item.brand || "").toLocaleLowerCase("ru-RU");
      return name.includes(q) || brand.includes(q) || item.barcode.includes(q);
    })
    .slice(0, 12);
}

/** Local-first. Remote full-text is off: cgi/search.pl is 503, Search-a-licious has no CORS. */
export async function searchOffByName(query: string): Promise<ScanProduct[]> {
  try {
    return searchCatalog(query);
  } catch {
    return [];
  }
}

function asEntry(raw: unknown): CatalogEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const name = String(p.name || "").trim();
  const per = (p.per100 ?? {}) as Record<string, unknown>;
  const calories = finiteNum(per.calories);
  if (!name || calories === null) return null;
  return {
    name,
    brand: String(p.brand || "") || undefined,
    per100: {
      calories,
      protein: finiteNum(per.protein) ?? 0,
      fat: finiteNum(per.fat) ?? 0,
      carbs: finiteNum(per.carbs) ?? 0,
    },
    quantity: String(p.quantity || "") || undefined,
    servingGrams: finiteNum(p.servingGrams) ?? undefined,
    image: String(p.image || "") || undefined,
  };
}

function ingestProducts(products: unknown): OverlayMap {
  const map: OverlayMap = {};
  if (Array.isArray(products)) {
    for (const item of products) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const code = normalizeGtin(String(rec.code || rec.barcode || ""));
      const entry = asEntry(item);
      if (code && entry) map[code] = entry;
    }
    return map;
  }
  if (products && typeof products === "object") {
    for (const [code, item] of Object.entries(products as Record<string, unknown>)) {
      const entry = asEntry(item);
      const key = normalizeGtin(code);
      if (key && entry) map[key] = entry;
    }
  }
  return map;
}

async function doPrime() {
  loadOverlay();
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`/food-catalog.json?t=${now()}`, { signal: ctrl.signal, cache: "no-store" });
    window.clearTimeout(timer);
    if (!res.ok) return;
    const data = (await res.json()) as {
      version?: number;
      features?: Partial<FoodFeatures>;
      products?: unknown;
    };
    const next = ingestProducts(data.products);
    if (Object.keys(next).length) {
      remoteCatalog = next;
      writeJson(REMOTE_KEY, remoteCatalog);
    }
    if (typeof data.version === "number") catalogVersion = data.version;
    features = {
      offLookup: data.features?.offLookup !== false,
      remoteSearch: data.features?.remoteSearch === true,
    };
    primedAt = now();
    writeJson(META_KEY, {
      version: catalogVersion,
      primedAt,
      sku: Object.keys(remoteCatalog).length,
      features,
    } satisfies FoodMeta);
  } catch {
    const meta = readJson<FoodMeta | null>(META_KEY, null);
    if (meta?.version) catalogVersion = meta.version;
    if (meta?.features) features = meta.features;
  }
}

export async function primeFoodDb(force = false) {
  if (!force && primedAt && now() - primedAt < PRIME_TTL) return;
  if (primeLock) return primeLock;
  primeLock = doPrime().finally(() => {
    primeLock = null;
  });
  return primeLock;
}

type Detector = {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
};

export function getBarcodeDetector(): Detector | null {
  const Ctor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => Detector }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code", "data_matrix"],
    });
  } catch {
    return null;
  }
}

export function extractTelegramScan(): ((cb: (text: string) => void) => boolean) | null {
  const tg = getTelegram();
  if (!tg?.showScanQrPopup) return null;
  return (cb) => {
    tg.showScanQrPopup?.({}, (text) => {
      tg.closeScanQrPopup?.();
      cb(text);
    });
    return true;
  };
}
