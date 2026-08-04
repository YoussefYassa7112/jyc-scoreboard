"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { TEAM_COLORS } from "@/lib/standings";
import { SkyDecor } from "./SkyDecor";

type TeamRow = {
  id: number;
  name: string;
  color: string;
  score: number;
  eventCount: number;
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
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TEAM_COLORS[0]);

  const [pointTeamId, setPointTeamId] = useState<number | "">("");
  const [pointDelta, setPointDelta] = useState("10");
  const [pointNote, setPointNote] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState("");

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
    setHistory(historyJson.history);
    setPointTeamId((current) =>
      current === "" && teamsJson.teams[0] ? teamsJson.teams[0].id : current,
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

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

  function flash(msg: string) {
    setMessage(msg);
    setError(null);
    window.setTimeout(() => setMessage(null), 2500);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  async function createTeam(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, color: newColor }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Could not create team");
      return;
    }
    setNewName("");
    setNewColor(TEAM_COLORS[teams.length % TEAM_COLORS.length] || TEAM_COLORS[0]);
    await refresh();
    flash("Team created");
  }

  async function saveEdit(id: number) {
    setError(null);
    const res = await fetch(`/api/teams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, color: editColor }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Could not update team");
      return;
    }
    setEditingId(null);
    await refresh();
    flash("Team updated");
  }

  async function deleteTeam(id: number, name: string) {
    if (
      !window.confirm(
        `Delete team "${name}"? This also removes its point history.`,
      )
    ) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/teams/${id}`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Could not delete team");
      return;
    }
    await refresh();
    flash("Team deleted");
  }

  async function submitPoints(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const delta = Number(pointDelta);
    if (!pointTeamId || !Number.isInteger(delta) || delta === 0) {
      setError("Pick a team and enter a non-zero whole number");
      return;
    }
    const res = await fetch("/api/points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: pointTeamId,
        delta,
        note: pointNote,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(data.error || "Could not update points");
      return;
    }
    setPointNote("");
    await refresh();
    flash(delta > 0 ? `Added ${delta} points` : `Deducted ${Math.abs(delta)} points`);
  }

  function startEdit(team: TeamRow) {
    setEditingId(team.id);
    setEditName(team.name);
    setEditColor(team.color);
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
      <SkyDecor />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="panel flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4">
          <div>
            <p className="display-font text-xs font-semibold uppercase tracking-[0.22em] text-saddle/70">
              Camp control
            </p>
            <h1 className="display-font text-2xl font-bold text-ink sm:text-3xl">
              Admin dashboard
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-xl border-2 border-saddle/20 bg-white/70 px-4 py-2 text-sm font-extrabold text-ink"
            >
              View scoreboard
            </Link>
            <button
              type="button"
              onClick={logout}
              className="rounded-xl bg-saddle px-4 py-2 text-sm font-extrabold text-cloud"
            >
              Log out
            </button>
          </div>
        </header>

        {error ? (
          <p className="rounded-2xl border-2 border-woody/40 bg-cloud/90 px-4 py-3 text-sm font-bold text-woody">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-2xl border-2 border-grass/40 bg-cloud/90 px-4 py-3 text-sm font-bold text-grass">
            {message}
          </p>
        ) : null}

        {loading ? (
          <p className="panel rounded-3xl px-5 py-10 text-center font-bold text-saddle/70">
            Loading…
          </p>
        ) : (
          <>
            <section className="grid gap-5 lg:grid-cols-2">
              <form
                onSubmit={submitPoints}
                className="panel rounded-3xl p-5"
              >
                <h2 className="display-font text-xl font-bold">Add or deduct points</h2>
                <p className="mt-1 text-sm font-semibold text-saddle/75">
                  Changes show on the public board within a few seconds.
                </p>

                <label className="mt-4 block text-sm font-bold text-saddle">
                  Team
                  <select
                    value={pointTeamId}
                    onChange={(e) =>
                      setPointTeamId(e.target.value ? Number(e.target.value) : "")
                    }
                    className="mt-1.5 w-full rounded-xl border-2 border-saddle/20 bg-white/80 px-3 py-3 text-base font-semibold"
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

                <label className="mt-3 block text-sm font-bold text-saddle">
                  Points (use negative to deduct)
                  <input
                    type="number"
                    value={pointDelta}
                    onChange={(e) => setPointDelta(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border-2 border-saddle/20 bg-white/80 px-3 py-3 text-base font-semibold"
                    required
                  />
                </label>

                <div className="mt-2 flex flex-wrap gap-2">
                  {[5, 10, 25, -5, -10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPointDelta(String(n))}
                      className="rounded-lg border border-saddle/20 bg-white/70 px-3 py-1.5 text-sm font-extrabold"
                    >
                      {n > 0 ? `+${n}` : n}
                    </button>
                  ))}
                </div>

                <label className="mt-3 block text-sm font-bold text-saddle">
                  Note (optional)
                  <input
                    type="text"
                    value={pointNote}
                    onChange={(e) => setPointNote(e.target.value)}
                    placeholder="e.g. Capture the flag"
                    className="mt-1.5 w-full rounded-xl border-2 border-saddle/20 bg-white/80 px-3 py-3 text-base font-semibold"
                  />
                </label>

                <button
                  type="submit"
                  disabled={teams.length === 0}
                  className="mt-4 w-full rounded-xl bg-buzz px-4 py-3 text-base font-extrabold text-cloud disabled:opacity-50"
                >
                  Submit points
                </button>
              </form>

              <form onSubmit={createTeam} className="panel rounded-3xl p-5">
                <h2 className="display-font text-xl font-bold">Create team</h2>
                <p className="mt-1 text-sm font-semibold text-saddle/75">
                  Add as many teams as you need — names are fully dynamic.
                </p>

                <label className="mt-4 block text-sm font-bold text-saddle">
                  Team name
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Woody Rangers"
                    required
                    className="mt-1.5 w-full rounded-xl border-2 border-saddle/20 bg-white/80 px-3 py-3 text-base font-semibold"
                  />
                </label>

                <label className="mt-3 block text-sm font-bold text-saddle">
                  Color
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="h-11 w-14 cursor-pointer rounded border border-saddle/20 bg-white"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {TEAM_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Pick ${c}`}
                          onClick={() => setNewColor(c)}
                          className="h-8 w-8 rounded-full border-2 border-white shadow"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </label>

                <button
                  type="submit"
                  className="mt-4 w-full rounded-xl bg-woody px-4 py-3 text-base font-extrabold text-cloud"
                >
                  Add team
                </button>
              </form>
            </section>

            <section className="panel rounded-3xl p-5">
              <h2 className="display-font text-xl font-bold">Teams</h2>
              {sortedTeams.length === 0 ? (
                <p className="mt-3 font-semibold text-saddle/70">
                  No teams yet. Create your first team above.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {sortedTeams.map((team, index) => (
                    <li
                      key={team.id}
                      className="rounded-2xl border-2 border-saddle/15 bg-white/60 p-3 sm:p-4"
                    >
                      {editingId === team.id ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <label className="flex-1 text-sm font-bold text-saddle">
                            Name
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="mt-1 w-full rounded-xl border-2 border-saddle/20 bg-white px-3 py-2 font-semibold"
                            />
                          </label>
                          <label className="text-sm font-bold text-saddle">
                            Color
                            <input
                              type="color"
                              value={editColor}
                              onChange={(e) => setEditColor(e.target.value)}
                              className="mt-1 block h-10 w-14 rounded border border-saddle/20"
                            />
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(team.id)}
                              className="rounded-xl bg-grass px-3 py-2 text-sm font-extrabold text-cloud"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-xl border border-saddle/20 px-3 py-2 text-sm font-extrabold"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className="display-font flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-cloud"
                            style={{ backgroundColor: team.color }}
                          >
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="display-font truncate text-lg font-bold">
                              {team.name}
                            </p>
                            <p className="text-sm font-bold text-saddle/70">
                              {team.score} pts · {team.eventCount} events
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPointTeamId(team.id);
                                setPointDelta("10");
                              }}
                              className="rounded-xl bg-buzz px-3 py-2 text-sm font-extrabold text-cloud"
                            >
                              + points
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(team)}
                              className="rounded-xl border border-saddle/20 bg-white/80 px-3 py-2 text-sm font-extrabold"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTeam(team.id, team.name)}
                              className="rounded-xl border border-woody/30 px-3 py-2 text-sm font-extrabold text-woody"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="panel rounded-3xl p-5">
                <h2 className="display-font text-xl font-bold">Point history</h2>
                {history.length === 0 ? (
                  <p className="mt-3 font-semibold text-saddle/70">
                    No point events yet.
                  </p>
                ) : (
                  <ul className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                    {history.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-saddle/10 bg-white/55 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-extrabold">
                            <span
                              className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: row.teamColor }}
                            />
                            {row.teamName}
                          </p>
                          <p className="text-xs font-semibold text-saddle/65">
                            {new Date(row.createdAt).toLocaleString()}
                            {row.note ? ` · ${row.note}` : ""}
                          </p>
                        </div>
                        <span
                          className={`display-font shrink-0 text-lg font-bold ${
                            row.delta > 0 ? "text-grass" : "text-woody"
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
                <p className="mt-1 text-sm font-semibold text-saddle/75">
                  Print this so kids can open the live scoreboard.
                </p>
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="QR code to camp scoreboard"
                    className="mx-auto mt-4 w-52 rounded-2xl border-2 border-saddle/15 bg-cloud p-2"
                  />
                ) : (
                  <p className="mt-8 font-semibold text-saddle/60">Generating QR…</p>
                )}
                <p className="mt-3 break-all text-xs font-bold text-saddle/70">
                  {publicUrl}
                </p>
                <button
                  type="button"
                  onClick={downloadQr}
                  disabled={!qrDataUrl}
                  className="mt-4 w-full rounded-xl bg-woody px-4 py-3 text-sm font-extrabold text-cloud disabled:opacity-50"
                >
                  Download QR PNG
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
