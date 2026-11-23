// roast-gadget-entry1 — One-Line Roast: The Gadget You Use Every Day
//
// A local tournament of one-line roasts. Fourteen original candidate lines,
// each roasting a gadget or app used every day, are scored against the judge
// brief in the competition rules: funniest first, freshest second, neatest
// third, with a concrete detail that sounds like one person's own gripe.
// Candidates are seeded by rubric score, play a single-elimination bracket,
// and the champion line is written to /output/entry.txt.
//
// The three obvious complaints named in the brief itself (a phone dying in
// the afternoon, an app begging for a rating before it opens, a smart kettle
// demanding a firmware update) are deliberately absent: the judge rewards a
// fresh angle, and a line repeating the brief's own examples is the least
// fresh line in the field. A banned-angle guard in the validator enforces
// that absence in code, so a future edit cannot quietly smuggle one of the
// brief's own examples back into the field.
//
// Every candidate carries its concrete detail in the open: the exact phrase
// that makes the gripe specific instead of generic. The validator checks
// that the detail phrase really appears in the line, which is the judge's
// fifth criterion turned into a gate. A final assertion checks the bracket
// crowned the true top seed, so a seeding slip cannot crown a weaker line.
//
// The pick is fully deterministic. No clock, no random source, no network,
// no input file: the same run on any machine writes the same bytes, so two
// runs produce byte-identical output.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUTPUT_PATH = "/output/entry.txt";
const MAX_CHARS = 200;

interface RoastCandidate {
  gadget: string;
  angle: string;
  detail: string;
  text: string;
  funny: number;
  fresh: number;
  neat: number;
}

interface ScoredRoast {
  candidate: RoastCandidate;
  total: number;
  length: number;
}

interface MatchLog {
  round: number;
  first: string;
  second: string;
  winner: string;
  margin: number;
}

// Rubric weights, in the judge brief's own order of importance: funniest
// counts most, freshest next, neatest third.
const FUNNY_WEIGHT = 5;
const FRESH_WEIGHT = 4;
const NEAT_WEIGHT = 3;

// Fragments of the brief's own example complaints. Any candidate carrying
// one of these is repeating the prompt instead of roasting, and the
// validator drops it before seeding.
const BANNED_ANGLES: string[] = [
  "dies at four", "four in the afternoon", "asks for a rating",
  "rating before", "firmware update", "smart kettle", "kettle",
  "battery dies", "dies at 4",
];

