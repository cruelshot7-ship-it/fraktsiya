import { test } from "node:test";
import assert from "node:assert/strict";
import { joinConfirmText } from "./join-confirm.ts";

test("join confirm: names the person and the handle, asks to check identity", () => {
  assert.equal(
    joinConfirmText({ firstName: "Анна", lastName: "Петрова", telegramUsername: "@anna_p" }),
    "Принять Анна Петрова (@anna_p) в зал? Проверьте, что это тот же человек.",
  );
  assert.equal(
    joinConfirmText({ firstName: "Иван", lastName: "", telegramUsername: null }),
    "Принять Иван в зал? Проверьте, что это тот же человек.",
  );
});
