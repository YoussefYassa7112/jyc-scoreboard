"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  createFieldNote,
  readAdminTeamsCache,
  readFieldNotes,
  writeAdminTeamsCache,
  writeFieldNotes,
  type FieldNote,
} from "@/lib/field-notes";
import { TEAM_COLORS } from "@/lib/standings";
import { useOnline } from "@/lib/use-online";
import { FieldNotes } from "./FieldNotes";
import { AdminToasts, type AdminToast } from "./AdminToasts";
import { ConfirmDialog } from "./ConfirmDialog";
import { OfflineBanner } from "./OfflineBanner";
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

export function AdminDashboard() {
  const router = useRouter();
  const { theme } = useTheme();
  const online = useOnline();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TEAM_COLORS[0]);
  const [newCampGroup, setNewCampGroup] = useState<CampGroup>("red");

  const [pointTeamId, setPointTeamId] = useState<number | "">("");
  const [pointDelta, setPointDelta] = useState("10");
  const [pointNote, setPointNote] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editCampGroup, setEditCampGroup] = useState<CampGroup>("red");

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [fieldNotes, setFieldNotes] = useState<FieldNote[]>([]);
  const [pending, setPending] = useState<Record<string, true>>({});

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
    const [teamsRes, historyRes] = await Promise.all([
      fetch("/api/teams", { cache: "no-store" }),
      fetch("/api/points", { cache: "no-store" }),
    ]);
    if (!teamsRes.ok || !historyRes.ok) {
      throw new Error("Failed to load admin data");
    }
    const teamsJson = (await teamsRes.json()) as { teams: TeamRow[] };
    const historyJson = (await historyRes.json()) as { history: HistoryRow[] };
    setTeams(teamsJson.teams);
    writeAdminTeamsCache(teamsJson.teams);
    setHistory(historyJson.history);
    setPointTeamId((current) =>
      current === "" && teamsJson.teams[0] ? teamsJson.teams[0].id : current,
    );
  }, []);

  useEffect(() => {
    const cachedTeams = readAdminTeamsCache();
    if (cachedTeams.length) {
      setTeams(cachedTeams);
      setPointTeamId((current) =>
        current === "" && cachedTeams[0] ? cachedTeams[0].id : current,
      );
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
            setLoading(false);
          } else {
            fail(err instanceof Error ? err.message : "Load failed");
            setLoading(false);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, fail]);

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

  const postingNoteId =
    fieldNotes.find((note) => isBusy(`note-${note.id}`))?.id ?? null;
  const postingAll = isBusy("post-all");

  function requireOnline() {
    if (online) return true;
    fail("You're offline", "Connect to WiFi to change teams or post points.");
    return false;
  }

  function logout() {
    if (!requireOnline()) return;
    void run("logout", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/admin/login");
      router.refresh();
    });
  }

  function createTeam(e: FormEvent) {
    e.preventDefault();
    if (!requireOnline()) return;
    void run("create-team", async () => {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          color: newColor,
          campGroup: newCampGroup,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        fail(data.error || "Could not create team");
        return;
      }
      const createdName = newName.trim();
      const createdGroup = newCampGroup;
      setNewName("");
      setNewColor(
        TEAM_COLORS[teams.length % TEAM_COLORS.length] || TEAM_COLORS[0],
      );
      setNewCampGroup("red");
      await refresh();
      flash(
        `${createdName} is on the board`,
        `Added to the ${createdGroup} group.`,
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
      await refresh();
      setPendingDelete(null);
      flash(`${name} deleted`, "Their point history was removed too.");
    });
  }

  function parsedAward() {
    const delta = Number(pointDelta);
    if (!pointTeamId || !Number.isInteger(delta) || delta === 0) {
      fail("Need a team and points", "Enter a non-zero whole number.");
      return null;
    }
    const team = teams.find((t) => t.id === pointTeamId);
    if (!team) {
      fail("Pick a team first");
      return null;
    }
    return { delta, team };
  }

  function saveToFieldNotes() {
    const parsed = parsedAward();
    if (!parsed) return;
    const next = [
      createFieldNote({
        teamId: parsed.team.id,
        teamName: parsed.team.name,
        teamColor: parsed.team.color,
        delta: parsed.delta,
        note: pointNote.trim(),
      }),
      ...fieldNotes,
    ];
    persistNotes(next);
    setPointNote("");
    flash(
      "Saved to field notes",
      `${parsed.delta > 0 ? "+" : ""}${parsed.delta} for ${parsed.team.name} — post when you have WiFi.`,
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

  function submitPoints(e: FormEvent) {
    e.preventDefault();
    if (!online) {
      saveToFieldNotes();
      return;
    }
    const parsed = parsedAward();
    if (!parsed) return;
    void run("submit-points", async () => {
      try {
        await postPoints({
          teamId: parsed.team.id,
          delta: parsed.delta,
          note: pointNote,
        });
        setPointNote("");
        await refresh();
        flash(
          parsed.delta > 0
            ? `+${parsed.delta} for ${parsed.team.name}`
            : `${parsed.delta} for ${parsed.team.name}`,
          parsed.delta > 0
            ? "Points are live on the scoreboard."
            : "Deduction is live on the scoreboard.",
        );
      } catch (err) {
        fail(err instanceof Error ? err.message : "Could not update points");
      }
    });
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

  function startEdit(team: TeamRow) {
    setEditingId(team.id);
    setEditName(team.name);
    setEditColor(team.color);
    setEditCampGroup(team.campGroup ?? "red");
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = "camp-scoreboard-qr.png";
    a.click();
  }

  return (
    <main className="relative min-h-dvh px-4 py-6 sm:px-6 md:px-8 md:py-8">
      {theme !== "dark" ? <SkyDecor /> : null}

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="panel flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4">
          <div>
            <p className="display-font text-xs font-semibold uppercase tracking-[0.22em] text-muted-soft">
              Camp control
            </p>
            <h1 className="display-font text-2xl font-bold text-ink sm:text-3xl">
              Admin dashboard
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="btn-soft rounded-xl border-2 px-4 py-2 text-sm font-extrabold"
            >
              View scoreboard
            </Link>
            <button
              type="button"
              onClick={logout}
              disabled={isBusy("logout")}
              className="btn-cta rounded-xl bg-saddle px-4 py-2 text-sm font-extrabold disabled:opacity-60"
            >
              <BusyLabel busy={isBusy("logout")} busyLabel="Logging out…">
                Log out
              </BusyLabel>
            </button>
          </div>
        </header>

        <OfflineBanner
          online={online}
          detail="Live scores and team edits need WiFi. You can still jot awards on Field notes, then post them when you're back online."
        />

        {loading ? (
          <p className="panel rounded-3xl px-5 py-10 text-center font-bold text-muted-soft">
            Loading…
          </p>
        ) : (
          <>
            <section className="grid gap-5 lg:grid-cols-2">
              <form
                onSubmit={submitPoints}
                className="panel rounded-3xl p-5 lg:col-start-1 lg:row-start-1"
              >
                <h2 className="display-font text-xl font-bold">Add or deduct points</h2>
                <p className="mt-1 text-sm font-semibold text-muted-soft">
                  {online
                    ? "Changes show on the public board within a few seconds."
                    : "No WiFi — save to Field notes on this device, then post when you're back."}
                </p>

                <label className="mt-4 block text-sm font-bold text-muted">
                  Team
                  <select
                    value={pointTeamId}
                    onChange={(e) =>
                      setPointTeamId(e.target.value ? Number(e.target.value) : "")
                    }
                    className="field mt-1.5 w-full rounded-xl border-2 px-3 py-3 text-base font-semibold"
                    required
                  >
                    <option value="" disabled>
                      Select a team
                    </option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.score} pts)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-3 block text-sm font-bold text-muted">
                  Points (use negative to deduct)
                  <input
                    type="number"
                    value={pointDelta}
                    onChange={(e) => setPointDelta(e.target.value)}
                    className="field mt-1.5 w-full rounded-xl border-2 px-3 py-3 text-base font-semibold"
                    required
                  />
                </label>

                <div className="mt-2 flex flex-wrap gap-2">
                  {[5, 10, 25, -5, -10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPointDelta(String(n))}
                      className="btn-soft rounded-lg border px-3 py-1.5 text-sm font-extrabold"
                    >
                      {n > 0 ? `+${n}` : n}
                    </button>
                  ))}
                </div>

                <label className="mt-3 block text-sm font-bold text-muted">
                  Note (optional)
                  <input
                    type="text"
                    value={pointNote}
                    onChange={(e) => setPointNote(e.target.value)}
                    placeholder="e.g. Capture the flag"
                    className="field mt-1.5 w-full rounded-xl border-2 px-3 py-3 text-base font-semibold"
                  />
                </label>

                {online ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                      type="submit"
                      disabled={teams.length === 0 || isBusy("submit-points")}
                      className="btn-cta w-full rounded-xl bg-buzz px-4 py-3 text-base font-extrabold disabled:opacity-50"
                    >
                      <BusyLabel
                        busy={isBusy("submit-points")}
                        busyLabel="Submitting…"
                      >
                        Submit points
                      </BusyLabel>
                    </button>
                    <button
                      type="button"
                      onClick={saveToFieldNotes}
                      disabled={teams.length === 0 || isBusy("submit-points")}
                      className="btn-soft w-full rounded-xl border px-4 py-3 text-base font-extrabold disabled:opacity-50"
                    >
                      Save for later
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={teams.length === 0}
                    className="btn-cta mt-4 w-full rounded-xl bg-woody px-4 py-3 text-base font-extrabold disabled:opacity-50"
                  >
                    Save to field notes
                  </button>
                )}
              </form>

              <FieldNotes
                notes={fieldNotes}
                online={online}
                postingId={postingNoteId}
                postingAll={postingAll}
                className="lg:col-start-2 lg:row-start-1 lg:row-span-2"
                onPost={postFieldNote}
                onDiscard={(id) => {
                  persistNotes(fieldNotes.filter((n) => n.id !== id));
                  flash("Note discarded", "It was only on this device.");
                }}
                onPostAll={postAllFieldNotes}
              />

              <form
                onSubmit={createTeam}
                className="panel rounded-3xl p-5 lg:col-start-1 lg:row-start-2"
              >
                <h2 className="display-font text-xl font-bold">Create team</h2>
                <p className="mt-1 text-sm font-semibold text-muted-soft">
                  Add as many teams as you need — names are fully dynamic.
                </p>

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
                    onChange={(e) =>
                      setNewCampGroup(e.target.value as CampGroup)
                    }
                    className="field mt-1.5 w-full rounded-xl border-2 px-3 py-3 text-base font-semibold"
                    required
                  >
                    <option value="red">Red group</option>
                    <option value="green">Green group</option>
                  </select>
                </label>

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
                          onClick={() => setNewColor(c)}
                          className="h-8 w-8 rounded-full border-2 border-white/80 shadow"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={!online || isBusy("create-team")}
                  className="btn-cta mt-4 w-full rounded-xl bg-woody px-4 py-3 text-base font-extrabold disabled:opacity-50"
                >
                  <BusyLabel
                    busy={isBusy("create-team")}
                    busyLabel="Adding team…"
                  >
                    Add team
                  </BusyLabel>
                </button>
              </form>
            </section>

            <SpiderChart teams={sortedTeams} />

            <section className="panel rounded-3xl p-5">
              <h2 className="display-font text-xl font-bold">Teams</h2>
              {sortedTeams.length === 0 ? (
                <p className="mt-3 font-semibold text-muted-soft">
                  No teams yet. Create your first team above.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {sortedTeams.map((team, index) => {
                    const teamBusy =
                      isBusy(`team-${team.id}`) || isBusy(`delete-${team.id}`);
                    return (
                    <li
                      key={team.id}
                      className="surface-card rounded-2xl border-2 p-3 sm:p-4"
                    >
                      {editingId === team.id ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <label className="flex-1 text-sm font-bold text-muted">
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
                              onChange={(e) =>
                                setEditCampGroup(e.target.value as CampGroup)
                              }
                              className="field mt-1 w-full rounded-xl border-2 px-3 py-2 font-semibold"
                            >
                              <option value="red">Red</option>
                              <option value="green">Green</option>
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
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(team.id)}
                              disabled={isBusy(`team-${team.id}`)}
                              className="btn-cta rounded-xl bg-emerald-500 px-3 py-2 text-sm font-extrabold disabled:opacity-60"
                            >
                              <BusyLabel
                                busy={isBusy(`team-${team.id}`)}
                                busyLabel="Saving…"
                              >
                                Save
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
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
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
                              <p className="text-sm font-bold text-muted-soft">
                                {team.score} pts · {team.eventCount} events
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                            <select
                              aria-label={`Camp group for ${team.name}`}
                              value={team.campGroup ?? ""}
                              disabled={teamBusy}
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
                            <button
                              type="button"
                              onClick={() => startEdit(team)}
                              disabled={teamBusy}
                              className="btn-soft rounded-xl border px-3 py-2 text-sm font-extrabold disabled:opacity-60"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDeleteTeam(team.id, team.name)}
                              disabled={teamBusy}
                              className="rounded-xl border border-woody/40 px-3 py-2 text-sm font-extrabold text-woody disabled:opacity-60"
                            >
                              Delete
                            </button>
                            {teamBusy ? (
                              <span className="col-span-2 inline-flex items-center gap-2 text-sm font-bold text-muted-soft sm:col-span-1">
                                <Spinner />
                                Saving…
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="panel rounded-3xl p-5">
                <h2 className="display-font text-xl font-bold">Point history</h2>
                {history.length === 0 ? (
                  <p className="mt-3 font-semibold text-muted-soft">
                    No point events yet.
                  </p>
                ) : (
                  <ul className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                    {history.map((row) => (
                      <li
                        key={row.id}
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
                          <p className="text-xs font-semibold text-muted-soft">
                            {new Date(row.createdAt).toLocaleString()}
                            {row.note ? ` · ${row.note}` : ""}
                          </p>
                        </div>
                        <span
                          className={`display-font shrink-0 text-lg font-bold ${
                            row.delta > 0 ? "text-emerald-400" : "text-woody"
                          }`}
                        >
                          {row.delta > 0 ? `+${row.delta}` : row.delta}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="panel rounded-3xl p-5 text-center">
                <h2 className="display-font text-xl font-bold">Camper QR code</h2>
                <p className="mt-1 text-sm font-semibold text-muted-soft">
                  Print this so kids can open the live scoreboard.
                </p>
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="QR code to camp scoreboard"
                    className="mx-auto mt-4 w-52 rounded-2xl border-2 border-field-border bg-white p-2"
                  />
                ) : (
                  <p className="mt-8 font-semibold text-muted-soft">Generating QR…</p>
                )}
                <p className="mt-3 break-all text-xs font-bold text-muted-soft">
                  {publicUrl}
                </p>
                <button
                  type="button"
                  onClick={downloadQr}
                  disabled={!qrDataUrl}
                  className="btn-cta mt-4 w-full rounded-xl bg-woody px-4 py-3 text-sm font-extrabold disabled:opacity-50"
                >
                  Download QR PNG
                </button>
              </div>
            </section>
          </>
        )}
      </div>

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
        busy={pendingDelete ? isBusy(`delete-${pendingDelete.id}`) : false}
        onConfirm={confirmDeleteTeam}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  );
}
