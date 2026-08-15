/**
 * Sanity check for reminder timing and rank-alert rules against the real camp
 * schedule, with a faked clock. Run with: npx tsx scripts/check-reminders.ts
 */
import { campDays } from "../src/data/schedule";
import {
  findDueReminder,
  findDueReminders,
  findScheduleAlert,
} from "../src/lib/event-reminders";
import { diffStandings } from "../src/lib/rank-alerts";
import { buildDemoDay } from "../src/lib/schedule-demo";
import {
  blockStatus,
  blocksForGroup,
  eventDateTimes,
  findLiveEvents,
  findUpcomingEvent,
  findUpcomingExclusive,
} from "../src/lib/schedule-time";
import type { StandingRow } from "../src/lib/standings";

let failures = 0;

function check(label: string, condition: boolean, extra = "") {
  const status = condition ? "PASS" : "FAIL";
  if (!condition) failures += 1;
  console.log(`${status}  ${label}${extra ? ` — ${extra}` : ""}`);
}

// --- Reminder timing -------------------------------------------------------
const day = campDays[0];
const greenBlocks = blocksForGroup(day, "green");
const firstTimed = greenBlocks.find((b) => eventDateTimes(day, b));
if (!firstTimed) throw new Error("No timed green block to test against");
const start = eventDateTimes(day, firstTimed)!.start;

const at14min = new Date(start.getTime() - 14 * 60_000);
const at30min = new Date(start.getTime() - 30 * 60_000);
const at1minAfter = new Date(start.getTime() + 60_000);

const due = findDueReminder("green", at14min);
check("14 min before -> reminder due", due !== null, due?.title);
check(
  "14 min before -> names the right block",
  due?.key.includes(`:${firstTimed.id}:`) ?? false,
  due?.key,
);
check("30 min before -> nothing yet", findDueReminder("green", at30min) === null);
check("after it started -> no reminder yet (next one is hours away)", findDueReminder("green", at1minAfter) === null);

const ice = greenBlocks.find((b) => b.id.includes("icebreaker") || /ice/i.test(b.title));
if (ice) {
  const iceStart = eventDateTimes(day, ice)!.start;
  const fourteenBeforeIce = new Date(iceStart.getTime() - 14 * 60_000);
  const arriveLive = findScheduleAlert("green", fourteenBeforeIce, [], null);
  check(
    "opening the board during a live event announces it",
    arriveLive?.phase === "started",
    arriveLive?.title,
  );
  const justStarted = findScheduleAlert(
    "green",
    iceStart,
    [],
    new Date(iceStart.getTime() - 1000),
  );
  check(
    "when the next event starts, late campers get a started ping",
    justStarted?.phase === "started" && justStarted.key.includes(ice.id),
    `${justStarted?.phase} ${justStarted?.title}`,
  );
}

const arbre = greenBlocks.find((b) => /arbre/i.test(b.title));
if (arbre) {
  const arbreTimes = eventDateTimes(day, arbre)!;
  const fourteenBeforeArbre = new Date(arbreTimes.start.getTime() - 14 * 60_000);
  const arbreDue = findDueReminder("green", fourteenBeforeArbre);
  check(
    "after the live event ends, next within 15 min reminds",
    arbreDue?.key.includes(`:${arbre.id}:`) ?? false,
    arbreDue?.title,
  );
  const afterArbre = findScheduleAlert(
    "green",
    arbreTimes.end,
    [],
    new Date(arbreTimes.end.getTime() - 1000),
  );
  check(
    "when an event ends, stay quiet unless the next one is close or already live",
    afterArbre === null ||
      afterArbre.phase === "upcoming" ||
      afterArbre.phase === "started",
    `${afterArbre?.phase} ${afterArbre?.title}`,
  );
}

const lunch = greenBlocks.find((b) => b.id === "d1-green-lunch-topic1");
if (lunch && arbre) {
  const lunchEnd = eventDateTimes(day, lunch)!.end;
  const afterLunch = findScheduleAlert(
    "green",
    lunchEnd,
    [],
    new Date(lunchEnd.getTime() - 1000),
  );
  check(
    "gap after an event ends → time-to-go for the next event within 15 min",
    afterLunch?.phase === "upcoming" &&
      (afterLunch.key.includes(arbre.id) ?? false),
    `${afterLunch?.phase} ${afterLunch?.title}`,
  );
}
check(
  "already sent -> not repeated",
  findDueReminder("green", at14min, [due?.key ?? ""]) === null,
);

// Red and green tracks can differ, so make sure the group is honoured.
const redDue = findDueReminder("red", at14min);
check("red track resolves its own block", redDue !== null, redDue?.title);

