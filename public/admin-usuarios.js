(() => {
  "use strict";

  // El token vive solo en memoria: al recargar la página hay que volver a entrar.
  let token = null;

  const $ = (id) => document.getElementById(id);
  const when = (iso) =>
    new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
  const mb = (bytes) =>
    bytes === null || bytes === undefined ? "no disponible" : (bytes / 1048576).toFixed(2) + " MB";

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
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Error " + res.status);
    }
    return res;
  }

  function jsonPost(path, body) {
    return api(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // Siempre textContent: nada de lo que viene del servidor se pinta como HTML.
  function showStats(stats) {
    const list = $("stats");
    list.textContent = "";
    const lines = [
      "Mensajes en total: " + stats.total.toLocaleString("es-MX"),
      "Con más de 30 días: " + stats.older30.toLocaleString("es-MX"),
      "Con más de 90 días: " + stats.older90.toLocaleString("es-MX"),
      "Espacio que ocupan en la base de datos: " + mb(stats.bytes),
    ];
    for (const line of lines) {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    }
  }

  $("loginBtn").addEventListener("click", async () => {
    say("Entrando…", true);
    try {
      const res = await jsonPost("/api/auth/login", {
        email: $("email").value,
        password: $("password").value,
      });
      token = (await res.json()).accessToken;
      $("password").value = "";
      await api("/api/admin/messages/stats"); // falla con 403 si no es administrador
      $("login").hidden = true;
      $("main").hidden = false;
      say("", true);
    } catch (e) {
      token = null;
      say(e.message, false);
    }
  });

  $("linkBtn").addEventListener("click", async () => {
    say("Generando…", true);
    $("linkBox").hidden = true;
    try {
      const res = await jsonPost("/api/admin/users/recovery-link", { email: $("userEmail").value });
      const data = await res.json();
      $("link").value = data.link;
      $("linkInfo").textContent =
        "Cuenta: " + data.name + " (" + data.email + "). Vence el " + when(data.expiresAt) + ". Sirve una sola vez.";
      $("linkBox").hidden = false;
      say("Enlace generado. Envíalo al correo registrado de esa cuenta.", true);
    } catch (e) {
      say(e.message, false);
    }
  });

  $("copyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("link").value);
      say("Enlace copiado.", true);
    } catch (e) {
      $("link").select();
      say("No se pudo copiar solo: el enlace quedó seleccionado, cópialo a mano.", false);
    }
  });

  $("statsBtn").addEventListener("click", async () => {
    say("Consultando…", true);
    try {
      showStats(await (await api("/api/admin/messages/stats")).json());
      say("", true);
    } catch (e) {
      say(e.message, false);
    }
  });

  $("purgeBtn").addEventListener("click", async () => {
    const days = Number($("days").value);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      say("Escribe un número entero de días entre 1 y 3650.", false);
      return;
    }
    say("Contando…", true);
    try {
      const stats = await (await api("/api/admin/messages/stats?days=" + days)).json();
      showStats(stats);
      const count = stats.olderThanDays || 0;
      if (count === 0) {
        say("No hay mensajes con más de " + days + " días.", true);
        return;
      }
      const sure = window.confirm(
        "Se borrarán " + count.toLocaleString("es-MX") + " mensajes con más de " + days + " días. Es PERMANENTE. ¿Continuar?"
      );
      if (!sure) {
        say("Cancelado. No se borró nada.", true);
        return;
      }
      const result = await (await jsonPost("/api/admin/messages/purge", { days, confirm: true })).json();
      say(
        "Se borraron " + result.deleted.toLocaleString("es-MX") + " mensajes." +
          (result.capped ? " Quedan más: vuelve a pulsar Borrar." : ""),
        true
      );
      showStats(await (await api("/api/admin/messages/stats")).json());
    } catch (e) {
      say(e.message, false);
    }
  });
})();
