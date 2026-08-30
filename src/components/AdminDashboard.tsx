"use client";

import {
  FormEvent,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  contentSwap,
  fadeSoft,
  listItemIn,
  panelIn,
  springSnappy,
  springSoft,
  staggerParent,
} from "@/lib/motion";
import {
  createFieldNote,
  readAdminTeamsCache,
  readFieldNotes,
  writeAdminTeamsCache,
  writeFieldNotes,
  type FieldNote,
} from "@/lib/field-notes";
import { type CampMessageRow } from "@/lib/messages";
import { TEAM_COLORS } from "@/lib/standings";
import { formatAwardNote, parsePointNote, type AwardDraft } from "@/lib/scoring";
import { teamChipStyle } from "@/lib/utils";
import { availableCabinsForGroup, cabinChoicesForGroup, getCabin } from "@/lib/cabins";
import { clearAdminSignedIn } from "@/lib/admin-session";
import { forgetTeamEverywhere } from "@/lib/offline";
import { useOnline } from "@/lib/use-online";
import { FieldNotes } from "./FieldNotes";
import { AwardPointsPanel } from "./AwardPointsPanel";
import { CampMessagesPanel } from "./CampMessagesPanel";
import { AdminToasts, type AdminToast } from "./AdminToasts";
import { ConfirmDialog } from "./ConfirmDialog";
import { OfflineBanner, NeedsWifiNotice } from "./OfflineBanner";
import { ControlDock } from "./ControlDock";
import { SkyDecor } from "./SkyDecor";
import { SpiderChart } from "./SpiderChart";
import { BusyLabel, Spinner } from "./Spinner";
import { useTheme } from "@/lib/theme";

type CampGroup = "red" | "green";

type TeamRow = {
  id: number;
  name: string;
  color: string;
  score: number;
  eventCount: number;
  campGroup: CampGroup | null;
  cabinId?: number | null;
};

type HistoryRow = {
  id: number;
  teamId: number;
  teamName: string;
  teamColor: string;
  delta: number;
  note: string | null;
  createdAt: string;
};

/**
 * Not a failure worth a toast — it is the expected answer with no WiFi.
 * Declared at module scope so `instanceof` holds: a class defined inside the
 * component would be a new identity on every render, and the check would run
 * against a different class than the one `refresh` was created with.
 */
class OfflineError extends Error {}

type AdminTabId = "award" | "teams" | "notices" | "history" | "qr";

/** Order matters: it decides which way a panel slides in. */
const ADMIN_TABS: { id: AdminTabId; label: string }[] = [
  { id: "award", label: "Award" },
  { id: "teams", label: "Teams" },
  { id: "notices", label: "Notices" },
  { id: "history", label: "History" },
  { id: "qr", label: "QR code" },
];

const ADMIN_TAB_KEY = "camp-admin-tab";

function isAdminTabId(value: string | null): value is AdminTabId {
  return ADMIN_TABS.some((tab) => tab.id === value);
}

