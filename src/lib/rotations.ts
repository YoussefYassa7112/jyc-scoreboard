import { getCabin, type CabinInfo } from "@/lib/cabins";
import { campCabins } from "@/lib/cabins";
import type { ScheduleBlock } from "@/data/schedule";
import { getLocation } from "@/data/locations";
import { parseTimeRange } from "@/lib/schedule-time";

/**
 * Where each rotating activity actually happens.
 *
 * The rounds used to arrive as one block called "Rotating Activities
 * (2 rounds)" whose location read "Outside · BabyFoot in B1 — Caf" — a
 * sentence a camper has to decode, and two map buttons to guess between. They
 * are separate events in separate places, so they are modelled as such.
 */
const ROTATION_VENUES: { match: RegExp; locationId: string }[] = [
  { match: /babyfoot|baby ?foot|foosball/i, locationId: "caf" },
];
const DEFAULT_ROTATION_LOCATION = "outside";

export function rotationVenue(activity: string): string {
  const hit = ROTATION_VENUES.find((v) => v.match.test(activity));
  return hit ? hit.locationId : DEFAULT_ROTATION_LOCATION;
}

/**
 * The activity this cabin is doing in each round of a rotation block, in
 * order — or null when the block is not a rotation the cabin takes part in.
 */
export function rotationRoundsForCabin(
  block: ScheduleBlock,
  cabinId: number | null | undefined,
): string[] | null {
  if (cabinId == null) return null;
  const cabin = getCabin(cabinId);
  if (!cabin || !block.details?.length) return null;

  const rounds: string[] = [];
  for (const line of block.details) {
    const activity = activityForCabin(line, cabin);
    if (!activity) return null; // not a rotation line — leave the block alone
    rounds.push(activity);
  }
  return rounds.length ? rounds : null;
}

/**
 * "3:00 – 3:30 — Green: Obstacle Course · Red: Pulling Tire (TTT) · Light
 * Blue: BabyFoot · Purple: Kickball" is four colours talking at once. Pull out
 * the one this cabin is wearing, dropping the time prefix: the round carries
 * its own clock once it is a block of its own.
 */
function activityForCabin(line: string, cabin: CabinInfo): string | null {
  // Longest first, so "Light Blue" is not shadowed by "Blue". Built by
  // concatenation rather than escapes: every pattern here is plain text.
  const names = campCabins
    .map((c) => c.name)
    .sort((a, b) => b.length - a.length)
    .join("|");
  if (!new RegExp("(" + names + ") *:", "i").test(line)) return null;

  const mine = new RegExp(cabin.name + " *:([^]*)$", "i");
  for (const part of line.split("\u00b7")) {
    const hit = part.match(mine);
    if (hit) return hit[1].replace(/\s+/g, " ").trim();
  }
  return null;
}

/**
 * Turn one rotation block into one block per round, for this cabin.
 *
 * Every other block passes through untouched. A rotation becomes real events:
 * its own half of the hour, its own title ("Kickball"), and its own single
 * place — so "Happening now" names the activity, the reminder says where to
 * walk, and there is one map button instead of a choice between two.
 *
 * Round times are read from the clock written at the front of each detail
 * line, then held as fractions of the parent block's own span rather than as
 * absolute times — so the camp simulation, which rewrites block times but not
 * the text inside them, still lands every round in the right place. When a
 * line carries no usable time the span is divided evenly instead, which is
 * what this did for every round before some of them stopped being adjacent.
 */
export function expandRotationForCabin(
  block: ScheduleBlock,
  cabinId: number | null | undefined,
): ScheduleBlock[] {
  const rounds = rotationRoundsForCabin(block, cabinId);
  if (!rounds) return [block];

  const span = blockSpan(block);
  const written = writtenRoundFractions(block, rounds.length);
  return rounds.map((activity, index) => {
    const locationId = rotationVenue(activity);
    const where = getLocation(locationId);
    const slice = span
      ? written
        ? sliceFraction(span, written[index])
        : sliceSpan(span, index, rounds.length)
      : null;
    return {
      ...block,
      id: `${block.id}-r${index + 1}`,
      title: activity,
      note: rounds.length > 1 ? `Round ${index + 1} of ${rounds.length}` : block.note,
      time: slice ? rewriteRange(slice.start, slice.end) : block.time,
      startMs: slice && block.startMs != null ? slice.start : undefined,
      endMs: slice && block.startMs != null ? slice.end : undefined,
      location: where?.label ?? block.location,
      locationIds: [locationId],
      details: undefined,
    } satisfies ScheduleBlock;
  });
}

type Span = { start: number; end: number; absolute: boolean };

function blockSpan(block: ScheduleBlock): Span | null {
  if (block.startMs != null && block.endMs != null) {
    return { start: block.startMs, end: block.endMs, absolute: true };
  }
  const range = parseTimeRange(block.time);
  if (!range || range.endMin <= range.startMin) return null;
  return { start: range.startMin, end: range.endMin, absolute: false };
}

/**
 * Each round's place inside the parent, as a fraction of its span.
 *
 * Two forty-five minute rounds inside a hundred-and-five minute block are not
 * two fifty-two minute halves: there is a quarter of an hour between them, and
 * dividing the span evenly quietly invents a different schedule. The times at
 * the head of each detail line say where the rounds really sit.
 *
 * Returns null — meaning "divide evenly" — unless every line yields a range
 * that sits inside the parent and runs forwards.
 */
function writtenRoundFractions(
  block: ScheduleBlock,
  count: number,
): { from: number; to: number }[] | null {
  const parent = parseTimeRange(block.time);
  if (!parent || parent.endMin <= parent.startMin) return null;
  const total = parent.endMin - parent.startMin;
  // A round line writes "1:00 – 1:45" with no AM/PM; the parent knows which.
  const meridiem = block.time?.match(/(AM|PM)/i)?.[0] ?? "";

  const out: { from: number; to: number }[] = [];
  for (const line of block.details ?? []) {
    const head = line.split("—")[0];
    if (!head || head === line) return null;
    const text = /(AM|PM)/i.test(head) ? head : `${head.trim()} ${meridiem}`;
    const range = parseTimeRange(text);
    if (!range || range.endMin <= range.startMin) return null;
    const from = (range.startMin - parent.startMin) / total;
    const to = (range.endMin - parent.startMin) / total;
    if (from < -0.001 || to > 1.001 || to <= from) return null;
    out.push({ from, to });
  }
  return out.length === count ? out : null;
}

function sliceFraction(span: Span, f: { from: number; to: number }) {
  const total = span.end - span.start;
  return {
    start: Math.round(span.start + total * f.from),
    end: Math.round(span.start + total * f.to),
    absolute: span.absolute,
  };
}

function sliceSpan(span: Span, index: number, count: number) {
  const step = (span.end - span.start) / count;
  return {
    start: Math.round(span.start + step * index),
    end: Math.round(span.start + step * (index + 1)),
    absolute: span.absolute,
  };
}

function rewriteRange(start: number, end: number) {
  return `${stamp(start)} – ${stamp(end)}`;
}

function stamp(value: number) {
  // Absolute epoch times and minutes-from-midnight both reduce to a clock.
  const minutes = value > 24 * 60 ? minutesOfDay(new Date(value)) : value;
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = String(Math.round(minutes) % 60).padStart(2, "0");
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:${minute} ${meridiem}`;
}

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}
