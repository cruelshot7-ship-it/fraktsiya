/**
 * Штрихкоды GTIN. Чистые функции: без сервера и браузера, поэтому покрыты тестами.
 */

/** 12 знаков (UPC-A) дополняются нулём до 13 (EAN-13); 14 знаков с нулём в начале сводятся к 13. */
export function normalizeGtin(digits: string): string {
  let d = digits.replace(/\D/g, "");
  if (d.length === 12) d = d.padStart(13, "0");
  if (d.length === 14 && d.startsWith("0")) d = d.slice(1);
  return d;
}

/**
 * Контрольная цифра GS1 для EAN-8 и EAN-13. Настоящая упаковка всегда проходит проверку,
 * поэтому код с неверной цифрой не совпадёт ни с одной реальной упаковкой.
 */
export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{13}$/.test(code)) return false;
  const body = code.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const fromRight = body.length - i;
    sum += Number(body[i]) * (fromRight % 2 === 1 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(code[code.length - 1]);
}
