import { useEffect, useRef, useState } from "react";
import { Camera, Keyboard, ScanLine, X } from "lucide-react";
import { DEMO_BARCODES, scaleKbju, type ScanProduct } from "@/data/studio";
import {
  extractTelegramScan,
  foodDbStatus,
  getBarcodeDetector,
  lookupBarcode,
  rememberProduct,
  searchCatalog,
} from "@/lib/barcode";
import { Field, inputClass, SectionLabel, Surface } from "@/components/app/bits";
import { hapticNotify } from "@/lib/haptics";

export function ScannerSheet({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (product: ScanProduct, grams: number) => void;
}) {
  const [mode, setMode] = useState<"scan" | "manual" | "product" | "missing">("scan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ScanProduct | null>(null);
  const [grams, setGrams] = useState(100);
  const [code, setCode] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [status, setStatus] = useState(foodDbStatus());
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<ScanProduct[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftCal, setDraftCal] = useState("");
  const [draftP, setDraftP] = useState("");
  const [draftF, setDraftF] = useState("");
  const [draftC, setDraftC] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const resolving = useRef(false);

  useEffect(() => {
    const tick = () => setStatus(foodDbStatus());
    const id = window.setInterval(tick, 15000);
    return () => {
      window.clearInterval(id);
      stopCam();
    };
  }, []);

  function stopCam() {
    window.cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }

  async function resolveCode(raw: string) {
    if (resolving.current) return;
    resolving.current = true;
    stopCam();
    setBusy(true);
    setError(null);
    try {
      const result = await lookupBarcode(raw);
      setStatus(foodDbStatus());
      if (!result.ok) {
        setCode(result.code);
        setDraftName("");
        setDraftCal("");
        setDraftP("");
        setDraftF("");
        setDraftC("");
        setError(result.message);
        setMode("missing");
        hapticNotify("warning");
        return;
      }
      hapticNotify("success");
      const found = result.product;
      setProduct(found);
      setGrams(found.servingGrams && found.servingGrams > 0 ? found.servingGrams : 100);
      if (found.incomplete) {
        setDraftName(found.name.startsWith("Товар ") ? "" : found.name);
        setDraftCal(Number.isFinite(found.per100.calories) && found.per100.calories ? String(found.per100.calories) : "");
        setDraftP(found.per100.protein ? String(found.per100.protein) : "");
        setDraftF(found.per100.fat ? String(found.per100.fat) : "");
        setDraftC(found.per100.carbs ? String(found.per100.carbs) : "");
      }
      setMode("product");
    } catch {
      setError("Сбой поиска. Введите КБЖУ вручную — дневник не блокируется.");
      setMode("missing");
    } finally {
      setBusy(false);
      resolving.current = false;
    }
  }

  async function startCam() {
    setError(null);
    const tg = extractTelegramScan();
    if (tg) {
      tg((text) => void resolveCode(text));
      return;
    }
    const detector = getBarcodeDetector();
    if (!detector) {
      setMode("missing");
      setError("Камера этого устройства не читает штрихкод. Введите цифры с упаковки.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode("missing");
      setError("Камера недоступна в этом браузере. Введите код или выберите из каталога.");
      return;
    }
    try {
      const constraints: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        { video: true, audio: false },
      ];
      let stream: MediaStream | null = null;
      let lastErr: unknown;
      for (const next of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(next);
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!stream) {
        const name = lastErr instanceof DOMException ? lastErr.name : "";
        setMode("missing");
        setError(
          name === "NotAllowedError"
            ? "Нет доступа к камере. Разрешите её в настройках или введите код."
            : name === "NotFoundError"
              ? "Камера не найдена. Введите цифры с упаковки."
              : "Нет доступа к камере. Введите код или выберите товар из каталога.",
        );
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      video.srcObject = stream;
      await video.play();
      setCamOn(true);
      const tick = async () => {
        if (!streamRef.current || resolving.current) return;
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue;
          if (value) {
            await resolveCode(value);
            return;
          }
        } catch {
          /* keep scanning */
        }
        rafRef.current = window.requestAnimationFrame(() => void tick());
      };
      rafRef.current = window.requestAnimationFrame(() => void tick());
    } catch {
      setMode("missing");
      setError("Нет доступа к камере. Введите код или выберите товар из каталога.");
    }
  }

  async function fromPhoto(file: File) {
    setBusy(true);
    setError(null);
    const detector = getBarcodeDetector();
    if (!detector) {
      setBusy(false);
      setMode("missing");
      setError("Этот браузер не читает код с фото. Введите цифры.");
      return;
    }
    try {
      const bmp = await createImageBitmap(file);
      const codes = await detector.detect(bmp);
      bmp.close();
      const value = codes[0]?.rawValue;
      if (!value) {
        setBusy(false);
        setError("На фото код не разобрали. Снимите ближе, без блика.");
        return;
      }
      await resolveCode(value);
    } catch {
      setBusy(false);
      setError("Не удалось прочитать фото. Введите код вручную.");
    }
  }

  function onSearchChange(value: string) {
    setSearch(value);
    const q = value.trim();
    setHits(q.length >= 2 ? searchCatalog(q) : []);
    if (q.length >= 2) setError(null);
  }

  function commitProduct(next: ScanProduct, portion: number) {
    rememberProduct(next);
    onAdd(next, portion);
  }

  const readyProduct = product
    ? product.incomplete
      ? {
          ...product,
          name: draftName.trim() || product.name,
          per100: {
            calories: Number(draftCal) || 0,
            protein: Number(draftP) || 0,
            fat: Number(draftF) || 0,
            carbs: Number(draftC) || 0,
          },
          incomplete: false,
        }
      : product
    : null;
  const scaled = readyProduct ? scaleKbju(readyProduct.per100, grams) : null;
  const sourceLabel = product?.stale
    ? "Кэш · данные могли устареть"
    : product?.source === "off"
      ? "Open Food Facts"
      : product?.source === "cache"
        ? "Кэш Open Food Facts"
        : product?.source === "studio"
          ? "Каталог студии"
          : "Каталог студии";
  const canSaveProduct = product?.incomplete
    ? Boolean((draftName.trim() || readyProduct?.name) && draftCal.trim() !== "" && Number.isFinite(Number(draftCal)))
    : Boolean(readyProduct?.name.trim()) && Number.isFinite(readyProduct?.per100.calories ?? NaN);

  return (
    <div
      className="fixed inset-x-0 z-50 flex justify-center bg-background/80"
      style={{ top: "var(--vv-offset, 0px)", height: "var(--vv-height, 100dvh)" }}
    >
      <div className="flex h-full w-full max-w-app flex-col bg-background pb-[max(0.5rem,env(safe-area-inset-bottom,0px),var(--keyboard,0px))]">
        <div className="sheet-in flex min-h-0 flex-1 flex-col px-5 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl">Сканер</h2>
            <button
              type="button"
              onClick={() => {
                stopCam();
                onClose();
              }}
              className="pressable grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground"
              aria-label="Закрыть"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-tiny text-muted-foreground">{status.label}</p>

          {mode === "product" && readyProduct && scaled ? (
            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-8">
              <Surface glow={product?.incomplete ? "alert" : "ok"}>
                <SectionLabel>{sourceLabel}</SectionLabel>
                {product?.image ? (
                  <img
                    src={product.image}
                    alt=""
                    className="mt-2 h-16 w-16 rounded-lg object-cover"
                  />
                ) : null}
                <p className="font-display mt-2 text-xl leading-tight">{readyProduct.name}</p>
                {readyProduct.brand ? <p className="mt-1 text-tiny text-muted-foreground">{readyProduct.brand}</p> : null}
                <p className="mt-1 text-2xs text-muted-foreground tabular-nums">{readyProduct.barcode}</p>
                {product?.incomplete ? (
                  <p className="mt-2 text-tiny text-primary">В базе нет КБЖУ или названия. Заполните на 100 г — сохраним у себя.</p>
                ) : (
                  <p className="mt-3 text-tiny text-muted-foreground">На 100 г: {readyProduct.per100.calories} ккал</p>
                )}
              </Surface>
              {product?.incomplete ? (
                <div className="flex flex-col gap-2">
                  <Field label="Название">
                    <input className={inputClass} value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                  </Field>
                  <div className="grid grid-cols-4 gap-2">
                    <Field label="ккал">
                      <input className={inputClass} inputMode="decimal" value={draftCal} onChange={(e) => setDraftCal(e.target.value)} />
                    </Field>
                    <Field label="Б">
                      <input className={inputClass} inputMode="decimal" value={draftP} onChange={(e) => setDraftP(e.target.value)} />
                    </Field>
                    <Field label="Ж">
                      <input className={inputClass} inputMode="decimal" value={draftF} onChange={(e) => setDraftF(e.target.value)} />
                    </Field>
                    <Field label="У">
                      <input className={inputClass} inputMode="decimal" value={draftC} onChange={(e) => setDraftC(e.target.value)} />
                    </Field>
                  </div>
                </div>
              ) : null}
              <Surface>
                <SectionLabel>Порция</SectionLabel>
                <p className="font-display mt-2 text-3xl tabular-nums">
                  {grams}
                  <span className="ml-1 text-base font-sans font-normal text-muted-foreground">г</span>
                </p>
                <div className="mt-3 flex gap-1.5">
                  {[40, 100, 150, 250].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrams(g)}
                      className={`pressable h-11 flex-1 rounded-lg text-tiny font-medium ${grams === g ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                    >
                      {g} г
                    </button>
                  ))}
                </div>
                <input
                  className={`${inputClass} mt-2`}
                  inputMode="numeric"
                  value={grams}
                  onChange={(e) => setGrams(Number(e.target.value) || 0)}
                />
                <div className="mt-3 grid grid-cols-4 gap-2 text-tiny">
                  <span>{scaled.calories} ккал</span>
                  <span>Б {scaled.protein}</span>
                  <span>Ж {scaled.fat}</span>
                  <span>У {scaled.carbs}</span>
                </div>
              </Surface>
              <button
                type="button"
                disabled={!canSaveProduct}
                className="pressable h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-40"
                onClick={() => commitProduct(readyProduct, grams)}
              >
                В дневник и в каталог
              </button>
              {product?.source === "off" || product?.source === "cache" ? (
                <p className="text-center text-2xs text-muted-foreground">Данные: Open Food Facts, ODbL</p>
              ) : null}
              <button
                type="button"
                className="h-11 text-sm text-muted-foreground"
                onClick={() => {
                  setProduct(null);
                  setMode("scan");
                  setError(null);
                }}
              >
                Сканировать другой
              </button>
            </div>
          ) : (
            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-8">
              <div className="relative overflow-hidden rounded-xl bg-card shadow-border">
                <video
                  ref={videoRef}
                  className="aspect-[4/3] w-full bg-secondary object-cover"
                  playsInline
                  muted
                  autoPlay
                  controls={false}
                  disablePictureInPicture
                />
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="h-28 w-44 rounded-lg border-2 border-ok/80 shadow-glow-ok" />
                </div>
                {!camOn ? (
                  <div className="absolute inset-0 grid place-items-center bg-background/70 px-6 text-center">
                    <p className="text-sm text-muted-foreground">Наведите на штрихкод или QR на упаковке.</p>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => void startCam()}
                className="pressable flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
              >
                <ScanLine className="size-4" />
                {camOn ? "Ищем код…" : "Включить камеру"}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <label className="pressable flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-secondary text-sm">
                  <Camera className="size-4" />
                  Фото этикетки
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void fromPhoto(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    stopCam();
                    setMode("missing");
                  }}
                  className="pressable flex h-11 items-center justify-center gap-2 rounded-xl bg-secondary text-sm"
                >
                  <Keyboard className="size-4" />
                  Ввести код
                </button>
              </div>

              {mode === "manual" || mode === "missing" ? (
                <Surface>
                  <Field label="Штрихкод">
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="4600690101081"
                    />
                  </Field>
                  <button
                    type="button"
                    disabled={busy}
                    className="pressable mt-3 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
                    onClick={() => void resolveCode(code)}
                  >
                    {busy ? "Ищем…" : "Найти в базе"}
                  </button>
                </Surface>
              ) : null}

              {mode === "missing" ? (
                <Surface glow="alert">
                  <SectionLabel>Нет в базе — заведём сами</SectionLabel>
                  <div className="mt-3 flex flex-col gap-2">
                    <Field label="Название">
                      <input className={inputClass} value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Творог 5%" />
                    </Field>
                    <div className="grid grid-cols-4 gap-2">
                      <Field label="ккал/100г">
                        <input className={inputClass} inputMode="decimal" value={draftCal} onChange={(e) => setDraftCal(e.target.value)} />
                      </Field>
                      <Field label="Б">
                        <input className={inputClass} inputMode="decimal" value={draftP} onChange={(e) => setDraftP(e.target.value)} />
                      </Field>
                      <Field label="Ж">
                        <input className={inputClass} inputMode="decimal" value={draftF} onChange={(e) => setDraftF(e.target.value)} />
                      </Field>
                      <Field label="У">
                        <input className={inputClass} inputMode="decimal" value={draftC} onChange={(e) => setDraftC(e.target.value)} />
                      </Field>
                    </div>
                    <button
                      type="button"
                      className="pressable h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                      onClick={() => {
                        if (!draftName.trim() || draftCal.trim() === "" || !Number.isFinite(Number(draftCal))) return;
                        commitProduct(
                          {
                            barcode: code || `manual_${Date.now()}`,
                            name: draftName.trim(),
                            per100: {
                              calories: Number(draftCal) || 0,
                              protein: Number(draftP) || 0,
                              fat: Number(draftF) || 0,
                              carbs: Number(draftC) || 0,
                            },
                            source: "studio",
                          },
                          100,
                        );
                      }}
                    >
                      Сохранить и в дневник
                    </button>
                  </div>
                </Surface>
              ) : null}

              <Surface>
                <SectionLabel>Поиск по названию</SectionLabel>
                <p className="mt-1 text-2xs text-muted-foreground">Студия и кэш. Без живого поиска OFF — он роняет лимиты зала.</p>
                <div className="mt-2 flex gap-2">
                  <input
                    className={inputClass}
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="творог, гречка…"
                  />
                </div>
                {hits.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {hits.map((item) => (
                      <button
                        key={item.barcode}
                        type="button"
                        className="pressable rounded-lg bg-secondary px-3 py-2 text-left text-sm"
                        onClick={() => {
                          setProduct(item);
                          setGrams(item.servingGrams || 100);
                          setMode("product");
                        }}
                      >
                        {item.name}
                        <span className="mt-0.5 block text-tiny text-muted-foreground">
                          {item.brand ? `${item.brand} · ` : ""}
                          {item.per100.calories} ккал / 100 г
                        </span>
                      </button>
                    ))}
                  </div>
                ) : search.trim().length >= 2 ? (
                  <p className="mt-2 text-tiny text-muted-foreground">В каталоге нет. Заведите карточку выше — она останется в студии.</p>
                ) : null}
              </Surface>

              <div>
                <SectionLabel>Быстрый каталог</SectionLabel>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DEMO_BARCODES.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => void resolveCode(item.code)}
                      className="pressable h-9 rounded-full bg-secondary px-3 text-tiny"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {error ? <p className="text-sm text-primary">{error}</p> : null}
              {busy ? <p className="text-tiny text-muted-foreground">Ищем в базе…</p> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
