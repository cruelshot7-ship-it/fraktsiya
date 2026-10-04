from pathlib import Path

p = Path("src/components/app/mini-app.tsx")
t = p.read_text()
if "CLIENT_NAV" in t and "NutritionView" in t and "showNav" in t:
    print("already patched")
    raise SystemExit(0)

t = t.replace(
    'import { Bell, CalendarDays, ClipboardList, LayoutGrid, MessageCircle, Sparkles, Users } from "lucide-react";',
    'import { Bell, CalendarDays, ClipboardList, LayoutGrid, MessageCircle, Sparkles, Users, Utensils } from "lucide-react";',
)
if "NutritionView" not in t:
    t = t.replace(
        'import { MoreView } from "@/components/app/more-view";',
        'import { MoreView } from "@/components/app/more-view";\nimport { NutritionView } from "@/components/app/nutrition-view";',
    )

old_tabs = '''const CLIENT_TABS: { id: TabId; label: string }[] = [
  { id: "today", label: "Сегодня" },
  { id: "schedule", label: "Расписание" },
  { id: "program", label: "Программа" },
  { id: "more", label: "Ещё" },
];

const TRAINER_NAV: { id: TabId; label: string; icon: typeof Users }[] = ['''

new_tabs = '''type NavItem = { id: TabId; label: string; icon: typeof Users };

const CLIENT_NAV: NavItem[] = [
  { id: "today", label: "Сегодня", icon: Sparkles },
  { id: "schedule", label: "Запись", icon: CalendarDays },
  { id: "program", label: "Программа", icon: ClipboardList },
  { id: "food", label: "Еда", icon: Utensils },
  { id: "more", label: "Ещё", icon: LayoutGrid },
];

const TRAINER_NAV: NavItem[] = ['''

if old_tabs not in t:
    raise SystemExit("CLIENT_TABS block missing")
t = t.replace(old_tabs, new_tabs, 1)

if "function navActive" not in t:
    t = t.replace(
        "export function MiniApp() {",
        '''function navActive(id: TabId, tab: TabId) {
  if (id === "schedule") return tab === "schedule" || tab === "slots" || tab === "bookings";
  if (id === "more") return tab === "more" || tab === "form" || tab === "hall";
  return tab === id;
}

export function MiniApp() {''',
        1,
    )

t = t.replace(
    'if (getStartParam().toLowerCase().startsWith("m_")) setTab("more" as TabId);',
    'if (getStartParam().toLowerCase().startsWith("m_")) setTab("hall" as TabId);',
)

if "const showNav" not in t:
    t = t.replace(
        "  const soon = nextMine ? hoursUntilSlot(nextMine.date, nextMine.time) : null;\n\n  const title",
        "  const soon = nextMine ? hoursUntilSlot(nextMine.date, nextMine.time) : null;\n\n  const showNav = role === \"trainer\" || (!inviteBlocked && !sheetClientId && !guestPreview);\n  const navItems = role === \"trainer\" ? TRAINER_NAV : CLIENT_NAV;\n\n  const title",
        1,
    )

# Remove client top tabs strip
import re
t = re.sub(
    r"\n        \{role === \"client\" && !inviteBlocked \? \([\s\S]*?\) : null\}\n",
    "\n",
    t,
    count=1,
)

t = t.replace(
    'role === "trainer" ? "pb-24" : "pb-10"',
    'showNav ? "pb-24" : "pb-10"',
)
t = t.replace(
    'role === "trainer" ? "bottom-20" : "bottom-3"',
    'showNav ? "bottom-20" : "bottom-3"',
)

t = t.replace(
    '{tab === "more" || tab === "food" || tab === "form" || tab === "hall" ? <MoreView /> : null}',
    '''{tab === "food" ? <NutritionView /> : null}
            {tab === "more" || tab === "form" || tab === "hall" ? (
              <MoreView initial={tab === "hall" ? "hall" : "form"} />
            ) : null}''',
)

# Bottom nav for both roles
t = t.replace(
    '{role === "trainer" ? (\n          <nav',
    '{showNav ? (\n          <nav',
)
t = t.replace(
    "{TRAINER_NAV.map((item) => {\n                const active =\n                  tab === item.id ||\n                  (item.id === \"schedule\" && (tab === \"slots\" || tab === \"bookings\"));",
    "{navItems.map((item) => {\n                const active = navActive(item.id, tab);",
)

p.write_text(t)
print("patched", len(t))
assert "CLIENT_NAV" in t and "NutritionView" in t
