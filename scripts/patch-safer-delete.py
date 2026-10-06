from pathlib import Path

p = Path("src/components/app/clients-view.tsx")
t = p.read_text()
if "removeTyped" in t and "Удалить навсегда" in t:
    print("already")
    raise SystemExit(0)

if "const [confirmRemove, setConfirmRemove] = useState(false);" not in t:
    raise SystemExit("confirmRemove missing")
if "const [removeTyped" not in t:
    t = t.replace(
        "  const [confirmRemove, setConfirmRemove] = useState(false);",
        "  const [confirmRemove, setConfirmRemove] = useState(false);\n  const [removeTyped, setRemoveTyped] = useState(\"\");",
        1,
    )

# reset typed when opening/closing action menu
old_open = """            onClick={() => {
              if (open) {
                setActionClientId(null);
                setConfirmRemove(false);
              } else {
                setActionClientId(client.id);
                setConfirmRemove(false);
              }
            }}"""
new_open = """            onClick={() => {
              if (open) {
                setActionClientId(null);
                setConfirmRemove(false);
                setRemoveTyped("");
              } else {
                setActionClientId(client.id);
                setConfirmRemove(false);
                setRemoveTyped("");
              }
            }}"""
if old_open in t:
    t = t.replace(old_open, new_open, 1)
else:
    print("warn: open handler pattern not found")

old_del = """                {!confirmRemove ? (
                  <button
                    type="button"
                    className="pressable flex h-11 items-center justify-center rounded-lg bg-primary/15 text-sm font-medium text-primary"
                    onClick={() => setConfirmRemove(true)}
                  >
                    Удалить клиента
                  </button>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className="pressable h-11 flex-1 rounded-lg bg-secondary text-sm"
                      onClick={() => setConfirmRemove(false)}
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      className="pressable h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                      onClick={() => {
                        removeClient(client.id);
                        showToast(`Клиент ${shortName(client)} удалён`);
                        setActionClientId(null);
                        setConfirmRemove(false);
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                )}"""

new_del = """                {!confirmRemove ? (
                  <button
                    type="button"
                    className="pressable flex h-11 items-center justify-center rounded-lg bg-primary/15 text-sm font-medium text-primary"
                    onClick={() => {
                      setConfirmRemove(true);
                      setRemoveTyped("");
                    }}
                  >
                    Удалить клиента
                  </button>
                ) : (
                  <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
                    <p className="text-tiny text-muted-foreground">
                      Безвозвратно. Введите имя «{client.firstName}» для подтверждения.
                    </p>
                    <input
                      className={inputClass}
                      value={removeTyped}
                      onChange={(e) => setRemoveTyped(e.target.value)}
                      placeholder={client.firstName}
                      autoComplete="off"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        className="pressable h-11 flex-1 rounded-lg bg-secondary text-sm"
                        onClick={() => {
                          setConfirmRemove(false);
                          setRemoveTyped("");
                        }}
                      >
                        Назад
                      </button>
                      <button
                        type="button"
                        disabled={removeTyped.trim().toLowerCase() !== String(client.firstName || "").trim().toLowerCase()}
                        className="pressable h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-40"
                        onClick={() => {
                          if (removeTyped.trim().toLowerCase() !== String(client.firstName || "").trim().toLowerCase()) {
                            showToast("Имя не совпало");
                            return;
                          }
                          removeClient(client.id);
                          showToast(`Клиент ${shortName(client)} удалён`);
                          setActionClientId(null);
                          setConfirmRemove(false);
                          setRemoveTyped("");
                        }}
                      >
                        Удалить навсегда
                      </button>
                    </div>
                  </div>
                )}"""

if old_del not in t:
    raise SystemExit("delete UI block not found")
t = t.replace(old_del, new_del, 1)
p.write_text(t)
print("ok")
