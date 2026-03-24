const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.urlencoded({ extended: true }));

function cargarArchivo(nombre) {
  try {
    return JSON.parse(fs.readFileSync(nombre));
  } catch {
    return [];
  }
}

function guardarArchivo(nombre, data) {
  fs.writeFileSync(nombre, JSON.stringify(data, null, 2));
}

let gastos = cargarArchivo("gastos.json");
let ingresos = cargarArchivo("ingresos.json");

// ====== LAYOUT ======
function layout(titulo, contenido, script = "") {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${titulo}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <style>
      body { font-family: Arial; background:#f4f6f8; padding:20px; margin:0; }
      nav { background:white; padding:10px; margin-bottom:20px; display:flex; gap:10px; }
      nav a { text-decoration:none; font-weight:bold; }

      .card {
        background:white;
        padding:15px;
        margin-bottom:15px;
        border-radius:10px;
      }

      input, select, button {
        padding:6px;
        margin:5px;
      }

      button { background:green; color:white; border:none; }
      .delete { background:red; }

      li {
        display:flex;
        justify-content:space-between;
        margin:5px 0;
      }
    </style>
  </head>

  <body>
    <nav>
      <a href="/">Dashboard</a>
      <a href="/ingresos">Ingresos</a>
      <a href="/egresos">Egresos</a>
    </nav>

    ${contenido}

    ${script}

  </body>
  </html>
  `;
}

// ===== DASHBOARD =====
app.get("/", (req, res) => {
  const totalIngresos = ingresos.reduce((s, i) => s + i.usd, 0);
  const totalEgresos = gastos.reduce((s, g) => s + g.usd, 0);

  const real = gastos
    .filter(g => g.categoria !== "Transf.USDT/BS")
    .reduce((s, g) => s + g.usd, 0);

  const balance = totalIngresos - real;

  let resumen = {};
  gastos.forEach(g => {
    if (!resumen[g.categoria]) resumen[g.categoria] = 0;
    resumen[g.categoria] += g.usd;
  });

  const categorias = Object.keys(resumen);
  const valores = Object.values(resumen);

  const contenido = `
    <h1>📊 Dashboard</h1>

    <div class="card">
      <p>Ingresos: ${totalIngresos.toFixed(2)} USD</p>
      <p>Egresos: ${totalEgresos.toFixed(2)} USD</p>
      <p>Real: ${real.toFixed(2)} USD</p>
      <p><strong>Balance: ${balance.toFixed(2)} USD</strong></p>
    </div>

    <div class="card">
      <h3>Gráfico</h3>
     <div style="max-width: 400px; height: 400px; margin: auto;">
  <canvas id="grafico"></canvas>
</div>
  `;

  const script = `
    <script>
      const ctx = document.getElementById('grafico');

      new Chart(ctx, {
  type: 'pie',
  data: {
    labels: ${JSON.stringify(categorias)},
    datasets: [{
      data: ${JSON.stringify(valores)}
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false
  }
});
    </script>
  `;

  res.send(layout("Dashboard", contenido, script));
});

// ===== INGRESOS =====
app.get("/ingresos", (req, res) => {
  const lista = ingresos.map((i, index) => `
    <li>
      ${i.descripcion} — ${i.usd} USD
      <form method="POST" action="/ingresos/eliminar">
        <input type="hidden" name="index" value="${index}">
        <button class="delete">X</button>
      </form>
    </li>
  `).join("");

  res.send(layout("Ingresos", `
    <h1>Ingresos</h1>

    <form method="POST" action="/ingresos">
      <input name="descripcion" required placeholder="Descripción">
      <input name="monto" type="number" required>
      <select name="moneda">
        <option>USDT</option>
        <option>BTC</option>
      </select>
      <input name="tasa" placeholder="tasa BTC">
      <button>Guardar</button>
    </form>

    <ul>${lista}</ul>
  `));
});

app.post("/ingresos", (req, res) => {
  let { descripcion, monto, moneda, tasa } = req.body;

  monto = parseFloat(monto);
  tasa = parseFloat(tasa);

  let usd = moneda === "USDT" ? monto : monto * tasa;

  ingresos.push({ descripcion, monto, moneda, tasa, usd });
  guardarArchivo("ingresos.json", ingresos);

  res.redirect("/ingresos");
});

app.post("/ingresos/eliminar", (req, res) => {
  ingresos.splice(req.body.index, 1);
  guardarArchivo("ingresos.json", ingresos);
  res.redirect("/ingresos");
});

// ===== EGRESOS =====
app.get("/egresos", (req, res) => {
  const lista = gastos.map((g, index) => `
    <li>
      ${g.descripcion} — ${g.usd} USD
      <form method="POST" action="/egresos/eliminar">
        <input type="hidden" name="index" value="${index}">
        <button class="delete">X</button>
      </form>
    </li>
  `).join("");

  res.send(layout("Egresos", `
    <h1>Egresos</h1>

    <form method="POST" action="/egresos">
      <input name="descripcion" required placeholder="Descripción">
      <input name="monto" type="number" required>
      <select name="moneda">
        <option>USDT</option>
        <option>BS</option>
      </select>
      <input name="tasa" placeholder="tasa BS">
      <button>Guardar</button>
    </form>

    <ul>${lista}</ul>
  `));
});

app.post("/egresos", (req, res) => {
  let { descripcion, monto, moneda, tasa } = req.body;

  monto = parseFloat(monto);
  tasa = parseFloat(tasa);

  let usd = moneda === "USDT" ? monto : monto / tasa;

  gastos.push({ descripcion, monto, moneda, tasa, usd });
  guardarArchivo("gastos.json", gastos);

  res.redirect("/egresos");
});

app.post("/egresos/eliminar", (req, res) => {
  gastos.splice(req.body.index, 1);
  guardarArchivo("gastos.json", gastos);
  res.redirect("/egresos");
});

app.listen(3000, () => {
  console.log("http://localhost:3000");
});