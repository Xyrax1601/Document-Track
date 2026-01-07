const STORAGE = "dtsDocs";
let selected = new Set();

function load() {
  return JSON.parse(localStorage.getItem(STORAGE) || "[]");
}
function save(data) {
  localStorage.setItem(STORAGE, JSON.stringify(data));
}

function show(section) {
  ["forwardSection","receiveSection","trackSection"].forEach(id =>
    document.getElementById(id).classList.add("hidden"));
  document.getElementById(section).classList.remove("hidden");
}

/* Navigation */
btnForward.onclick = () => show("forwardSection");
btnReceive.onclick = () => show("receiveSection");
btnTrack.onclick = () => { show("trackSection"); render(); };

/* Forward */
forwardForm.onsubmit = e => {
  e.preventDefault();
  const data = load();
  data.push({
    id: crypto.randomUUID(),
    kind: "forward",
    dts: dtsNo.value,
    from: fromOffice.value,
    details: details.value, // STORES LINE BREAKS
    received: receivedBy.value,
    to: toOffice.value,
    date: dateForwarded.value,
    important: false,
    accomplished: false
  });
  save(data);
  forwardForm.reset();
};

/* Render */
function render() {
  const data = load();
  const tbody = resultsTable.querySelector("tbody");
  tbody.innerHTML = "";

  data.forEach(d => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox"></td>
      <td>${d.dts}</td>
      <td>${d.from}</td>
      <td class="details-print">${escapeHTML(d.details)}</td>
      <td>${d.received}</td>
      <td>${d.to}</td>
      <td>${d.date}</td>
      <td><button onclick="printOne('${d.id}')">Print</button></td>
    `;
    tbody.appendChild(tr);
  });
}

/* PRINT */
function printOne(id) {
  const d = load().find(x => x.id === id);
  const w = window.open("");
  w.document.write(`
    <style>
      body{font-family:Arial;font-size:16px}
      table{width:100%;border-collapse:collapse}
      td,th{border:1px solid #000;padding:10px}
      .details{white-space:pre-wrap;}
    </style>
    <table>
      <tr><th>Document Details</th></tr>
      <tr><td class="details">${escapeHTML(d.details)}</td></tr>
    </table>
    <script>window.print()</script>
  `);
}

function escapeHTML(s){
  return s.replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  })[c]);
}

show("forwardSection");
