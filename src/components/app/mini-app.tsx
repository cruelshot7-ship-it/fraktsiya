import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CalendarDays, ClipboardList, MessageCircle, Users } from "lucide-react";
import { formatDayMonth, hoursUntilSlot, isFrozen, isSlotPast, relativeLabel, sessionsRu, type Notice } from "@/data/studio";
import { activeClient, useStudio, type TabId } from "@/lib/studio-store";
import { Toast } from "@/components/app/bits";
import { BrandLockup } from "@/components/app/brand-mark";
import { HapticLayer } from "@/components/app/haptic-layer";
import { State as _S } from "react";