// --- Demo / live / done stamps --------------------------------------------
const origin = new Date(2026, 7, 14, 12, 0, 0);
const demo = buildDemoDay(origin);
const byId = (id: string) => demo.blocks.find((b) => b.id === id)!;
check("demo done card", blockStatus(demo, byId("demo-done"), origin) === "done");
check(
  "demo live card",
  blockStatus(demo, byId("demo-live-red"), origin) === "live",
);
check(
  "demo upcoming card",
  blockStatus(demo, byId("demo-soon"), origin) === "upcoming",
);
check(
  "demo live stamps done after it ends",
  blockStatus(
    demo,
    byId("demo-live-red"),
    new Date(origin.getTime() + 3 * 60_000),
  ) === "done",
);
const demoLive = findLiveEvents("overview", origin, [demo]);
check(
  "everyone view lists overlapping red + green, not a clashing everyone event",
  demoLive.length >= 3 &&
    demoLive.every((e) => e.block.group !== "all") &&
    demoLive.some((e) => e.block.id === "demo-live-red") &&
    demoLive.some((e) => e.block.id === "demo-live-green"),
  demoLive.map((e) => e.block.id).join(", "),
);
check(
  "red track live is red-only while everyone is not happening",
  findLiveEvents("red", origin, [demo]).every((e) => e.block.group === "red") &&
    !findLiveEvents("red", origin, [demo]).some(
      (e) => e.block.id === "demo-live-green",
    ),
);
const demoNext = findUpcomingEvent("overview", origin, [demo]);
check(
  "demo reminder targets the upcoming block, not the live one",
  demoNext.kind === "next" && demoNext.block.id === "demo-soon",
  demoNext.kind === "next" ? demoNext.block.id : demoNext.kind,
);
check(
  "everyone / red / green each have a next event",
  findUpcomingEvent("all", origin, [demo]).kind === "next" &&
    findUpcomingExclusive("red", origin, [demo]).kind === "next" &&
    findUpcomingExclusive("green", origin, [demo]).kind === "next",
);
const redOnlyNext = findUpcomingExclusive("red", origin, [demo]);
check(
  "red next skips the shared everyone block",
  redOnlyNext.kind === "next" && redOnlyNext.block.id === "demo-next-red",
  redOnlyNext.kind === "next" ? redOnlyNext.block.id : redOnlyNext.kind,
);
check(
  "20-minute test event is still upcoming",
  blockStatus(demo, byId("demo-later"), origin) === "upcoming",
);
const overviewDue = findDueReminders("overview", at14min);
const overviewKeys = overviewDue.map((d) => d.key);
check(
  "overview reminders send only the soonest event",
  overviewDue.length <= 1,
  overviewKeys.join(", "),
);

// --- Rank alerts -----------------------------------------------------------
const team = (
  id: number,
  name: string,
  score: number,
  rank: number,
): StandingRow => ({ id, name, score, rank, color: "#C45C26", campGroup: null });

const before = [team(1, "Alpha", 50, 1), team(2, "Bravo", 40, 2), team(3, "Cee", 10, 3)];
const leaderFlip = [team(2, "Bravo", 60, 1), team(1, "Alpha", 50, 2), team(3, "Cee", 10, 3)];
const scoreOnly = [team(1, "Alpha", 90, 1), team(2, "Bravo", 40, 2), team(3, "Cee", 10, 3)];
const ownMoved = [team(1, "Alpha", 50, 1), team(3, "Cee", 45, 2), team(2, "Bravo", 40, 3)];

const leaderAlerts = diffStandings(before, leaderFlip, null, 1);
check("leader swap alerts everyone", leaderAlerts.length === 1 && leaderAlerts[0].kind === "leader", leaderAlerts[0]?.title);
check(
  "points without rank change stay silent",
  diffStandings(before, scoreOnly, 1, 1).length === 0,
);
check(
  "other teams moving does not alert a bystander",
  diffStandings(before, ownMoved, 1, 1).length === 0,
);
const mine = diffStandings(before, ownMoved, 3, 1);
check("your own climb alerts only you", mine.length === 1 && mine[0].kind === "team", mine[0]?.title);
const newLeaderIsMine = diffStandings(before, leaderFlip, 2, 1);
check(
  "taking the lead is announced once, as your team",
  newLeaderIsMine.length === 1 &&
    newLeaderIsMine[0].kind === "leader" &&
    newLeaderIsMine[0].mine === true &&
    newLeaderIsMine[0].title === "Your team is #1!",
  newLeaderIsMine[0]?.title,
);
check("first ever snapshot is silent", diffStandings([], leaderFlip, 2, 1).length === 0);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
