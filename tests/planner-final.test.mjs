import test from "node:test";
import assert from "node:assert/strict";
import {
  newOperation,
  evaluateAlerts,
  isPlannerPlan,
  dashboardOrders,
  canScheduleNext,
  markManualEdit,
} from "../public/js/operations.js";
import {
  plansFromForm,
  ensureOccurrences,
  refreshVisitFromPlan,
  validIso,
  regeneratePlan,
} from "../public/js/planner.js";
import { writeNewVisits } from "../public/js/planner-ui.js";
const eqs = new Set(["e1"]),
  equipment = [
    {
      id: "e1",
      companyId: "c1",
      tag: "E1",
      name: "Equipo",
      customerId: "",
      siteId: "",
    },
  ];
const plan = (o = {}) => ({
  ...newOperation("workOrders", "c1"),
  id: "p1",
  name: "Plan",
  type: "Plan de mantenimiento",
  anchorDate: "2026-01-01",
  dueDate: "2026-01-01",
  planState: "Activo",
  intervalDays: "30",
  equipmentId: "e1",
  ...o,
});
const visit = (o = {}) => ({
  ...newOperation("workOrders", "c1"),
  id: "v1",
  name: "Plan",
  planId: "p1",
  status: "Planificada",
  dueDate: "2026-03-01",
  ownerId: "u1",
  owner: "Ana",
  ...o,
});

test("I1: un plan del planner no genera «Acción vencida»; uno heredado sí", () => {
  const [p] = plansFromForm(
    {
      name: "Plan",
      equipmentIds: ["e1"],
      anchorDate: "2026-01-01",
      intervalDays: "30",
    },
    equipment,
    "c1",
  );
  const legacy = {
    ...newOperation("workOrders", "c1"),
    id: "l1",
    name: "Heredado",
    type: "Plan de mantenimiento",
    dueDate: "2026-01-05",
    intervalDays: "30",
  };
  assert.equal(isPlannerPlan(p), true);
  assert.equal(isPlannerPlan(legacy), false);
  const alerts = evaluateAlerts(
    [],
    dashboardOrders([p, { ...p, planState: "Cerrado" }, legacy]).map((w) => ({
      ...w,
    })),
    [],
    "2026-06-01",
  );
  assert.deepEqual(
    alerts.map((a) => a.title),
    ["Acción vencida: Heredado"],
  );
  assert.equal(dashboardOrders([p, legacy]).length, 1);
});
test("I2: «Programar siguiente» solo en órdenes heredadas", () => {
  assert.equal(canScheduleNext(plan()), false);
  assert.equal(canScheduleNext(visit({ intervalDays: "30" })), false);
  assert.equal(
    canScheduleNext({
      ...newOperation("workOrders", "c1"),
      type: "Plan de mantenimiento",
      intervalDays: "30",
      dueDate: "2026-01-05",
    }),
    true,
  );
  assert.equal(
    canScheduleNext({ ...newOperation("workOrders", "c1"), intervalDays: "" }),
    false,
  );
});
function fakeDb(store) {
  const saved = [];
  return {
    saved,
    get: async (k, id) => store[id] ?? null,
    saveEntity: async (k, r) => {
      saved.push(r);
      store[r.id] = r;
    },
  };
}
test("I3: writeNewVisits omite archivadas y existentes y cuenta solo lo escrito", async () => {
  const rows = [
    visit({ id: "a" }),
    visit({ id: "b" }),
    visit({ id: "c" }),
    visit({ id: "d" }),
  ];
  const db = fakeDb({
    a: { ...visit({ id: "a" }), _sync: { deleted: true } },
    b: { ...visit({ id: "b" }), _sync: { v: 1 } },
    c: {
      ...visit({ id: "c" }),
      status: "Cancelada",
      closedReason: "calendario corrido",
      createdAt: "2020-01-01T00:00:00.000Z",
      _sync: { v: 2 },
    },
  });
  const n = await writeNewVisits(db, rows);
  assert.equal(n, 2);
  assert.deepEqual(db.saved.map((r) => r.id).sort(), ["c", "d"]);
  const c = db.saved.find((r) => r.id === "c");
  assert.equal(c.createdAt, "2020-01-01T00:00:00.000Z");
  assert.deepEqual(c._sync, { v: 2 });
  assert.equal(await writeNewVisits(db, rows), 0);
});
test("I4: markManualEdit marca cambios de fecha o responsable en visitas", () => {
  const b = visit();
  assert.equal(
    markManualEdit(b, { ...b, dueDate: "2026-03-02" }).manualEdit,
    "1",
  );
  assert.equal(markManualEdit(b, { ...b, ownerId: "u2" }).manualEdit, "1");
  assert.equal(markManualEdit(b, { ...b, owner: "Luis" }).manualEdit, "1");
  const same = markManualEdit(b, { ...b, notes: "x" });
  assert.equal(same.manualEdit, "");
  const o = { ...b, planId: "" };
  assert.equal(
    markManualEdit(o, { ...o, dueDate: "2026-04-01" }).manualEdit,
    "",
  );
  assert.equal(markManualEdit(null, b), b);
});
test("I5: refreshVisitFromPlan copia técnico y plantilla, respeta manual, En curso y pasadas", () => {
  const p = plan({
      ownerId: "u2",
      owner: "Luis",
      scope: "Nuevo",
      reportTemplate: "generator",
    }),
    today = "2026-02-15";
  const r = refreshVisitFromPlan(p, visit(), today);
  assert.equal(r.ownerId, "u2");
  assert.equal(r.owner, "Luis");
  assert.equal(r.scope, "Nuevo");
  assert.equal(r.reportTemplate, "generator");
  assert.equal(r.dueDate, "2026-03-01");
  assert.equal(
    refreshVisitFromPlan(p, visit({ manualEdit: "1" }), today),
    null,
  );
  assert.equal(
    refreshVisitFromPlan(p, visit({ status: "En curso" }), today),
    null,
  );
  assert.equal(
    refreshVisitFromPlan(p, visit({ dueDate: "2026-02-01" }), today),
    null,
  );
  assert.equal(refreshVisitFromPlan(p, r, today), null);
});
test("I5: la visita revivida toma los valores actuales del plan", () => {
  const p = plan({ ownerId: "u2", owner: "Luis" }),
    today = "2026-02-15",
    old = visit({
      id: "visit-p1-20260302",
      dueDate: "2026-03-02",
      status: "Cancelada",
      closedReason: "calendario corrido",
    });
  const out = ensureOccurrences(p, [old], today, eqs).find(
    (v) => v.id === old.id,
  );
  assert.equal(out.status, "Planificada");
  assert.equal(out.ownerId, "u2");
  assert.equal(out.owner, "Luis");
});
test("T2: hoy inválido u horizonte no finito devuelven []", () => {
  assert.deepEqual(ensureOccurrences(plan(), [], "2026-02-30", eqs), []);
  assert.deepEqual(ensureOccurrences(plan(), [], "", eqs), []);
  assert.deepEqual(ensureOccurrences(plan(), [], "2026-02-15", eqs, NaN), []);
  assert.ok(ensureOccurrences(plan(), [], "2026-02-15", eqs).length > 0);
});
test("M3: validIso rechaza fechas inexistentes", () => {
  assert.equal(validIso("2026-02-30"), false);
  assert.equal(validIso("2026-02-28"), true);
  assert.equal(validIso(""), false);
});
