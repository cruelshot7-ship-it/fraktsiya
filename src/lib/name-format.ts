/**
 * Короткое имя клиента для списков: «Даник П.».
 * Убирает невидимые символы и любые пробельные (в том числе широкие и неразрывные),
 * иначе в имени появляется пустой промежуток.
 */
const INVISIBLE = /[​-‍﻿]/g;

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
}

export function shortName(client: { firstName: string; lastName?: string | null }): string {
  const first = clean(client.firstName);
  const last = clean(client.lastName);
  if (!last) return first;
  return `${first} ${last.charAt(0)}.`;
}