export function AdminDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const online = useOnline();
  const [leavingToBoard, startLeaveToBoard] = useTransition();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [messages, setMessages] = useState<CampMessageRow[]>([]);
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TEAM_COLORS[0]);
  const [newCampGroup, setNewCampGroup] = useState<CampGroup>("red");
  const [newCabinId, setNewCabinId] = useState<number | "">("");

  const [historyTeamId, setHistoryTeamId] = useState<number | "all">("all");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editCampGroup, setEditCampGroup] = useState<CampGroup>("red");
  const [editCabinId, setEditCabinId] = useState<number | "">("");

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [fieldNotes, setFieldNotes] = useState<FieldNote[]>([]);
  const [pending, setPending] = useState<Record<string, true>>({});

  // The dashboard is five jobs stacked in one column; on a phone that was a
  // very long scroll to reach the team list or the QR. Tabs cut it to one
  // screen each. Panels are mounted on first visit and then kept alive, so
  // switching back never re-runs a D3 render or refetches anything — and
  // nothing renders while hidden, which matters for the chart, since it sizes
  // itself from its container and would measure zero inside a hidden panel.
  const [adminTab, setAdminTab] = useState<AdminTabId>("award");
  const [mountedTabs, setMountedTabs] = useState<AdminTabId[]>(["award"]);
  const tabDir = useRef<"forward" | "back">("forward");
  const tabNavRef = useRef<HTMLElement | null>(null);

  // Read after mount so the server and first client paint agree.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ADMIN_TAB_KEY);
    } catch {
      /* private mode */
    }
    if (!isAdminTabId(stored) || stored === "award") return;
    setAdminTab(stored);
    setMountedTabs((current) =>
      current.includes(stored) ? current : [...current, stored],
    );
  }, []);

  function selectTab(id: AdminTabId) {
    if (id === adminTab) return;
    const from = ADMIN_TABS.findIndex((tab) => tab.id === adminTab);
    const to = ADMIN_TABS.findIndex((tab) => tab.id === id);
    tabDir.current = to > from ? "forward" : "back";
    setAdminTab(id);
    setMountedTabs((current) =>
      current.includes(id) ? current : [...current, id],
    );
    try {
      window.localStorage.setItem(ADMIN_TAB_KEY, id);
    } catch {
      /* private mode */
    }
    // Panels differ wildly in height, so a switch from deep inside the team
    // list would otherwise land below the new panel entirely.
    const nav = tabNavRef.current;
    if (!nav) return;
    const top = nav.getBoundingClientRect().top + window.scrollY - 12;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
  }

  // Ref mirror so a second click in the same tick is rejected before state lands.
  const inFlight = useRef(new Set<string>());

  const isBusy = useCallback((key: string) => key in pending, [pending]);

  const run = useCallback(
    async (key: string, action: () => Promise<void>) => {
      if (inFlight.current.has(key)) return;
      inFlight.current.add(key);
      setPending((current) => ({ ...current, [key]: true }));
      try {
        await action();
      } finally {
        inFlight.current.delete(key);
        setPending((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
    },
    [],
  );

  const persistNotes = useCallback((next: FieldNote[]) => {
    setFieldNotes(next);
    writeFieldNotes(next);
  }, []);

  const pushToast = useCallback(
    (kind: AdminToast["kind"], title: string, detail?: string) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}`;
      setToasts((current) => [...current.slice(-2), { id, kind, title, detail }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, 4200);
    },
    [],
  );

  const flash = useCallback(
    (title: string, detail?: string) => pushToast("success", title, detail),
    [pushToast],
  );

  const fail = useCallback(
    (title: string, detail?: string) => pushToast("error", title, detail),
    [pushToast],
  );

  const refresh = useCallback(async () => {
    // Camp WiFi fails in two different ways and they need different handling.
    // A phone that knows it is offline should not open a socket at all: the
    // service worker answers /api/* network-first, so the request only ends in
    // the same cache lookup we can do ourselves, several seconds later.
    if (!navigator.onLine) throw new OfflineError();
    // The nastier case is a connection that is up but going nowhere — a camp
    // access point with no uplink. There the request neither succeeds nor
    // fails, and the network-first strategy waits ten seconds before giving up
    // on each call. Cut it short so staff reach the cached dashboard quickly.
    // A plain controller rather than AbortSignal.timeout, which is newer than
    // some of the phones that will be carried around this camp.
    const attempt = new AbortController();
    const deadline = window.setTimeout(() => attempt.abort(), 6000);
    const signal = attempt.signal;
    const [teamsRes, historyRes, messagesRes] = await Promise.all([
      fetch("/api/teams", { cache: "no-store", signal }),
      fetch("/api/points", { cache: "no-store", signal }),
      fetch("/api/messages", { cache: "no-store", signal }),
    ]).finally(() => window.clearTimeout(deadline));
    if (!teamsRes.ok || !historyRes.ok) {
      throw new Error("Failed to load admin data");
    }
    const teamsJson = (await teamsRes.json()) as { teams: TeamRow[] };
    const historyJson = (await historyRes.json()) as { history: HistoryRow[] };
    setTeams(teamsJson.teams);
    writeAdminTeamsCache(teamsJson.teams);
    setHistory(historyJson.history);
    // Notices are not cached for offline the way teams are — sending one needs
    // the network anyway, so an empty list offline is honest rather than stale.
    if (messagesRes.ok) {
      const messagesJson = (await messagesRes.json()) as {
        messages: CampMessageRow[];
      };
      setMessages(messagesJson.messages);
    }
  }, []);

  useEffect(() => {
    const cachedTeams = readAdminTeamsCache();
    if (cachedTeams.length) {
      setTeams(cachedTeams);
    }
    setFieldNotes(readFieldNotes());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
        if (!cancelled) {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const cached = readAdminTeamsCache();
          if (cached.length) {
            setTeams(cached);
          } else if (!(err instanceof OfflineError)) {
            fail(err instanceof Error ? err.message : "Load failed");
          }
          // Either way the shell has to render. Staying on "Loading…" hides the
          // field notes, which are the part meant to work with no connection.
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, fail]);

  useEffect(() => {
    if (online) return;
    setPendingDelete(null);
  }, [online]);

  useEffect(() => {
    const url = window.location.origin + "/";
    setPublicUrl(url);
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: "#2A1F14", light: "#FFF8EE" },
    }).then(setQrDataUrl);
  }, []);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    [teams],
  );

  const newCabinChoices = useMemo(
    () => cabinChoicesForGroup(newCampGroup, teams),
    [newCampGroup, teams],
  );
  const newCabinOptions = useMemo(
    () => availableCabinsForGroup(newCampGroup, teams),
    [newCampGroup, teams],
  );
  const editCabinChoices = useMemo(
    () =>
      editingId == null
        ? []
        : cabinChoicesForGroup(editCampGroup, teams, editingId),
    [editCampGroup, teams, editingId],
  );

  const filteredHistory = useMemo(() => {
    if (historyTeamId === "all") return history;
    return history.filter((row) => row.teamId === historyTeamId);
  }, [history, historyTeamId]);

  const postingNoteId =
    fieldNotes.find((note) => isBusy(`note-${note.id}`))?.id ?? null;
  const postingAll = isBusy("post-all");

  function requireOnline() {
    if (online) return true;
    fail("Needs WiFi", "Connect to add teams, change cabins, or post points.");
    return false;
  }

  function goToScoreboard(e: ReactMouseEvent<HTMLAnchorElement>) {
    // Let ctrl/cmd/middle clicks open a new tab the normal way.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    startLeaveToBoard(() => router.push("/"));
  }

  function logout() {
    if (!requireOnline()) return;
    void run("logout", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      clearAdminSignedIn();
      router.replace("/admin/login");
      router.refresh();
    });
  }

  function createTeam(e: FormEvent) {
    e.preventDefault();
    if (!requireOnline()) return;
    if (!newName.trim()) {
      fail("Name is required");
      return;
    }
    if (newCabinOptions.length > 0 && newCabinId === "") {
      fail("Pick a cabin", "Each team needs a cabin in its group.");
      return;
    }
    void run("create-team", async () => {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          color: newColor,
          campGroup: newCampGroup,
          cabinId: newCabinId === "" ? null : newCabinId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        fail(data.error || "Could not create team");
        return;
      }
      const createdName = newName.trim();
      const createdGroup = newCampGroup;
      const createdCabin = newCabinId;
      setNewName("");
      setNewColor(
        TEAM_COLORS[teams.length % TEAM_COLORS.length] || TEAM_COLORS[0],
      );
      setNewCampGroup("red");
      setNewCabinId("");
      await refresh();
      flash(
        `${createdName} is on the board`,
        `Added to the ${createdGroup} group${
          typeof createdCabin === "number" ? ` · Cabin ${createdCabin}` : ""
        }.`,
      );
    });
  }

  function saveEdit(id: number) {
    if (!requireOnline()) return;
    void run(`team-${id}`, async () => {
      const res = await fetch(`/api/teams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          color: editColor,
          campGroup: editCampGroup,
          cabinId: editCabinId === "" ? null : editCabinId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        fail(data.error || "Could not update team");
        return;
      }
      setEditingId(null);
      await refresh();
      flash("Team saved", `${editName} is up to date.`);
    });
  }

  function setTeamGroup(id: number, campGroup: CampGroup) {
    if (!requireOnline()) return;
    void run(`team-${id}`, async () => {
      const team = teams.find((t) => t.id === id);
      const res = await fetch(`/api/teams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campGroup }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        fail(data.error || "Could not update group");
        return;
      }
      await refresh();
      flash(
        `${team?.name ?? "Team"} moved to ${campGroup} group`,
        "Schedule track updated for this team.",
      );
    });
  }

  function requestDeleteTeam(id: number, name: string) {
    if (!requireOnline()) return;
    setPendingDelete({ id, name });
  }

  function confirmDeleteTeam() {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    void run(`delete-${id}`, async () => {
      const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setPendingDelete(null);
        fail(data.error || "Could not delete team");
        return;
      }
      forgetTeamEverywhere(id);
      setTeams((current) => current.filter((team) => team.id !== id));
      setHistory((current) => current.filter((row) => row.teamId !== id));
      setFieldNotes((current) => {
        const next = current.filter((note) => note.teamId !== id);
        writeFieldNotes(next);
        return next;
      });
      if (historyTeamId === id) setHistoryTeamId("all");
      if (editingId === id) setEditingId(null);
      await refresh();
      setPendingDelete(null);
      flash(`${name} deleted`, "Removed from standings, history, and schedule.");
    });
  }

  function awardDrafts(drafts: AwardDraft[]) {
    const toPost = drafts.filter((draft) => draft.delta !== 0);
    if (toPost.length === 0) {
      fail("Need some points", "Give at least 1 point, or use Extra to deduct.");
      return;
    }
    const team = teams.find((t) => t.id === toPost[0].teamId);
    if (!team) {
      fail("Pick a team first");
      return;
    }
    void run("submit-points", async () => {
      try {
        for (const draft of toPost) {
          await postPoints({
            teamId: draft.teamId,
            delta: draft.delta,
            note: formatAwardNote(draft),
          });
        }
        await refresh();
        const total = toPost.reduce((sum, draft) => sum + draft.delta, 0);
        const labels = toPost.map((draft) =>
          draft.kind === "extra" ? "Extra" : draft.title,
        );
        flash(
          total > 0
            ? `+${total} for ${team.name}`
            : `${total} for ${team.name}`,
          labels.length === 1
            ? labels[0]
            : `${labels.length} events posted to the board.`,
        );
      } catch (err) {
        fail(err instanceof Error ? err.message : "Could not update points");
      }
    });
  }

  function saveDraftsToFieldNotes(drafts: AwardDraft[]) {
    const toSave = drafts.filter((draft) => draft.delta !== 0);
    if (toSave.length === 0) {
      fail("Need some points", "Give at least 1 point, or use Extra to deduct.");
      return;
    }
    const team = teams.find((t) => t.id === toSave[0].teamId);
    if (!team) {
      fail("Pick a team first");
      return;
    }
    const next = [
      ...toSave.map((draft) =>
        createFieldNote({
          teamId: team.id,
          teamName: team.name,
          teamColor: team.color,
          delta: draft.delta,
          note: formatAwardNote(draft),
        }),
      ),
      ...fieldNotes,
    ];
    persistNotes(next);
    const total = toSave.reduce((sum, draft) => sum + draft.delta, 0);
    flash(
      "Saved to field notes",
      `${total > 0 ? "+" : ""}${total} for ${team.name} — post when you have WiFi.`,
    );
  }

  async function postPoints(input: {
    teamId: number;
    delta: number;
    note: string;
  }) {
    const res = await fetch("/api/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: input.teamId,
        delta: input.delta,
        note: input.note,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(data.error || "Could not update points");
    }
  }

  function postFieldNote(note: FieldNote) {
    if (!requireOnline()) return;
    void run(`note-${note.id}`, async () => {
      try {
        await postPoints({
          teamId: note.teamId,
          delta: note.delta,
          note: note.note,
        });
        persistNotes(fieldNotes.filter((n) => n.id !== note.id));
        await refresh();
        flash(
          note.delta > 0
            ? `Posted +${note.delta} to ${note.teamName}`
            : `Posted ${note.delta} to ${note.teamName}`,
          "Live on the public board.",
        );
      } catch (err) {
        fail(err instanceof Error ? err.message : "Could not post field note");
      }
    });
  }

  function postAllFieldNotes() {
    if (!requireOnline()) return;
    if (fieldNotes.length === 0) return;
    void run("post-all", async () => {
      const remaining: FieldNote[] = [];
      let posted = 0;
      for (const note of [...fieldNotes].reverse()) {
        try {
          await postPoints({
            teamId: note.teamId,
            delta: note.delta,
            note: note.note,
          });
          posted += 1;
        } catch {
          remaining.unshift(note);
        }
      }
      persistNotes(remaining);
      await refresh();
      if (remaining.length) {
        fail(
          `Posted ${posted}, ${remaining.length} left`,
          "Retry the remaining notes when WiFi is stable.",
        );
      } else {
        flash(
          `Posted ${posted} field note${posted === 1 ? "" : "s"}`,
          "All clipboard awards are live.",
        );
      }
    });
  }

  function sendMessage(body: string, pinned: boolean) {
    if (!requireOnline()) return;
    void run("send-message", async () => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, pinned }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        fail(data.error || "Could not send the notice");
        return;
      }
      await refresh();
      flash("Notice sent", "Everyone on the camp board will see it.");
    });
  }

  function removeMessage(message: CampMessageRow) {
    if (!requireOnline()) return;
    void run(`message-${message.id}`, async () => {
      const res = await fetch(`/api/messages/${message.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        fail(data.error || "Could not remove the notice");
        return;
      }
      setMessages((current) => current.filter((m) => m.id !== message.id));
      await refresh();
      flash("Notice removed", "It is gone from the camp board.");
    });
  }

  function toggleMessagePin(message: CampMessageRow) {
    if (!requireOnline()) return;
    void run(`message-${message.id}`, async () => {
      const res = await fetch(`/api/messages/${message.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !message.pinned }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        fail(data.error || "Could not update the notice");
        return;
      }
      await refresh();
      flash(message.pinned ? "Unpinned" : "Pinned to the top");
    });
  }

  function startEdit(team: TeamRow) {
    setEditingId(team.id);
    setEditName(team.name);
    setEditColor(team.color);
    setEditCampGroup(team.campGroup ?? "red");
    setEditCabinId(typeof team.cabinId === "number" ? team.cabinId : "");
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "camp-scoreboard-qr.png";
    a.click();
  }

  return (
    <MotionConfig reducedMotion="user">
    <main className="relative min-h-dvh px-4 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-8 md:px-8">
      {theme !== "dark" ? <SkyDecor /> : null}

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-5"
        variants={staggerParent}
        initial="hidden"
        animate="show"
      >
        <ControlDock />
        <motion.header
          variants={panelIn}
          className="panel flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4"
        >
          <div>
            <p className="display-font text-xs font-semibold uppercase tracking-[0.22em] text-muted-soft">
              Camp control
            </p>
            <h1 className="display-font text-2xl font-bold text-ink sm:text-3xl">
              Admin dashboard
            </h1>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Link
              href="/"
              prefetch
              onClick={goToScoreboard}
              aria-busy={leavingToBoard}
              className="btn-soft min-h-11 flex-1 rounded-xl border-2 px-4 py-2 text-sm font-extrabold sm:flex-none"
            >
              <BusyLabel busy={leavingToBoard} busyLabel="Opening board…">
                View scoreboard
              </BusyLabel>
            </Link>
            <button
              type="button"
              onClick={logout}
              disabled={!online || isBusy("logout")}
              className="btn-cta min-h-11 flex-1 rounded-xl bg-star px-4 py-2 text-sm font-extrabold disabled:opacity-60 sm:flex-none"
            >
              <BusyLabel busy={isBusy("logout")} busyLabel="Logging out…">
                {online ? "Log out" : "Needs WiFi"}
              </BusyLabel>
            </button>
          </div>
        </motion.header>

        <OfflineBanner
          online={online}
          detail="Needs WiFi to add teams, change cabins, or post live points. You can still jot field notes on this phone, then post them when you're back."
        />

        {/* Deliberately not an AnimatePresence `mode="wait"` swap.
            That gate holds the dashboard back until the "Loading…" exit
            animation finishes, and framer drives exits with rAF — which a
            browser does not run for a page being restored or resumed in the
            background. Offline that is exactly when this renders, so the exit
            never completed and the dashboard never mounted: a permanent
            "Loading…" on a page whose whole point is working without WiFi. */}
        {loading ? (
          <p className="panel rounded-3xl px-5 py-10 text-center font-bold text-muted-soft">
            Loading…
          </p>
        ) : (
          <motion.div
            variants={contentSwap}
            className="flex flex-col gap-5"
          >

            <motion.nav
              ref={tabNavRef}
              variants={panelIn}
              aria-label="Dashboard sections"
              className="panel flex flex-wrap gap-1.5 rounded-3xl p-1.5"
            >
              {ADMIN_TABS.map((item) => {
                const isActive = item.id === adminTab;
                const badge = item.id === "award" ? fieldNotes.length : 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTab(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`min-h-11 grow basis-[calc(33.333%-0.375rem)] cursor-pointer rounded-2xl px-2.5 py-2.5 text-sm font-extrabold sm:basis-0 ${
                      isActive ? "bg-star text-on-star shadow-sm" : "btn-chip"
                    }`}
                  >
                    {item.label}
                    {badge > 0 ? (
                      <span className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                        {badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </motion.nav>

            <div className="contents">
              <div
                data-panel="award"
                data-active={adminTab === "award"}
                data-dir={tabDir.current}
                className="board-panel gap-5"
              >
                {mountedTabs.includes("award") ? (
                  <>
                  <section className="grid gap-5 lg:grid-cols-2">
                  <AwardPointsPanel
                    teams={teams}
                    online={online}
                    busy={isBusy("submit-points")}
                    onAward={awardDrafts}
                    onSaveForLater={saveDraftsToFieldNotes}
                    onSetupSaved={() =>
                      flash("I'm done", "Scoring events are saved on this device.")
                    }
                  />

                  <FieldNotes
                    notes={fieldNotes}
                    online={online}
                    postingId={postingNoteId}
                    postingAll={postingAll}
                    className="lg:col-start-2 lg:row-start-1"
                    onPost={postFieldNote}
                    onDiscard={(id) => {
                      persistNotes(fieldNotes.filter((n) => n.id !== id));
                      flash("Note discarded", "It was only on this device.");
                    }}
                    onPostAll={postAllFieldNotes}
                  />
                  </section>
                  </>
                ) : null}
              </div>

              <div
                data-panel="teams"
                data-active={adminTab === "teams"}
                data-dir={tabDir.current}
                className="board-panel gap-5"
              >
                {mountedTabs.includes("teams") ? (
                  <>
                  <motion.form
                    variants={panelIn}
                    onSubmit={createTeam}
                    className="panel rounded-3xl p-4 sm:p-5"
                  >
                    <h2 className="display-font text-xl font-bold">Create team</h2>
                    <p className="mt-1 text-sm font-semibold text-muted-soft">
                      Add as many teams as you need — names are fully dynamic.
                    </p>
                    {!online ? (
                      <div className="mt-3">
                        <NeedsWifiNotice>
                          Connect to create a team with its group and cabin.
                        </NeedsWifiNotice>
                      </div>
                    ) : null}

                    <fieldset
                      disabled={!online}
                      className="min-w-0 border-0 p-0 disabled:opacity-55"
                    >

                    <label className="mt-4 block text-sm font-bold text-muted">
                      Team name
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Team Rocket"
                        required
                        className="field mt-1.5 w-full rounded-xl border-2 px-3 py-3 text-base font-semibold"
                      />
                    </label>

                    <label className="mt-3 block text-sm font-bold text-muted">
                      Camp group
                      <select
                        value={newCampGroup}
                        onChange={(e) => {
                          const group = e.target.value as CampGroup;
                          setNewCampGroup(group);
                          setNewCabinId("");
                        }}
                        className="field mt-1.5 w-full rounded-xl border-2 px-3 py-3 text-base font-semibold"
                        required
                      >
                        <option value="red">Red group</option>
                        <option value="green">Green group</option>
                      </select>
                    </label>

                    <label className="mt-3 block text-sm font-bold text-muted">
                      Cabin
                      <select
                        value={newCabinId}
                        onChange={(e) =>
                          setNewCabinId(e.target.value ? Number(e.target.value) : "")
                        }
                        className="field mt-1.5 w-full rounded-xl border-2 px-3 py-3 text-base font-semibold"
                        required={newCabinOptions.length > 0}
                      >
                        <option value="" disabled={newCabinOptions.length > 0}>
                          {newCabinOptions.length > 0
                            ? "Pick a cabin"
                            : "No cabin left in this group"}
                        </option>
                        {newCabinChoices.map(({ cabin, takenBy }) => (
                          <option
                            key={cabin.id}
                            value={cabin.id}
                            disabled={Boolean(takenBy)}
                          >
                            Cabin {cabin.id} · {cabin.label}
                            {takenBy ? ` · taken by ${takenBy}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    {newCabinChoices.length > 0 ? (
                      <p className="mt-1 text-xs font-semibold text-muted-soft">
                        {newCampGroup === "green" ? "Green" : "Red"} cabins:{" "}
                        {newCabinChoices
                          .map(
                            ({ cabin, takenBy }) =>
                              `${cabin.id}${takenBy ? ` (taken)` : ""}`,
                          )
                          .join(" · ")}
                        {newCabinOptions.length === 0
                          ? ". All of them are already assigned."
                          : ""}
                      </p>
                    ) : null}

                    <label className="mt-3 block text-sm font-bold text-muted">
                      Color
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <input
                          type="color"
                          value={newColor}
                          onChange={(e) => setNewColor(e.target.value)}
                          className="field h-11 w-14 cursor-pointer rounded border-2"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {TEAM_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              aria-label={`Pick ${c}`}
                              aria-pressed={newColor.toLowerCase() === c.toLowerCase()}
                              onClick={() => setNewColor(c)}
                              className="relative h-8 w-8 rounded-full border-2 border-white/80 shadow transition-transform duration-200 hover:scale-110 active:scale-95"
                              style={{ backgroundColor: c }}
                            >
                              {newColor.toLowerCase() === c.toLowerCase() ? (
                                <motion.span
                                  layoutId="new-color-ring"
                                  transition={springSnappy}
                                  className="pointer-events-none absolute -inset-1.5 rounded-full ring-2 ring-saddle dark:ring-white/70"
                                />
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </div>
                    </label>

                    <button
                      type="submit"
                      disabled={
                        !online ||
                        isBusy("create-team") ||
                        !newName.trim() ||
                        (newCabinOptions.length > 0 && newCabinId === "")
                      }
                      className="btn-cta mt-4 w-full rounded-xl bg-star px-4 py-3 text-base font-extrabold disabled:opacity-50"
                    >
                      <BusyLabel
                        busy={isBusy("create-team")}
                        busyLabel="Adding team…"
                      >
                        {online ? "Add team" : "Needs WiFi"}
                      </BusyLabel>
                    </button>
                    </fieldset>
                  </motion.form>

                <motion.section variants={panelIn} className="panel rounded-3xl p-4 sm:p-5">
                  <h2 className="display-font text-xl font-bold">Teams</h2>
                  {!online ? (
                    <div className="mt-3">
                      <NeedsWifiNotice>
                        Connect to edit, assign a cabin, or delete a team.
                      </NeedsWifiNotice>
                    </div>
                  ) : null}
                  {sortedTeams.length === 0 ? (
                    <p className="mt-3 font-semibold text-muted-soft">
                      No teams yet. Create your first team above.
                    </p>
                  ) : (
                    <motion.ul className="mt-4 flex flex-col gap-3">
                      <AnimatePresence initial={false}>
                      {sortedTeams.map((team, index) => {
                        const teamBusy =
                          isBusy(`team-${team.id}`) || isBusy(`delete-${team.id}`);
                        return (
                        <motion.li
                          key={team.id}
                          variants={listItemIn}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          transition={springSoft}
                          className="surface-card overflow-hidden rounded-2xl border-2 p-3 sm:p-4"
                        >
                          <AnimatePresence mode="popLayout" initial={false}>
                          {editingId === team.id ? (
                            <motion.div
                              key="edit"
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 8 }}
                              transition={springSoft}
                              className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2"
                            >
                              <label className="text-sm font-bold text-muted min-[520px]:col-span-2">
                                Name
                                <input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="field mt-1 w-full rounded-xl border-2 px-3 py-2 font-semibold"
                                />
                              </label>
                              <label className="text-sm font-bold text-muted">
                                Group
                                <select
                                  value={editCampGroup}
                                  onChange={(e) => {
                                    const group = e.target.value as CampGroup;
                                    setEditCampGroup(group);
                                    const cabin = getCabin(
                                      typeof editCabinId === "number" ? editCabinId : null,
                                    );
                                    if (!cabin || cabin.group !== group) {
                                      setEditCabinId("");
                                    }
                                  }}
                                  className="field mt-1 w-full rounded-xl border-2 px-3 py-2 font-semibold"
                                >
                                  <option value="red">Red</option>
                                  <option value="green">Green</option>
                                </select>
                              </label>
                              <label className="text-sm font-bold text-muted">
                                Cabin
                                <select
                                  value={editCabinId}
                                  onChange={(e) =>
                                    setEditCabinId(
                                      e.target.value ? Number(e.target.value) : "",
                                    )
                                  }
                                  className="field mt-1 w-full rounded-xl border-2 px-3 py-2 font-semibold"
                                >
                                  <option value="">No cabin</option>
                                  {editCabinChoices.map(({ cabin, takenBy }) => (
                                    <option
                                      key={cabin.id}
                                      value={cabin.id}
                                      disabled={Boolean(takenBy)}
                                    >
                                      Cabin {cabin.id} · {cabin.label}
                                      {takenBy ? ` · taken by ${takenBy}` : ""}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-sm font-bold text-muted">
                                Color
                                <input
                                  type="color"
                                  value={editColor}
                                  onChange={(e) => setEditColor(e.target.value)}
                                  className="field mt-1 block h-10 w-14 rounded border-2"
                                />
                              </label>
                              <div className="grid grid-cols-2 gap-2 min-[520px]:col-span-2">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(team.id)}
                                  disabled={!online || isBusy(`team-${team.id}`)}
                                  className="btn-cta rounded-xl bg-emerald-500 px-3 py-2 text-sm font-extrabold disabled:opacity-60"
                                >
                                  <BusyLabel
                                    busy={isBusy(`team-${team.id}`)}
                                    busyLabel="Saving…"
                                  >
                                    {online ? "Save" : "Needs WiFi"}
                                  </BusyLabel>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  disabled={isBusy(`team-${team.id}`)}
                                  className="btn-soft rounded-xl border px-3 py-2 text-sm font-extrabold disabled:opacity-60"
                                >
                                  Cancel
                                </button>
                              </div>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="view"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={springSoft}
                              className="flex flex-col gap-3"
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  className="display-font flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white"
                                  style={{ backgroundColor: team.color }}
                                >
                                  {index + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="display-font break-words text-lg font-bold text-card-ink">
                                      {team.name}
                                    </p>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white ${
                                        team.campGroup === "green"
                                          ? "bg-[#2F8F4E]"
                                          : team.campGroup === "red"
                                            ? "bg-[#C45C26]"
                                            : "bg-slate-500"
                                      }`}
                                    >
                                      {team.campGroup ?? "unassigned"}
                                    </span>
                                  </div>
                                  <p className="break-words text-sm font-bold text-muted-soft">
                                    {team.score} pts · {team.eventCount} events
                                    {typeof team.cabinId === "number"
                                      ? ` · Cabin ${team.cabinId}${
                                          getCabin(team.cabinId)
                                            ? ` (${getCabin(team.cabinId)!.label})`
                                            : ""
                                        }`
                                      : " · no cabin"}
                                  </p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                                <select
                                  aria-label={`Camp group for ${team.name}`}
                                  value={team.campGroup ?? ""}
                                  disabled={!online || teamBusy}
                                  onChange={(e) => {
                                    const value = e.target.value as CampGroup;
                                    if (value === "red" || value === "green") {
                                      setTeamGroup(team.id, value);
                                    }
                                  }}
                                  className="field col-span-2 rounded-xl border-2 px-2 py-2 text-sm font-extrabold disabled:opacity-60 sm:col-span-1 sm:w-auto"
                                >
                                  {!team.campGroup ? (
                                    <option value="" disabled>
                                      Set group
                                    </option>
                                  ) : null}
                                  <option value="red">Red</option>
                                  <option value="green">Green</option>
                                </select>
                                <select
                                  aria-label={`Cabin for ${team.name}`}
                                  value={team.cabinId ?? ""}
                                  disabled={!online || teamBusy || !team.campGroup}
                                  onChange={(e) => {
                                    if (!requireOnline()) return;
                                    const value = e.target.value;
                                    void run(`team-${team.id}`, async () => {
                                      const res = await fetch(`/api/teams/${team.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                          cabinId: value ? Number(value) : null,
                                        }),
                                      });
                                      const data = (await res.json().catch(() => ({}))) as {
                                        error?: string;
                                      };
                                      if (!res.ok) {
                                        fail(data.error || "Could not update cabin");
                                        return;
                                      }
                                      await refresh();
                                      flash(
                                        value
                                          ? `${team.name} → Cabin ${value}`
                                          : `${team.name} cabin cleared`,
                                      );
                                    });
                                  }}
                                  className="field col-span-2 rounded-xl border-2 px-2 py-2 text-sm font-extrabold disabled:opacity-60 sm:col-span-1 sm:w-auto"
                                >
                                  <option value="">No cabin</option>
                                  {cabinChoicesForGroup(
                                    team.campGroup ?? "red",
                                    teams,
                                    team.id,
                                  ).map(({ cabin, takenBy }) => (
                                    <option
                                      key={cabin.id}
                                      value={cabin.id}
                                      disabled={Boolean(takenBy)}
                                    >
                                      Cabin {cabin.id} · {cabin.label}
                                      {takenBy ? ` · ${takenBy}` : ""}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => startEdit(team)}
                                  disabled={!online || teamBusy}
                                  className="btn-soft rounded-xl border px-3 py-2 text-sm font-extrabold disabled:opacity-60"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestDeleteTeam(team.id, team.name)}
                                  disabled={!online || teamBusy}
                                  className="btn-danger rounded-xl px-3 py-2 text-sm font-extrabold disabled:opacity-60"
                                >
                                  Delete
                                </button>
                                <AnimatePresence initial={false}>
                                  {teamBusy ? (
                                    <motion.span
                                      key="saving"
                                      initial={{ opacity: 0, x: -6 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      exit={{ opacity: 0, x: -6 }}
                                      transition={fadeSoft}
                                      className="col-span-2 inline-flex items-center gap-2 text-sm font-bold text-muted-soft sm:col-span-1"
                                    >
                                      <Spinner />
                                      Saving…
                                    </motion.span>
                                  ) : null}
                                </AnimatePresence>
                              </div>
                            </motion.div>
                          )}
                          </AnimatePresence>
                        </motion.li>
                        );
                      })}
                      </AnimatePresence>
                    </motion.ul>
                  )}
                </motion.section>
                  </>
                ) : null}
              </div>

              <div
                data-panel="notices"
                data-active={adminTab === "notices"}
                data-dir={tabDir.current}
                className="board-panel gap-5"
              >
                {mountedTabs.includes("notices") ? (
                  <>
                <CampMessagesPanel
                  messages={messages}
                  online={online}
                  sending={isBusy("send-message")}
                  busyId={
                    messages.find((m) => isBusy(`message-${m.id}`))?.id ?? null
                  }
                  onSend={sendMessage}
                  onDelete={removeMessage}
                  onTogglePin={toggleMessagePin}
                />
                  </>
                ) : null}
              </div>

              <div
                data-panel="history"
                data-active={adminTab === "history"}
                data-dir={tabDir.current}
                className="board-panel gap-5"
              >
                {mountedTabs.includes("history") ? (
                  <>
                <motion.div variants={panelIn}>
                  <SpiderChart teams={sortedTeams} />
                </motion.div>

                  <motion.div variants={panelIn} className="panel rounded-3xl p-5">
                    <h2 className="display-font text-xl font-bold">Point history</h2>
                    <p className="mt-1 text-sm font-semibold text-muted-soft">
                      Each award shows the team, the event or extra reason, and the cap used.
                    </p>
                    {teams.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setHistoryTeamId("all")}
                          className={`rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold ${
                            historyTeamId === "all"
                              ? "border-star bg-star text-on-star"
                              : "btn-chip"
                          }`}
                        >
                          All teams
                        </button>
                        {sortedTeams.map((team) => (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => setHistoryTeamId(team.id)}
                            className={`rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold ${
                              historyTeamId === team.id
                                ? "ring-2 ring-white/85 dark:ring-white/80"
                                : ""
                            }`}
                            style={teamChipStyle(team.color, historyTeamId === team.id)}
                          >
                            {team.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {filteredHistory.length === 0 ? (
                      <p className="mt-3 font-semibold text-muted-soft">
                        {history.length === 0
                          ? "No point events yet."
                          : "No history for that team yet."}
                      </p>
                    ) : (
                      <ul className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                        <AnimatePresence initial={false}>
                        {filteredHistory.map((row) => {
                          const parsed = parsePointNote(row.note);
                          return (
                          <motion.li
                            key={row.id}
                            initial={{ opacity: 0, x: -14, scale: 0.98 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 14, scale: 0.98 }}
                            transition={springSoft}
                            className="surface-card flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-extrabold text-card-ink">
                                <span
                                  className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: row.teamColor }}
                                />
                                {row.teamName}
                              </p>
                              <p className="mt-0.5 text-sm font-bold text-card-ink">
                                <span className="mr-1.5 rounded-full bg-saddle/10 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted dark:bg-white/10">
                                  {parsed.kind === "extra"
                                    ? "Extra"
                                    : parsed.kind === "activity"
                                      ? "Event"
                                      : "Note"}
                                </span>
                                {parsed.title}
                              </p>
                              <p className="text-xs font-semibold text-muted-soft">
                                {new Date(row.createdAt).toLocaleString()}
                                {parsed.capLabel ? ` · cap ${parsed.capLabel}` : ""}
                              </p>
                            </div>
                            <span
                              className={`display-font shrink-0 text-lg font-bold ${
                                row.delta > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {row.delta > 0 ? `+${row.delta}` : row.delta}
                            </span>
                          </motion.li>
                          );
                        })}
                        </AnimatePresence>
                      </ul>
                    )}
                  </motion.div>
                  </>
                ) : null}
              </div>

              <div
                data-panel="qr"
                data-active={adminTab === "qr"}
                data-dir={tabDir.current}
                className="board-panel gap-5"
              >
                {mountedTabs.includes("qr") ? (
                  <>
                  <motion.div variants={panelIn} className="panel rounded-3xl p-5 text-center">
                    <h2 className="display-font text-xl font-bold">Camper QR code</h2>
                    <p className="mt-1 text-sm font-semibold text-muted-soft">
                      Print this so kids can open the live scoreboard.
                    </p>
                    <AnimatePresence mode="wait" initial={false}>
                      {qrDataUrl ? (
                        <motion.img
                          key="qr"
                          src={qrDataUrl}
                          alt="QR code to camp scoreboard"
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={springSoft}
                          className="mx-auto mt-4 w-52 rounded-2xl border-2 border-field-border bg-white p-2"
                        />
                      ) : (
                        <motion.p
                          key="qr-loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={fadeSoft}
                          className="mt-8 font-semibold text-muted-soft"
                        >
                          Generating QR…
                        </motion.p>
                      )}
                    </AnimatePresence>
                    <p className="mt-3 break-all text-xs font-bold text-muted-soft">
                      {publicUrl}
                    </p>
                    <button
                      type="button"
                      onClick={downloadQr}
                      disabled={!qrDataUrl}
                      className="btn-cta mt-4 w-full rounded-xl bg-star px-4 py-3 text-sm font-extrabold disabled:opacity-50"
                    >
                      Download QR PNG
                    </button>
                  </motion.div>
                  </>
                ) : null}
              </div>

            </div>
          </motion.div>
        )}
      </motion.div>

      <AdminToasts
        toasts={toasts}
        onDismiss={(id) =>
          setToasts((current) => current.filter((t) => t.id !== id))
        }
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? "this team"}?`}
        detail="This also removes that team's point history. This cannot be undone."
        confirmLabel="Yes, delete"
        danger
        busy={pendingDelete ? isBusy(`delete-${pendingDelete.id}`) : false}
        onConfirm={confirmDeleteTeam}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
    </MotionConfig>
  );
}
