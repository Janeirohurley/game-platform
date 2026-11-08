import { expect, test } from "bun:test";

import { freeSeats, rankQuickPlayCandidates } from "./quick-play";
import type { RoomListing } from "./types";

function listing(
  roomId: string,
  metadata?: Partial<NonNullable<RoomListing["metadata"]>>,
): RoomListing {
  if (!metadata) return { roomId };
  return {
    roomId,
    metadata: {
      gameId: "ludo",
      gameName: "Ludo",
      targetPlayers: 4,
      players: 1,
      maxPlayers: 6,
      spectators: 0,
      phase: "waiting",
      ...metadata,
    },
  };
}

test("a waiting table with room reports its free seats", () => {
  expect(freeSeats(listing("a", { targetPlayers: 4, players: 1 }))).toBe(3);
});

test("a table in the ready phase is still joinable", () => {
  expect(
    freeSeats(listing("a", { phase: "ready", targetPlayers: 4, players: 3 })),
  ).toBe(1);
});

test("a started match refuses a player, however many seats it shows", () => {
  // The seat count looks inviting; the server would answer 4010. Reading
  // only the counts is exactly the mistake this guards against.
  expect(
    freeSeats(listing("a", { phase: "playing", targetPlayers: 4, players: 1 })),
  ).toBeNull();
});

test("a finished match is not a destination", () => {
  expect(
    freeSeats(
      listing("a", { phase: "finished", targetPlayers: 4, players: 2 }),
    ),
  ).toBeNull();
});

test("a full table reports no seat", () => {
  expect(
    freeSeats(listing("a", { targetPlayers: 2, players: 2 })),
  ).toBeNull();
});

test("spectators never consume a player seat", () => {
  expect(
    freeSeats(listing("a", { targetPlayers: 2, players: 1, spectators: 9 })),
  ).toBe(1);
});

test("a listing without usable metadata is skipped, not guessed", () => {
  expect(freeSeats(listing("a"))).toBeNull();
  expect(freeSeats(listing("a", { targetPlayers: 0, maxPlayers: 0 }))).toBeNull();
});

test("the nearly-full table is offered first so a match can start", () => {
  const ranked = rankQuickPlayCandidates([
    listing("empty", { targetPlayers: 6, players: 1 }),
    listing("almost", { targetPlayers: 4, players: 3 }),
    listing("half", { targetPlayers: 4, players: 2 }),
  ]);

  expect(ranked.map((room) => room.roomId)).toEqual([
    "almost",
    "half",
    "empty",
  ]);
});

test("unjoinable tables are dropped from the ranking", () => {
  const ranked = rankQuickPlayCandidates([
    listing("running", { phase: "playing", targetPlayers: 4, players: 2 }),
    listing("full", { targetPlayers: 2, players: 2 }),
    listing("open", { targetPlayers: 2, players: 1 }),
  ]);

  expect(ranked.map((room) => room.roomId)).toEqual(["open"]);
});

test("equal tables keep a stable order between two polls", () => {
  const rooms = [
    listing("zzz", { targetPlayers: 4, players: 2 }),
    listing("aaa", { targetPlayers: 4, players: 2 }),
  ];

  expect(rankQuickPlayCandidates(rooms).map((room) => room.roomId)).toEqual([
    "aaa",
    "zzz",
  ]);
  // Same input in the other order must still rank the same way, or the
  // button would send two players polling at the same instant to
  // different tables.
  expect(
    rankQuickPlayCandidates([...rooms].reverse()).map((room) => room.roomId),
  ).toEqual(["aaa", "zzz"]);
});

test("no joinable table at all yields an empty ranking", () => {
  expect(
    rankQuickPlayCandidates([
      listing("running", { phase: "playing" }),
      listing("bare"),
    ]),
  ).toEqual([]);
});