// Fourteen original candidates. Scores are 0-10 editorial marks on the
// judge's three criteria, set when the shortlist was drafted and frozen
// before the bracket runs. The angle names the joke's mechanism; the detail
// names the concrete phrase that grounds it.
const ROAST_SHORTLIST: RoastCandidate[] = [
  {
    gadget: "vacuum",
    angle: "role reversal",
    detail: "charger cable",
    text: "My robot vacuum ate my charger cable, then beeped for help like it was the victim.",
    funny: 9,
    fresh: 9,
    neat: 9,
  },
  {
    gadget: "watch",
    angle: "unearned praise",
    detail: "nine minutes",
    text: "My smartwatch congratulated me for standing up. I had been awake for nine minutes.",
    funny: 9,
    fresh: 8,
    neat: 9,
  },
  {
    gadget: "earbuds",
    angle: "perfect timing",
    detail: "battery low",
    text: "My earbuds announce 'battery low' the second someone important starts talking \u2014 the timing of a drama teacher.",
    funny: 8,
    fresh: 8,
    neat: 8,
  },
  {
    gadget: "printer",
    angle: "deadline sense",
    detail: "five minutes",
    text: "My printer only runs out of ink when the document is due in five minutes. It can smell deadlines.",
    funny: 8,
    fresh: 7,
    neat: 9,
  },
  {
    gadget: "microwave",
    angle: "passive aggression",
    detail: "beeps again",
    text: "My microwave beeps when it is done, then beeps again to punish me for ignoring it, like a passive-aggressive roommate.",
    funny: 8,
    fresh: 8,
    neat: 7,
  },
  {
    gadget: "remote",
    angle: "worn-out key",
    detail: "forty-seven buttons",
    text: "My TV remote has forty-seven buttons and the only one I ever need is the one worn completely blank.",
    funny: 7,
    fresh: 8,
    neat: 8,
  },
  {
    gadget: "fridge",
    angle: "blind helper",
    detail: "holding the milk",
    text: "My smart fridge texts me that we are out of milk while I am standing in front of it holding the milk.",
    funny: 8,
    fresh: 7,
    neat: 8,
  },
  {
    gadget: "phone",
    angle: "password ambush",
    detail: "password from 2019",
    text: "My phone unlocks for my face every morning except the one morning I actually need it, when it suddenly wants a password from 2019.",
    funny: 8,
    fresh: 7,
    neat: 7,
  },
  {
    gadget: "doorbell",
    angle: "silent witness",
    detail: "six grocery bags",
    text: "My doorbell camera films me wrestling six grocery bags through the door and has never once offered to help.",
    funny: 8,
    fresh: 8,
    neat: 8,
  },
  {
    gadget: "fryer",
    angle: "broken promise",
    detail: "smoke alarm",
    text: "My air fryer promised restaurant food and delivered a smoke alarm with extra steps.",
    funny: 8,
    fresh: 7,
    neat: 9,
  },
  {
    gadget: "speaker",
    angle: "selective hearing",
    detail: "goes deaf",
    text: "My smart speaker answers questions I never asked and goes deaf the moment I actually need it.",
    funny: 7,
    fresh: 7,
    neat: 8,
  },
  {
    gadget: "fan",
    angle: "jet engine",
    detail: "twelve rows",
    text: "My laptop fan sounds like a jet taking off every time I open a spreadsheet with more than twelve rows.",
    funny: 7,
    fresh: 7,
    neat: 8,
  },
  {
    gadget: "tracker",
    angle: "snack medal",
    detail: "walking to the fridge",
    text: "My fitness tracker gave me a badge for walking to the fridge, so my greatest athletic achievement is a snack.",
    funny: 8,
    fresh: 8,
    neat: 8,
  },
  {
    gadget: "phone",
    angle: "helpful intern",
    detail: "formal apology",
    text: "My phone autocorrects 'ok' into a formal apology and leaves my actual typos untouched, like a helpful intern with no supervision.",
    funny: 8,
    fresh: 7,
    neat: 8,
  },
];

// A candidate is valid when it is one single line of 1-200 characters, holds
// more than blank space, names its daily gadget in plain words, carries its
// declared concrete detail, and repeats none of the brief's own example
// angles, so the judge's first, third and fifth criteria are all met.
function validateRoast(candidate: RoastCandidate): string[] {
  const problems: string[] = [];
  const lowered = candidate.text.toLowerCase();
  const length = [...candidate.text].length;
  if (length < 1) {
    problems.push("empty line");
  }
  if (length > MAX_CHARS) {
    problems.push(`too long at ${length} characters`);
  }
  if (candidate.text.trim().length === 0) {
    problems.push("only white space");
  }
  if (candidate.text.includes("\n")) {
    problems.push("spans more than one line");
  }
  if (candidate.text.includes("\r")) {
    problems.push("carries a carriage return");
  }
  if (lowered.includes(candidate.gadget.toLowerCase()) === false) {
    problems.push(`never names its gadget (${candidate.gadget})`);
  }
  if (lowered.includes(candidate.detail.toLowerCase()) === false) {
    problems.push(`declared detail (${candidate.detail}) missing from the line`);
  }
  for (const banned of BANNED_ANGLES) {
    if (lowered.includes(banned)) {
      problems.push(`repeats a brief example angle (${banned})`);
    }
  }
  return problems;
}

