import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMetricWidgets, widgetFromPrompt } from "../lib/home-metric-widgets.ts";

test("criação interpreta o estilo pedido sem inventar o valor do indicador", () => {
  const widget = widgetFromPrompt('Mostre estudo em barras, largo, chamado "Meu ritmo"', "study", "", "sm", "number");
  assert.equal(widget.indicator, "study");
  assert.equal(widget.title, "Meu ritmo");
  assert.equal(widget.view, "bars");
  assert.equal(widget.size, "wide");
});

test("widgets salvos descartam dados inválidos e preservam ordem, tamanho e indicador", () => {
  const valid = { id: "metric-1", indicator: "xp", title: " XP ", size: "lg", view: "progress", prompt: "grande" };
  assert.deepEqual(normalizeMetricWidgets([valid, { ...valid, title: "duplicado" }, { ...valid, id: "metric-2", indicator: "inexistente" }]), [
    { ...valid, title: "XP" },
  ]);
  assert.deepEqual(normalizeMetricWidgets(null), []);
});
