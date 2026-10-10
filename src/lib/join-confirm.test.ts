import { test } from "node:test";
import assert from "node:assert/strict";
import { joinConfirmText, joinRejectText } from "./join-confirm.ts";

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

test("join reject: names the person and says the request can come back", () => {
  assert.equal(
    joinRejectText({ firstName: "Анна", lastName: "Петрова" }),
    "Отклонить заявку от Анна Петрова? Клиент сможет подать её снова.",
  );
});
