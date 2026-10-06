from pathlib import Path

p = Path("src/components/app/clients-view.tsx")
t = p.read_text()
if "removeTyped" in t:
    print("already")
    raise SystemExit(0)

if "const [confirmRemove, setConfirmRemove] = useState(false);" not in t:
    raise SystemExit("confirmRemove state missing")
t = t.replace(
    "  const [confirmRemove, setConfirmRemove] = useState(false);",
    "  const [confirmRemove, setConfirmRemove] = useState(false);\n  const [removeTyped, setRemoveTyped] = useState(\"\");",
    1,
)

# when opening action menu reset typed
old_open = """            onClick={() => {
              if (open) {
                setActionClientId(null);
                setConfirmRemove(false);
              } else {
                setActionClientId(client.id);
                setConfirmRemove(false);
"""
new_open = """            onClick={() => {
              if (open) {
                setActionClientId(null);
                setConfirmRemove(false);
                setRemoveTyped("");
              } else {
                setActionClientId(client.id);
                setConfirmRemove(false);
                setRemoveTyped("");
"""
if old_open not in t:
    raise SystemExit("open handler missing")
t = t.replace(old_open, new_open, 1)

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
                )}
"""

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
                )}
"""

if old_del not in t:
    raise SystemExit("delete UI missing")
t = t.replace(old_del, new_del, 1)
p.write_text(t)
print("ok")
