import type { StandingRow } from "./standings";

export type BoardAlert = {
  id: string;
  kind: "leader" | "team";
  title: string;
  detail?: string;
  color?: string;
  teamName?: string;
  direction?: "up" | "down";
  /** True when this announcement is about the camper's selected team. */
  mine?: boolean;
};

/**
 * Compares two standings snapshots rather than individual point events, so a
 * burst of awards from several counselors collapses into a single alert.
 *
 * Rules: a new 1st place is announced to everyone; every other movement is only
 * announced to the camper whose own team moved.
 */
export function diffStandings(
  previous: StandingRow[],
  next: StandingRow[],
  myTeamId: number | null,
  stamp: number = Date.now(),
): BoardAlert[] {
  const alerts: BoardAlert[] = [];
  if (previous.length === 0 || next.length === 0) return alerts;

  const previousLeader = previous.find((t) => t.rank === 1);
  const nextLeader = next.find((t) => t.rank === 1);
  const leaderChanged =
    previousLeader && nextLeader && previousLeader.id !== nextLeader.id;

  if (leaderChanged && nextLeader) {
    const dethronedRank = next.find((t) => t.id === previousLeader.id)?.rank;
    const mine = myTeamId === nextLeader.id;
    alerts.push({
      id: `leader-${nextLeader.id}-${stamp}`,
      kind: "leader",
      title: mine
        ? "Your team is #1!"
        : `${nextLeader.name} just took 1st place!`,
      detail: dethronedRank
        ? `${nextLeader.score} pts · ${previousLeader.name} drops to #${dethronedRank}`
        : `${nextLeader.score} pts`,
      color: nextLeader.color,
      teamName: nextLeader.name,
      mine,
    });
  }

  if (myTeamId != null) {
    const before = previous.find((t) => t.id === myTeamId);
    const after = next.find((t) => t.id === myTeamId);
    const movedUp = before && after && after.rank < before.rank;
    const movedDown = before && after && after.rank > before.rank;

    // Skip when the leader banner already tells this camper the same news.
    const coveredByLeaderAlert = leaderChanged && after?.rank === 1;

    if (after && (movedUp || movedDown) && !coveredByLeaderAlert) {
      alerts.push({
        id: `team-${after.id}-${after.rank}-${stamp}`,
        kind: "team",
        title: movedUp
          ? `Your team climbed to #${after.rank}`
          : `Your team slipped to #${after.rank}`,
        detail: `${after.name} · ${after.score} pts`,
        color: after.color,
        teamName: after.name,
        direction: movedUp ? "up" : "down",
      });
    }
  }

  return alerts;
}