// Weighted rubric total for one candidate.
function scoreRoast(candidate: RoastCandidate): ScoredRoast {
  const total =
    candidate.funny * FUNNY_WEIGHT +
    candidate.fresh * FRESH_WEIGHT +
    candidate.neat * NEAT_WEIGHT;
  return { candidate, total, length: [...candidate.text].length };
}

// Seed order: highest rubric total first, then the shorter line, then the
// alphabetically earlier line, so the bracket draw is fully determined.
function compareSeeds(first: ScoredRoast, second: ScoredRoast): number {
  if (first.total !== second.total) {
    return second.total - first.total;
  }
  if (first.length !== second.length) {
    return first.length - second.length;
  }
  if (first.candidate.text < second.candidate.text) {
    return -1;
  }
  return 1;
}

// One head-to-head match, judged the way the real judge weighs a pair:
// funniest first, freshest second, neatest third, with the rubric total
// carrying that order, and the shorter, tighter line winning a dead heat.
function playMatch(first: ScoredRoast, second: ScoredRoast, round: number, log: MatchLog[]): ScoredRoast {
  const margin = Math.abs(first.total - second.total);
  const winner = compareSeeds(first, second) <= 0 ? first : second;
  log.push({
    round,
    first: first.candidate.text,
    second: second.candidate.text,
    winner: winner.candidate.text,
    margin,
  });
  return winner;
}

// Single-elimination bracket. The top seed takes a bye when the field is
// odd, the rest pair top against bottom, and the survivors are re-seeded
// every round, so the two strongest lines can only meet in the final.
function runBracket(seeded: ScoredRoast[]): { champion: ScoredRoast; log: MatchLog[] } {
  const log: MatchLog[] = [];
  let field = [...seeded];
  let round = 1;
  while (field.length > 1) {
    const survivors: ScoredRoast[] = [];
    let startIndex = 0;
    if (field.length % 2 === 1) {
      survivors.push(field[0]);
      startIndex = 1;
    }
    let low = startIndex;
    let high = field.length - 1;
    while (low < high) {
      survivors.push(playMatch(field[low], field[high], round, log));
      low += 1;
      high -= 1;
    }
    survivors.sort(compareSeeds);
    field = survivors;
    round += 1;
  }
  return { champion: field[0], log };
}

function main(): void {
  const valid: ScoredRoast[] = [];
  for (const candidate of ROAST_SHORTLIST) {
    const problems = validateRoast(candidate);
    if (problems.length > 0) {
      console.log(`[drop] ${candidate.gadget}: ${problems.join("; ")}`);
    }
    if (problems.length === 0) {
      valid.push(scoreRoast(candidate));
    }
  }
  if (valid.length < 2) {
    throw new Error(`tournament needs at least 2 valid roasts, found ${valid.length}`);
  }
  valid.sort(compareSeeds);
  console.log(`[seed] ${valid.length} valid roasts, top seed ${valid[0].total} points`);
  const { champion, log } = runBracket(valid);
  if (champion.total !== valid[0].total) {
    throw new Error(`bracket crowned ${champion.total} pts over top seed ${valid[0].total} pts`);
  }
  for (const match of log) {
    console.log(`[round ${match.round}] ${match.winner.slice(0, 48)}... beats (${match.margin} pts)`);
  }
  console.log("[top3]");
  for (let rank = 0; rank < 3; rank += 1) {
    const placed = valid[rank];
    console.log(`  #${rank + 1} ${placed.total} pts (${placed.length} chars): ${placed.candidate.text}`);
  }
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, champion.candidate.text, "utf8");
  const written = readFileSync(OUTPUT_PATH, "utf8");
  if (written !== champion.candidate.text) {
    throw new Error("round trip mismatch: entry.txt differs from the champion");
  }
  const championLength = [...champion.candidate.text].length;
  console.log(`[champion] ${champion.total} pts, ${championLength} chars, gadget: ${champion.candidate.gadget}, angle: ${champion.candidate.angle}`);
  console.log(`[entry] ${champion.candidate.text}`);
}

main();
