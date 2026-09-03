"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { panelIn, springSoft } from "@/lib/motion";
import {
  clampScore,
  mergeScheduleActivities,
  readScoringActivities,
  sanitizeActivity,
  writeScoringActivities,
  type AwardDraft,
  type ScoringActivity,
} from "@/lib/scoring";
import { BusyLabel } from "./Spinner";
import { NeedsWifiNotice } from "./OfflineBanner";
import { teamChipStyle } from "@/lib/utils";

type TeamOption = {
  id: number;
  name: string;
  color: string;
  score: number;
};

type Props = {
  teams: TeamOption[];
  online: boolean;
  busy: boolean;
  onAward: (drafts: AwardDraft[]) => void;
  onSaveForLater: (drafts: AwardDraft[]) => void;
  onSetupSaved?: () => void;
};

type Tab = "activities" | "extra";

export function AwardPointsPanel({
  teams,
  online,
  busy,
  onAward,
  onSaveForLater,
  onSetupSaved,
}: Props) {
  const [activities, setActivities] = useState<ScoringActivity[]>(() =>
    readScoringActivities(),
  );
  const [teamId, setTeamId] = useState<number | "">(
    () => teams[0]?.id ?? "",
  );
  const [tab, setTab] = useState<Tab>("activities");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupDraft, setSetupDraft] = useState<ScoringActivity[] | null>(null);
  const [extraAmount, setExtraAmount] = useState("5");
  const [extraSign, setExtraSign] = useState<1 | -1>(1);
  const [extraReason, setExtraReason] = useState("");
  const [setupBusy, setSetupBusy] = useState<"save" | string | null>(
    null,
  );
  const [setupDone, setSetupDone] = useState(false);
  const [pointDrafts, setPointDrafts] = useState<Record<string, string>>({});
  const setupDoneTimer = useRef<number>(0);

  useEffect(() => {
    if (teams.length === 0) {
      setTeamId("");
      return;
    }
    if (teamId === "" || !teams.some((team) => team.id === teamId)) {
      setTeamId(teams[0].id);
    }
  }, [teams, teamId]);

  // The caps live on the server so every phone and laptop agrees on what an
  // activity is worth. localStorage is kept as an offline copy, not the record:
  // it used to be the only place they existed, which is why a change made on a
  // laptop never reached anyone else's device.
  const [setupError, setSetupError] = useState<string | null>(null);
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/scoring", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { activities?: ScoringActivity[] | null };
        if (cancelled || !data.activities?.length) return;
        setActivities(data.activities);
        writeScoringActivities(data.activities);
      } catch {
        /* offline or flaky — the local copy stands */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online]);

  const enabled = useMemo(
    () => activities.filter((row) => row.enabled),
    [activities],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enabled;
    return enabled.filter((row) => row.title.toLowerCase().includes(q));
  }, [enabled, query]);

  const selectedRows = enabled.filter((row) => row.id in selected);
  const selectedTotal = selectedRows.reduce(
    (sum, row) => sum + (selected[row.id] ?? 0),
    0,
  );

  const setupList = setupDraft ?? activities;

  useEffect(() => {
    return () => window.clearTimeout(setupDoneTimer.current);
  }, []);

  function persist(next: ScoringActivity[]) {
    setActivities(next);
    writeScoringActivities(next);
    setSelected((current) => {
      const allowed = new Set(
        next.filter((row) => row.enabled).map((row) => row.id),
      );
      const updated: Record<string, number> = {};
      for (const [id, value] of Object.entries(current)) {
        if (!allowed.has(id)) continue;
        const row = next.find((item) => item.id === id);
        if (!row) continue;
        updated[id] = clampScore(value, row.minPoints, row.maxPoints);
      }
      return updated;
    });
    setScoreDrafts({});
    setPointDrafts({});
    setSetupDraft(next.map((row) => ({ ...row })));
  }

  function patchSetup(next: ScoringActivity[]) {
    setSetupDraft(next);
  }

  function openSetup() {
    setSetupDraft(activities.map((row) => ({ ...row })));
    setSetupOpen(true);
  }

  function closeSetup() {
    setSetupDraft(null);
    setPointDrafts({});
    setSetupOpen(false);
  }

  function pointDraftKey(id: string, field: "min" | "max") {
    return `${id}:${field}`;
  }

  function pointDraftValue(row: ScoringActivity, field: "min" | "max") {
    const key = pointDraftKey(row.id, field);
    if (key in pointDrafts) return pointDrafts[key];
    return String(field === "min" ? row.minPoints : row.maxPoints);
  }

  function setPointDraft(
    row: ScoringActivity,
    field: "min" | "max",
    raw: string,
  ) {
    const cleaned = raw.replace(/[^\d-]/g, "");
    setPointDrafts((current) => ({
      ...current,
      [pointDraftKey(row.id, field)]: cleaned,
    }));
  }

  function commitPointDraft(row: ScoringActivity, field: "min" | "max") {
    const raw = pointDraftValue(row, field);
    const n = Number(raw);
    const nextVal = Number.isFinite(n) ? Math.trunc(n) : 0;
    patchSetup(
      setupList.map((item) =>
        item.id === row.id
          ? sanitizeActivity({
              ...item,
              [field === "min" ? "minPoints" : "maxPoints"]: nextVal,
            }) ?? item
          : item,
      ),
    );
    setPointDrafts((current) => {
      const next = { ...current };
      delete next[pointDraftKey(row.id, field)];
      return next;
    });
  }

  async function commitSetup(
    next: ScoringActivity[],
    key: "save" | string,
  ) {
    setSetupBusy(key);
    setSetupDone(false);
    setSetupError(null);
    const list = applyPointDrafts(next);

    // Written locally first so the screen never lies about what was typed, then
    // sent. A failure says so rather than leaving this device quietly ahead of
    // every other one.
    persist(list);
    if (online) {
      try {
        const res = await fetch("/api/scoring", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activities: list }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Could not save to the camp");
        }
      } catch (err) {
        setSetupError(
          err instanceof Error
            ? `${err.message} — saved on this device only.`
            : "Saved on this device only.",
        );
      }
    } else {
      setSetupError("No WiFi — saved on this device only, not shared yet.");
    }

    setSetupBusy(null);
    setSetupDone(true);
    onSetupSaved?.();
    window.clearTimeout(setupDoneTimer.current);
    setupDoneTimer.current = window.setTimeout(() => setSetupDone(false), 3200);
  }

  function saveSetup() {
    if (!setupDraft) return;
    void commitSetup(setupDraft, "save");
  }

  function cancelSetup() {
    setPointDrafts({});
    setSetupDraft(activities.map((row) => ({ ...row })));
  }

  function applyPointDrafts(list: ScoringActivity[]) {
    return list.map((item) => {
      const minRaw = pointDrafts[pointDraftKey(item.id, "min")];
      const maxRaw = pointDrafts[pointDraftKey(item.id, "max")];
      if (minRaw === undefined && maxRaw === undefined) return item;
      const minPoints =
        minRaw !== undefined && Number.isFinite(Number(minRaw))
          ? Math.trunc(Number(minRaw))
          : item.minPoints;
      const maxPoints =
        maxRaw !== undefined && Number.isFinite(Number(maxRaw))
          ? Math.trunc(Number(maxRaw))
          : item.maxPoints;
      return sanitizeActivity({ ...item, minPoints, maxPoints }) ?? item;
    });
  }

  const setupDirty =
    setupDraft !== null &&
    JSON.stringify(applyPointDrafts(setupDraft)) !==
      JSON.stringify(activities);

  function toggleActivity(row: ScoringActivity) {
    setSelected((current) => {
      if (row.id in current) {
        const next = { ...current };
        delete next[row.id];
        return next;
      }
      return {
        ...current,
        [row.id]: clampScore(row.maxPoints, row.minPoints, row.maxPoints),
      };
    });
    setScoreDrafts((current) => {
      if (!(row.id in current)) return current;
      const next = { ...current };
      delete next[row.id];
      return next;
    });
  }

  function setActivityScore(row: ScoringActivity, value: number) {
    setSelected((current) => ({
      ...current,
      [row.id]: clampScore(value, row.minPoints, row.maxPoints),
    }));
    setScoreDrafts((current) => {
      if (!(row.id in current)) return current;
      const next = { ...current };
      delete next[row.id];
      return next;
    });
  }

  function commitCustomScore(row: ScoringActivity, raw: string) {
    const n = Number(raw);
    setActivityScore(row, Number.isFinite(n) ? n : row.minPoints);
  }

  function activityDrafts(): AwardDraft[] | null {
    if (!teamId) return null;
    if (selectedRows.length === 0) return null;
    return selectedRows.map((row) => ({
      teamId,
      delta: clampScore(
        selected[row.id] ?? row.maxPoints,
        row.minPoints,
        row.maxPoints,
      ),
      kind: "activity" as const,
      title: row.title,
      minPoints: row.minPoints,
      maxPoints: row.maxPoints,
    }));
  }

  function extraDraft(): AwardDraft | null {
    if (!teamId) return null;
    const amount = Number(extraAmount);
    if (!Number.isInteger(amount) || amount === 0) return null;
    const delta = extraSign * Math.abs(amount);
    return {
      teamId,
      delta,
      kind: "extra",
      title: extraReason.trim() || "Extra",
      reason: extraReason,
    };
  }

  function submitActivities(e: FormEvent) {
    e.preventDefault();
    const drafts = activityDrafts();
    if (!drafts) return;
    if (online) onAward(drafts);
    else onSaveForLater(drafts);
    setSelected({});
    setScoreDrafts({});
  }

  function submitExtra(e: FormEvent) {
    e.preventDefault();
    const draft = extraDraft();
    if (!draft) return;
    if (online) onAward([draft]);
    else onSaveForLater([draft]);
    setExtraReason("");
  }


  const canSubmitActivities = Boolean(teamId) && selectedRows.length > 0 && !busy;
  const extraDelta = extraSign * Math.abs(Number(extraAmount) || 0);
  const canSubmitExtra =
    Boolean(teamId) && Number.isInteger(Number(extraAmount)) && extraDelta !== 0 && !busy;

  return (
    <motion.section
      layout
      variants={panelIn}
      className="panel rounded-3xl p-4 sm:p-5 lg:col-start-1 lg:row-start-1"
    >
      <h2 className="display-font text-xl font-bold">Award points</h2>
      <p className="mt-1 text-sm font-semibold text-muted-soft">
        Pick a team, then score the events you turned on. Each event stays inside
        its min–max cap. Use Extra for one-off bonuses or deductions.
      </p>
      {!online ? (
        <div className="mt-3">
          <NeedsWifiNotice>
            Live posting is blocked. You can still save field notes on this device.
          </NeedsWifiNotice>
        </div>
      ) : null}

      <p className="mt-4 text-sm font-bold text-muted">Team</p>
      {teams.length === 0 ? (
        <p className="mt-2 text-sm font-semibold text-muted-soft">
          Create a team first.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {teams.map((team) => {
            const active = team.id === teamId;
            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setTeamId(team.id)}
                className={`max-w-full break-words rounded-xl border-2 px-3 py-2 text-sm font-extrabold ${
                  active ? "ring-2 ring-white/85 dark:ring-white/80" : ""
                }`}
                style={teamChipStyle(team.color, active)}
                aria-pressed={active}
              >
                {team.name}
                <span className="ml-1 text-xs font-bold opacity-80">
                  {team.score}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab("activities")}
          className={`rounded-xl border-2 px-3 py-2 text-sm font-extrabold ${
            tab === "activities"
              ? "border-star bg-star text-on-star"
              : "btn-chip"
          }`}
          aria-pressed={tab === "activities"}
        >
          Camp events
        </button>
        <button
          type="button"
          onClick={() => setTab("extra")}
          className={`rounded-xl border-2 px-3 py-2 text-sm font-extrabold ${
            tab === "extra"
              ? "border-star bg-star text-on-star"
              : "btn-chip"
          }`}
          aria-pressed={tab === "extra"}
        >
          Extra
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {tab === "activities" ? (
          <motion.form
            key="activities"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={springSoft}
            onSubmit={submitActivities}
            className="mt-4"
          >
            {enabled.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-saddle/25 px-3 py-6 text-center text-sm font-semibold text-muted-soft">
                No scoring events are on yet. Open setup below and enable the
                activities you want to award.
              </p>
            ) : (
              <>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter events"
                  className="field w-full rounded-xl border-2 px-3 py-2.5 text-sm font-semibold"
                />
                <ul className="mt-3 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                  {visible.map((row) => {
                    const isOn = row.id in selected;
                    const score = selected[row.id] ?? row.maxPoints;
                    const scoreText = scoreDrafts[row.id] ?? String(score);
                    return (
                      <li
                        key={row.id}
                        className={`rounded-2xl border-2 px-3 py-2.5 ${
                          isOn
                            ? "border-saddle bg-chip/70 dark:border-white/50"
                            : "border-field-border"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleActivity(row)}
                          className="flex w-full items-start justify-between gap-3 text-left"
                        >
                          <span>
                            <span className="block font-extrabold text-card-ink">
                              {row.title}
                            </span>
                            <span className="text-xs font-semibold text-muted-soft">
                              Cap {row.minPoints}–{row.maxPoints} pts
                            </span>
                          </span>
                          <span
                            className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-black ${
                              isOn
                                ? "border-saddle bg-star text-on-star dark:border-white"
                                : "border-saddle/30 text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                        </button>
                        {isOn ? (
                          <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActivityScore(row, score - 1)}
                                  disabled={score <= row.minPoints}
                                  className="btn-soft h-10 w-10 shrink-0 rounded-xl border text-lg font-black disabled:opacity-40"
                                >
                                  −
                                </button>
                                <label className="sr-only" htmlFor={`score-${row.id}`}>
                                  Custom points for {row.title}
                                </label>
                                <input
                                  id={`score-${row.id}`}
                                  type="number"
                                  inputMode="numeric"
                                  min={row.minPoints}
                                  max={row.maxPoints}
                                  value={scoreText}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    setScoreDrafts((current) => ({
                                      ...current,
                                      [row.id]: raw,
                                    }));
                                    const n = Number(raw);
                                    if (!Number.isInteger(n)) return;
                                    setSelected((current) => ({
                                      ...current,
                                      [row.id]: clampScore(
                                        n,
                                        row.minPoints,
                                        row.maxPoints,
                                      ),
                                    }));
                                  }}
                                  onBlur={(e) => commitCustomScore(row, e.target.value)}
                                  className="field display-font h-10 w-[5.25rem] shrink-0 rounded-xl border-2 px-2 text-center text-2xl font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => setActivityScore(row, score + 1)}
                                  disabled={score >= row.maxPoints}
                                  className="btn-soft h-10 w-10 shrink-0 rounded-xl border text-lg font-black disabled:opacity-40"
                                >
                                  +
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setActivityScore(row, row.minPoints)}
                                  className="btn-soft rounded-lg border px-2.5 py-1.5 text-xs font-extrabold"
                                >
                                  Min
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActivityScore(row, row.maxPoints)}
                                  className="btn-soft rounded-lg border px-2.5 py-1.5 text-xs font-extrabold"
                                >
                                  Max
                                </button>
                              </div>
                            </div>
                            <p className="text-xs font-semibold text-muted-soft">
                              Type any amount in the {row.minPoints}–{row.maxPoints} cap.
                            </p>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <p className="mt-3 text-sm font-bold text-muted-soft">
              {selectedRows.length === 0
                ? "Select one or more events to award."
                : `${selectedRows.length} event${selectedRows.length === 1 ? "" : "s"} · ${selectedTotal > 0 ? "+" : ""}${selectedTotal} pts`}
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {online ? (
                <>
                  <button
                    type="submit"
                    disabled={!canSubmitActivities}
                    className="btn-cta w-full rounded-xl bg-star px-4 py-3 text-base font-extrabold disabled:opacity-50"
                  >
                    <BusyLabel busy={busy} busyLabel="Awarding…">
                      Award selected
                    </BusyLabel>
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmitActivities}
                    onClick={() => {
                      const drafts = activityDrafts();
                      if (!drafts) return;
                      onSaveForLater(drafts);
                      setSelected({});
                      setScoreDrafts({});
                    }}
                    className="btn-soft w-full rounded-xl border px-4 py-3 text-base font-extrabold disabled:opacity-50"
                  >
                    Save for later
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={!canSubmitActivities}
                  className="btn-cta w-full rounded-xl bg-star px-4 py-3 text-base font-extrabold disabled:opacity-50 sm:col-span-2"
                >
                  Save to field notes
                  <span className="mt-0.5 block text-[11px] font-bold opacity-80">
                    Needs WiFi to post live
                  </span>
                </button>
              )}
            </div>
          </motion.form>
        ) : (
          <motion.form
            key="extra"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={springSoft}
            onSubmit={submitExtra}
            className="mt-4"
          >
            <p className="text-sm font-semibold text-muted-soft">
              Random bonus or deduction that is not tied to a camp event.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExtraSign(1)}
                className={`rounded-xl border-2 px-3 py-2 text-sm font-extrabold ${
                  extraSign === 1
                    ? "border-emerald-600 bg-emerald-500/15 text-emerald-800 dark:border-emerald-400 dark:text-emerald-300"
                    : "btn-chip"
                }`}
              >
                Award
              </button>
              <button
                type="button"
                onClick={() => setExtraSign(-1)}
                className={`rounded-xl border-2 px-3 py-2 text-sm font-extrabold ${
                  extraSign === -1
                    ? "border-red-600 bg-red-500/15 text-red-700 dark:border-red-400 dark:text-red-300"
                    : "btn-chip"
                }`}
              >
                Deduct
              </button>
            </div>
            <label className="mt-3 block text-sm font-bold text-muted">
              Points
              <input
                type="number"
                min={1}
                value={extraAmount}
                onChange={(e) => setExtraAmount(e.target.value)}
                className="field mt-1.5 w-full rounded-xl border-2 px-3 py-3 text-base font-semibold"
                required
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 5, 10, 25].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setExtraAmount(String(n))}
                  className="btn-soft rounded-lg border px-3 py-1.5 text-sm font-extrabold"
                >
                  {n}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm font-bold text-muted">
              Reason
              <input
                type="text"
                value={extraReason}
                onChange={(e) => setExtraReason(e.target.value)}
                placeholder="e.g. Helped clean up, late to chapel"
                className="field mt-1.5 w-full rounded-xl border-2 px-3 py-3 text-base font-semibold"
              />
            </label>
            <p className="mt-2 text-sm font-bold text-muted-soft">
              This will post{" "}
              <span
                className={
                  extraDelta >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }
              >
                {extraDelta > 0 ? `+${extraDelta}` : extraDelta || 0}
              </span>
              {extraReason.trim() ? ` · ${extraReason.trim()}` : ""}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {online ? (
                <>
                  <button
                    type="submit"
                    disabled={!canSubmitExtra}
                    className="btn-cta w-full rounded-xl bg-star px-4 py-3 text-base font-extrabold disabled:opacity-50"
                  >
                    <BusyLabel busy={busy} busyLabel="Posting…">
                      {extraSign === 1 ? "Award extra" : "Deduct extra"}
                    </BusyLabel>
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmitExtra}
                    onClick={() => {
                      const draft = extraDraft();
                      if (!draft) return;
                      onSaveForLater([draft]);
                      setExtraReason("");
                    }}
                    className="btn-soft w-full rounded-xl border px-4 py-3 text-base font-extrabold disabled:opacity-50"
                  >
                    Save for later
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={!canSubmitExtra}
                  className="btn-cta w-full rounded-xl bg-star px-4 py-3 text-base font-extrabold disabled:opacity-50 sm:col-span-2"
                >
                  Save to field notes
                  <span className="mt-0.5 block text-[11px] font-bold opacity-80">
                    Needs WiFi to post live
                  </span>
                </button>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-5 border-t border-saddle/15 pt-4 dark:border-white/10">
        <button
          type="button"
          onClick={() => (setupOpen ? closeSetup() : openSetup())}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="display-font block text-lg font-bold">
              Set up scoring events
            </span>
            <span className="text-xs font-semibold text-muted-soft">
              Turn events on, then set the min and max points for each one.
              Save when you are done.
            </span>
          </span>
          <span className="text-lg font-black text-muted-soft">
            {setupOpen ? "−" : "+"}
          </span>
        </button>

        {setupOpen ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={setupBusy !== null}
                onClick={() =>
                  patchSetup(mergeScheduleActivities(setupList))
                }
                className="btn-soft rounded-xl border px-3 py-2 text-xs font-extrabold disabled:opacity-50"
              >
                Add missing camp events
              </button>
              <button
                type="button"
                disabled={setupBusy !== null}
                onClick={() =>
                  patchSetup(setupList.map((row) => ({ ...row, enabled: true })))
                }
                className="btn-soft rounded-xl border px-3 py-2 text-xs font-extrabold disabled:opacity-50"
              >
                Enable all
              </button>
              <button
                type="button"
                disabled={setupBusy !== null}
                onClick={() =>
                  patchSetup(setupList.map((row) => ({ ...row, enabled: false })))
                }
                className="btn-soft rounded-xl border px-3 py-2 text-xs font-extrabold disabled:opacity-50"
              >
                Disable all
              </button>
            </div>
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {setupList.map((row) => (
                <li
                  key={row.id}
                  className="grid gap-2 rounded-2xl border border-field-border px-3 py-2 sm:grid-cols-[auto_1fr_4.5rem_4.5rem_auto] sm:items-center"
                >
                  <label className="flex items-center gap-2 text-sm font-extrabold">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) =>
                        patchSetup(
                          setupList.map((item) =>
                            item.id === row.id
                              ? { ...item, enabled: e.target.checked }
                              : item,
                          ),
                        )
                      }
                      className="h-4 w-4 accent-[var(--star)]"
                    />
                    <span className="sm:hidden">On</span>
                  </label>
                  <p className="text-sm font-extrabold text-card-ink">{row.title}</p>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-muted-soft">
                    Min
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pointDraftValue(row, "min")}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        setPointDraft(row, "min", e.target.value)
                      }
                      onBlur={() => commitPointDraft(row, "min")}
                      className="field mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm font-semibold [appearance:textfield]"
                    />
                  </label>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-muted-soft">
                    Max
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pointDraftValue(row, "max")}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        setPointDraft(row, "max", e.target.value)
                      }
                      onBlur={() => commitPointDraft(row, "max")}
                      className="field mt-0.5 w-full rounded-lg border px-2 py-1.5 text-sm font-semibold [appearance:textfield]"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={setupBusy !== null}
                    onClick={() =>
                      void commitSetup(
                        setupList.filter((item) => item.id !== row.id),
                        `del-${row.id}`,
                      )
                    }
                    className="btn-danger rounded-xl px-3 py-2 text-xs font-extrabold disabled:opacity-50"
                  >
                    <BusyLabel
                      busy={setupBusy === `del-${row.id}`}
                      busyLabel="Removing…"
                    >
                      Delete
                    </BusyLabel>
                  </button>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={cancelSetup}
                disabled={!setupDirty || setupBusy !== null}
                className="btn-chip rounded-xl px-4 py-3 text-sm font-extrabold disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSetup}
                disabled={!setupDirty || setupBusy !== null}
                className="btn-cta rounded-xl bg-star px-4 py-3 text-sm font-extrabold disabled:opacity-40"
              >
                <BusyLabel busy={setupBusy === "save"} busyLabel="Saving…">
                  Save
                </BusyLabel>
              </button>
            </div>
            {setupError ? (
              <p
                className="rounded-xl border-2 border-amber-400 bg-amber-300/25 px-3 py-2 text-center text-xs font-extrabold text-card-ink"
                role="status"
                aria-live="polite"
              >
                ⚠️ {setupError}
              </p>
            ) : setupDone ? (
              <p
                className="text-center text-sm font-extrabold text-emerald-700 dark:text-emerald-300"
                role="status"
                aria-live="polite"
              >
                Saved for the whole camp
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.section>
  );
}
