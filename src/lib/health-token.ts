/**
 * Токен для записи данных о здоровье клиента (ingest). Должен быть уникальным среди клиентов:
 * по нему ingest находит клиента. Pure, без импортов.
 */
const TOKEN_RE = /^[a-z0-9]{20,64}$/;

export function newHealthToken(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

/**
 * Выбор токена на сервере: свой уже выданный сохраняем; присланный клиентом принимаем,
 * только если формат верный и им не пользуется другой клиент; иначе выдаём новый.
 */
export function pickHealthToken(opts: {
  own?: string | null;
  proposed?: string | null;
  usedByOthers: Set<string>;
}): string {
  const own = (opts.own ?? "").toLowerCase();
  if (TOKEN_RE.test(own)) return own;
  const proposed = (opts.proposed ?? "").toLowerCase();
  if (TOKEN_RE.test(proposed) && !opts.usedByOthers.has(proposed)) return proposed;
  return newHealthToken();
}
