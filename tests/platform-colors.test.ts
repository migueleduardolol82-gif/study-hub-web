import assert from "node:assert/strict";
import test from "node:test";
import { contrastRatio, readableColor } from "../lib/platform-colors.ts";

test("preserva uma cor legível escolhida pelo usuário", () => {
  assert.equal(readableColor("#ffffff", "#101820"), "#ffffff");
});

test("ajusta uma cor sem contraste até atingir o mínimo", () => {
  const foreground = readableColor("#395060", "#202b33");
  assert.ok(contrastRatio(foreground, "#202b33") >= 4.5);
  assert.notEqual(foreground, "#395060");
});

test("escurece o destaque em uma superfície clara", () => {
  const foreground = readableColor("#caff55", "#fbfaf7");
  assert.ok(contrastRatio(foreground, "#fbfaf7") >= 4.5);
});
