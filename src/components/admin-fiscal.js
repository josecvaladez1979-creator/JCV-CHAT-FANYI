(() => {
  "use strict";

  // El token vive solo en memoria: al recargar la página hay que volver a entrar.
  let token = null;

  const $ = (id) => document.getElementById(id);
  const money = (cents) =>
    (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  const when = (iso) =>
    new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

  function say(text, ok) {
    const el = $("msg");
    el.textContent = text || "";
    el.className = "msg " + (text ? (ok ? "ok" : "err") : "");
  }

  async function api(path, options) {
    const opts = options || {};
    const headers = Object.assign({}, opts.headers || {});
    if (token) headers.Authorization = "Bearer " + token;
    const res = await fetch(path, Object.assign({}, opts, { headers, credentials: "include" }));
    if (!res.ok) {
      let message = "Error " + res.status;
      try {
        const data = await res.json();
        if (data && data.error) message = data.error;
      } catch (_e) { /* sin cuerpo JSON */ }
      throw new Error(message);
    }
    return res;
  }

  // Todo se escribe con textContent: nunca con innerHTML (los nombres de
  // clientes son datos externos y podrían contener código).
  function fillTable(table, headers, rows, rowAction) {
    table.textContent = "";
    const head = table.createTHead().insertRow();
    headers.forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      head.appendChild(th);
    });
    const body = table.createTBody();
    rows.forEach((row) => {
      const tr = body.insertRow();
      row.cells.forEach((value) => {
        tr.insertCell().textContent = value === null || value === undefined ? "" : String(value);
      });
      if (rowAction) {
        const cell = tr.insertCell();
        const btn = rowAction(row.raw);
        if (btn) cell.appendChild(btn);
      }
    });
  }

  function renderSummary(s) {
    const box = $("summary");
    box.textContent = "";
    const lines = [
      ["Ventas cobradas", s.sales.count],
      ["Reembolsos", s.sales.refundsCount + " (" + money(s.sales.refundsCents) + ")"],
      ["Total cobrado (neto de reembolsos)", money(s.sales.totalCents)],
      ["Subtotal sin IVA", money(s.sales.netCents)],
      ["IVA", money(s.sales.ivaCents)],
      ["Comisiones de pasarela registradas", money(s.sales.gatewayFeesCents)],
      ["Ventas con factura pendiente", s.cfdiPending],
      ["Gastos registrados", s.expenses.count + " (" + money(s.expenses.totalCents) + ")"],
      ["IVA de gastos", money(s.expenses.ivaCents)],
    ];
    lines.forEach((pair) => {
      const p = document.createElement("div");
      p.textContent = pair[0] + ": " + pair[1];
      box.appendChild(p);
    });
  }

  function markInvoiced(sale) {
    if (sale.cfdiStatus === "ISSUED" || sale.cfdiStatus === "NOT_APPLICABLE") return null;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = "Factura emitida";
    btn.addEventListener("click", async () => {
      const uuid = window.prompt("UUID de la factura (CFDI):");
      if (!uuid) return;
      try {
        await api("/api/admin/fiscal/sales/" + encodeURIComponent(sale.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cfdiStatus: "ISSUED", cfdiUuid: uuid.trim() }),
        });
        say("Factura registrada.", true);
        load();
      } catch (e) { say(e.message, false); }
    });
    return btn;
  }

  async function load() {
    const month = $("month").value;
    if (!month) { say("Elige un mes.", false); return; }
    say("Cargando…", true);
    try {
      const q = "?month=" + encodeURIComponent(month);
      const [summary, sales, expenses] = await Promise.all([
        api("/api/admin/fiscal/summary" + q).then((r) => r.json()),
        api("/api/admin/fiscal/sales" + q).then((r) => r.json()),
        api("/api/admin/fiscal/expenses" + q).then((r) => r.json()),
      ]);
      renderSummary(summary);
      fillTable(
        $("sales"),
        ["Fecha", "Tipo", "Cliente", "Subtotal", "IVA", "Total", "Factura", ""],
        sales.sales.map((s) => ({
          raw: s,
          cells: [when(s.paidAt), s.kind, s.customerName || s.customerEmail || "", money(s.netCents), money(s.ivaCents), money(s.totalCents), s.cfdiStatus],
        })),
        markInvoiced
      );
      fillTable(
        $("expenses"),
        ["Fecha", "Proveedor", "Concepto", "Categoría", "Importe", "IVA", "Factura"],
        expenses.expenses.map((e) => ({
          cells: [when(e.spentAt), e.supplier, e.concept, e.category, money(e.amountMxnCents), money(e.ivaCents), e.hasCfdi ? "sí" : "no"],
        }))
      );
      say("", true);
    } catch (e) { say(e.message, false); }
  }

  async function loadAttention() {
    try {
      const data = await api("/api/admin/webhooks/attention").then((r) => r.json());
      fillTable(
        $("attention"),
        ["Fecha", "Pasarela", "Evento", "Tipo", "Motivo"],
        data.events.map((e) => ({
          cells: [when(e.createdAt), e.provider, e.eventId, e.type, (e.payload && e.payload.outcome) || ""],
        }))
      );
      say(data.events.length ? "Hay pagos por revisar." : "No hay pagos por revisar.", data.events.length === 0);
    } catch (e) { say(e.message, false); }
  }

  async function download(kind) {
    const month = $("month").value;
    if (!month) { say("Elige un mes.", false); return; }
    try {
      const res = await api("/api/admin/fiscal/" + kind + "?format=csv&month=" + encodeURIComponent(month));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = (kind === "sales" ? "ventas-" : "gastos-") + month + ".csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { say(e.message, false); }
  }

  $("loginBtn").addEventListener("click", async () => {
    say("Entrando…", true);
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: $("email").value, password: $("password").value }),
      });
      token = (await res.json()).accessToken;
      $("password").value = "";
      await api("/api/admin/fiscal/summary"); // falla con 403 si no es administrador
      $("login").hidden = true;
      $("main").hidden = false;
      const now = new Date();
      $("month").value = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
      say("", true);
      load();
    } catch (e) {
      token = null;
      say(e.message, false);
    }
  });

  $("loadBtn").addEventListener("click", load);
  $("salesCsv").addEventListener("click", () => download("sales"));
  $("expensesCsv").addEventListener("click", () => download("expenses"));
  $("attentionBtn").addEventListener("click", loadAttention);

  $("addExpense").addEventListener("click", async () => {
    try {
      await api("/api/admin/fiscal/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spentAt: $("eDate").value,
          supplier: $("eSupplier").value,
          concept: $("eConcept").value,
          category: $("eCategory").value,
          amountMxn: $("eAmount").value,
          ivaMxn: $("eIva").value,
          cfdiUuid: $("eUuid").value || undefined,
          hasCfdi: Boolean($("eUuid").value),
        }),
      });
      say("Gasto guardado.", true);
      ["eSupplier", "eConcept", "eAmount", "eIva", "eUuid"].forEach((id) => { $(id).value = ""; });
      load();
    } catch (e) { say(e.message, false); }
  });
})();
