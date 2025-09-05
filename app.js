const STORAGE_KEY = "outgoingDocs"; // unified storage for both forwarded & received

/* ========= Storage & IDs ========= */
function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function saveDocs(docs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(docs)); }
function getDocsRaw() { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }

/* Migrate & normalize: ensure id, kind, date field */
function getDocs() {
  const arr = getDocsRaw();
  let changed = false;
  const out = arr.map(d => {
    const nd = { ...d };
    if (!nd.id) { nd.id = uid(); changed = true; }
    // If kind not set, assume old data = "forward"
    if (!nd.kind) {
      nd.kind = "forward";
      if (nd.dateForwarded && !nd.date) nd.date = nd.dateForwarded;
      changed = true;
    }
    if (!nd.date && nd.dateForwarded) { nd.date = nd.dateForwarded; changed = true; }
    return nd;
  });
  if (changed) saveDocs(out);
  return out;
}

/* ID helpers */
function genUniqueId(existingSet) {
  let id = uid();
  while (existingSet.has(id)) id = uid();
  return id;
}

/* Add record with collision-proof ID */
function addDoc(doc) {
  const docs = getDocs();
  const existingIds = new Set(docs.map(d => d.id));
  const safe = { ...doc, id: doc.id && !existingIds.has(doc.id) ? doc.id : genUniqueId(existingIds) };
  docs.push(safe);
  saveDocs(docs);
}

/* Update by exact ID */
function updateDoc(updated) {
  const docs = getDocs().map(d => (d.id === updated.id ? updated : d));
  saveDocs(docs);
}

/* Delete only ONE row by ID */
function deleteOneById(id) {
  const docs = getDocs();
  const idx = docs.findIndex(d => d.id === id);
  if (idx >= 0) {
    docs.splice(idx, 1);
    saveDocs(docs);
  }
}

/* ========= Elements ========= */
const btnForward = document.getElementById("btnForward");
const btnReceive = document.getElementById("btnReceive");
const btnTrack   = document.getElementById("btnTrack");

const forwardSection = document.getElementById("forwardSection");
const receiveSection = document.getElementById("receiveSection");
const trackSection   = document.getElementById("trackSection");

const forwardForm = document.getElementById("forwardForm");
const formMsg     = document.getElementById("formMsg");

const receiveForm = document.getElementById("receiveForm");
const receiveMsg  = document.getElementById("receiveMsg");

const searchDts     = document.getElementById("searchDts");
const searchDetails = document.getElementById("searchDetails");
const dateFrom      = document.getElementById("dateFrom");
const dateTo        = document.getElementById("dateTo");
const resultsTbody  = document.querySelector("#resultsTable tbody");
const thToOffice    = document.getElementById("thToOffice");
const thDate        = document.getElementById("thDate");

const toggleViewBtn = document.getElementById("toggleView");

const printBtn   = document.getElementById("printResults");
const exportBtn  = document.getElementById("exportBtn");
const exportSel  = document.getElementById("exportFormat");
const importCsv  = document.getElementById("importCsv");
const clearBtn   = document.getElementById("clearFilters");
const deleteSelectedBtn = document.getElementById("deleteSelected");
const selectAllCb = document.getElementById("selectAll");

/* Edit modal */
const editModal         = document.getElementById("editModal");
const closeEditBtn      = document.getElementById("closeEdit");
const cancelEditBtn     = document.getElementById("cancelEdit");
const editForm          = document.getElementById("editForm");
const editMsg           = document.getElementById("editMsg");
const editId            = document.getElementById("editId");
const editKind          = document.getElementById("editKind");
const editDtsNo         = document.getElementById("editDtsNo");
const editFromOffice    = document.getElementById("editFromOffice");
const editDetails       = document.getElementById("editDetails");
const editReceivedBy    = document.getElementById("editReceivedBy");
const editToOffice      = document.getElementById("editToOffice");
const editDate          = document.getElementById("editDate");
const labelToOffice     = document.getElementById("labelToOffice");
const labelDate         = document.getElementById("labelDate");

/* ========= Selection State ========= */
const selectedIds = new Set();
function updateBulkUI() {
  deleteSelectedBtn.disabled = selectedIds.size === 0;
  const visibleIds = Array.from(document.querySelectorAll('tbody tr')).map(tr => tr.dataset.id);
  if (visibleIds.length === 0) {
    selectAllCb.checked = false;
    selectAllCb.indeterminate = false;
    return;
  }
  const selectedCount = visibleIds.filter(id => selectedIds.has(id)).length;
  selectAllCb.checked = selectedCount === visibleIds.length;
  selectAllCb.indeterminate = selectedCount > 0 && selectedCount < visibleIds.length;
}

/* ========= View Mode (forward | received) ========= */
let currentView = "forward"; // default

function setView(kind) {
  currentView = kind;
  // Update toggle text and table headers
  if (currentView === "forward") {
    toggleViewBtn.textContent = "View Received Documents";
    thToOffice.textContent = "To/Office";
    thDate.textContent = "Date Forwarded";
  } else {
    toggleViewBtn.textContent = "View Forwarded Documents";
    thToOffice.textContent = "To/Office (—)";
    thDate.textContent = "Date Received";
  }
  // Clear selection when switching views
  selectedIds.clear();
  renderTable();
}

/* ========= Navigation ========= */
btnForward.addEventListener("click", () => {
  forwardSection.classList.remove("hidden");
  receiveSection.classList.add("hidden");
  trackSection.classList.add("hidden");
});
btnReceive.addEventListener("click", () => {
  forwardSection.classList.add("hidden");
  receiveSection.classList.remove("hidden");
  trackSection.classList.add("hidden");
});
btnTrack.addEventListener("click", () => {
  forwardSection.classList.add("hidden");
  receiveSection.classList.add("hidden");
  trackSection.classList.remove("hidden");
  setView("forward");
});

/* Toggle view within Track */
toggleViewBtn.addEventListener("click", () => {
  setView(currentView === "forward" ? "received" : "forward");
});

/* ========= Create (Forward) ========= */
forwardForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const record = {
    kind: "forward",
    id: uid(),
    dtsNo: document.getElementById("dtsNo").value,
    fromOffice: document.getElementById("fromOffice").value,
    details: document.getElementById("details").value,
    receivedBy: document.getElementById("receivedBy").value,
    toOffice: document.getElementById("toOffice").value,
    date: document.getElementById("dateForwarded").value, // generic date
  };

  addDoc(record);
  formMsg.textContent = "Forwarded document saved.";
  formMsg.style.color = "#0f766e";
  forwardForm.reset();
  document.getElementById("dateForwarded").value = new Date().toISOString().slice(0, 10);
});

/* ========= Create (Receive) =========
   NOTE: DTS field removed; dtsNo stored as empty string by default.
*/
receiveForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const record = {
    kind: "received",
    id: uid(),
    dtsNo: "", // no DTS from form
    fromOffice: document.getElementById("rxFromOffice").value,
    details: document.getElementById("rxDetails").value,
    receivedBy: document.getElementById("rxReceivedBy").value,
    toOffice: "", // not applicable
    date: document.getElementById("rxDate").value,
  };

  addDoc(record);
  receiveMsg.textContent = "Received document saved.";
  receiveMsg.style.color = "#0f766e";
  receiveForm.reset();
  document.getElementById("rxDate").value = new Date().toISOString().slice(0, 10);
});

/* ========= Read / Filter / Render ========= */
function matchesFilters(doc) {
  if (doc.kind !== currentView) return false;

  const dtsMatch = searchDts.value ? String(doc.dtsNo || "").toLowerCase().includes(searchDts.value.toLowerCase()) : true;
  const detailsMatch = searchDetails.value ? String(doc.details || "").toLowerCase().includes(searchDetails.value.toLowerCase()) : true;

  let dateMatch = true;
  const docDate = doc.date || "1970-01-01";
  if (dateFrom.value) dateMatch = new Date(docDate) >= new Date(dateFrom.value);
  if (dateTo.value)   dateMatch = dateMatch && new Date(docDate) <= new Date(dateTo.value);

  return dtsMatch && detailsMatch && dateMatch;
}

function getFilteredDocs() {
  return getDocs().filter(matchesFilters);
}

function renderTable() {
  const docs = getFilteredDocs();
  resultsTbody.innerHTML = "";

  if (docs.length === 0) {
    resultsTbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#666">No records found.</td></tr>`;
    updateBulkUI();
    return;
  }

  docs.forEach(doc => {
    const tr = document.createElement("tr");
    tr.dataset.id = doc.id;

    const isChecked = selectedIds.has(doc.id);

    tr.innerHTML = `
      <td class="no-print select-col">
        <input type="checkbox" class="row-check" ${isChecked ? "checked" : ""} aria-label="Select row">
      </td>
      <td>${escapeHTML(doc.dtsNo ?? "")}</td>
      <td>${escapeHTML(doc.fromOffice ?? "")}</td>
      <td>${escapeHTML(doc.details ?? "")}</td>
      <td>${escapeHTML(doc.receivedBy ?? "")}</td>
      <td>${escapeHTML(doc.toOffice ?? "")}</td>
      <td>${escapeHTML(doc.date ?? "")}</td>
      <td class="no-print">
        <button class="btn-ghost sm-btn edit-btn">Edit</button>
        <button class="btn-ghost sm-btn danger delete-btn">Delete</button>
      </td>
    `;
    resultsTbody.appendChild(tr);
  });

  updateBulkUI();
}

/* Escape for safe HTML injection */
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

/* Filters */
[searchDts, searchDetails, dateFrom, dateTo].forEach(el => el.addEventListener("input", renderTable));

clearBtn.addEventListener("click", () => {
  searchDts.value = "";
  searchDetails.value = "";
  dateFrom.value = "";
  dateTo.value = "";
  renderTable();
});

/* ========= Row interactions: Edit / Delete / Checkbox ========= */
resultsTbody.addEventListener("click", (e) => {
  const row = e.target.closest("tr");
  if (!row) return;
  const id = row.dataset.id;

  if (e.target.classList.contains("edit-btn")) {
    openEditModal(id);
    return;
  }
  if (e.target.classList.contains("delete-btn")) {
    handleDelete(id);
    return;
  }
  if (e.target.classList.contains("row-check")) {
    if (e.target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    updateBulkUI();
    return;
  }
});

/* Master select-all */
selectAllCb.addEventListener("change", () => {
  const visibleRows = document.querySelectorAll("#resultsTable tbody tr");
  visibleRows.forEach(tr => {
    const id = tr.dataset.id;
    const cb = tr.querySelector(".row-check");
    if (!cb) return;
    cb.checked = selectAllCb.checked;
    if (selectAllCb.checked) selectedIds.add(id);
    else selectedIds.delete(id);
  });
  updateBulkUI();
});

/* Bulk delete */
deleteSelectedBtn.addEventListener("click", () => {
  const ids = Array.from(selectedIds);
  if (ids.length === 0) return;

  const docs = getDocs();
  const preview = ids.slice(0, 5).map(id => {
    const d = docs.find(x => x.id === id);
    return `• ${d?.kind ?? "-"} | ${d?.dtsNo ?? "(DTS blank)"} — ${d?.details?.slice(0,60) ?? "(Details blank)"}`;
  }).join("\n");

  const more = ids.length > 5 ? `\n...and ${ids.length - 5} more.` : "";
  const ok = confirm(`Delete ${ids.length} selected record(s)?\n\n${preview}${more}\n\nThis only removes the selected IDs.`);
  if (!ok) return;

  ids.forEach(id => deleteOneById(id));
  selectedIds.clear();
  renderTable();
});

/* ========= Edit Modal ========= */
function openEditModal(id) {
  const doc = getDocs().find(d => d.id === id);
  if (!doc) return;

  editId.value = doc.id;
  editKind.value = doc.kind;
  editDtsNo.value = doc.dtsNo ?? "";
  editFromOffice.value = doc.fromOffice ?? "";
  editDetails.value = doc.details ?? "";
  editReceivedBy.value = doc.receivedBy ?? "";
  editToOffice.value = doc.toOffice ?? "";
  editDate.value = doc.date ?? "";

  // Adapt labels for received docs
  if (doc.kind === "received") {
    labelToOffice.style.display = "none";
    labelDate.firstChild.textContent = "Date Received";
  } else {
    labelToOffice.style.display = "";
    labelDate.firstChild.textContent = "Date Forwarded";
  }

  editMsg.textContent = "";
  editModal.classList.remove("hidden");
  setTimeout(() => editDtsNo.focus(), 0);
}
function closeEdit() { editModal.classList.add("hidden"); }
closeEditBtn.addEventListener("click", closeEdit);
cancelEditBtn.addEventListener("click", closeEdit);
editModal.querySelector(".modal-backdrop").addEventListener("click", closeEdit);

/* Save edits (minimal requirements, duplicates allowed) */
editForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const updated = {
    id: editId.value,
    kind: editKind.value || currentView,
    dtsNo: editDtsNo.value,
    fromOffice: editFromOffice.value,
    details: editDetails.value,
    receivedBy: editReceivedBy.value,
    toOffice: (editKind.value === "received") ? "" : editToOffice.value,
    date: editDate.value
  };

  updateDoc(updated);
  editMsg.textContent = "Changes saved.";
  editMsg.style.color = "#0f766e";

  setTimeout(() => { closeEdit(); renderTable(); }, 200);
});

/* Single delete via Actions column */
function handleDelete(id) {
  const docs = getDocs();
  const doc = docs.find(d => d.id === id);
  if (!doc) return;

  const sameDetailsCount = docs.filter(d =>
    d.kind === doc.kind &&
    (d.details ?? "") === (doc.details ?? "") &&
    d.id !== id
  ).length;

  const message = sameDetailsCount > 0
    ? `Delete this ${doc.kind} record only?\n\nDTS: ${doc.dtsNo ?? "(blank)"}\nDetails: ${doc.details ?? "(blank)"}\n\nNote: ${sameDetailsCount} other ${doc.kind} record(s) share the same details and WILL REMAIN.`
    : `Delete this ${doc.kind} record?\n\nDTS: ${doc.dtsNo ?? "(blank)"}\nDetails: ${doc.details ?? "(blank)"}`;

  if (!confirm(message)) return;

  deleteOneById(id);
  selectedIds.delete(id);
  renderTable();
}

/* ========= Export ========= */
exportBtn.addEventListener("click", () => {
  const fmt = exportSel.value;
  const data = getFilteredDocs();

  if (data.length === 0) {
    alert("No rows to export. Adjust your filters first.");
    return;
  }

  const filenameBase = `documents_${currentView}_${new Date().toISOString().slice(0,10)}`;

  if (fmt === "csv") return exportCSV(data, `${filenameBase}.csv`);
  if (fmt === "excel") return exportExcel(data, `${filenameBase}.xls`);
  if (fmt === "word") return exportWord(data, `${filenameBase}.doc`);
  if (fmt === "pdf") return exportPDF(data, `${filenameBase}.pdf`);
});

function exportCSV(rows, filename) {
  const header = ["id","kind","dtsNo","fromOffice","details","receivedBy","toOffice","date"];
  const escapeCell = (v) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  rows.forEach(r => {
    lines.push(header.map(k => escapeCell(r[k])).join(","));
  });
  const csv = lines.join("\r\n");
  downloadFile(filename, "text/csv;charset=utf-8", "\uFEFF" + csv);
}

function exportExcel(rows, filename) {
  const table = buildHTMLTable(rows, { border: 1 });
  const html =
`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Export</title></head>
<body>${table}</body>
</html>`;
  downloadFile(filename, "application/vnd.ms-excel", html);
}

function exportWord(rows, filename) {
  const table = buildHTMLTable(rows, { border: 1 });
  const html =
`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Export</title>
<style>
table{border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12pt}
th,td{border:1px solid #999;padding:6px;vertical-align:top}
th{background:#eee}
</style>
</head>
<body>${table}</body>
</html>`;
  downloadFile(filename, "application/msword", html);
}

function exportPDF(rows) {
  const pop = window.open("", "_blank", "width=900,height=700");
  const table = buildHTMLTable(rows, { border: 1 });
  const title = currentView === "forward" ? "Forwarded Documents" : "Received Documents";
  pop.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
body{font-family:Arial,sans-serif;font-size:12px}
h1{font-size:16px;margin:0 0 10px 0}
table{border-collapse:collapse;width:100%;table-layout:fixed}
th,td{border:1px solid #999;padding:6px;vertical-align:top;word-break:break-word}
th{background:#eee}
</style>
</head>
<body>
<h1>${title}</h1>
${table}
<script>window.onload = () => { setTimeout(() => { window.print(); }, 100); }<\/script>
</body></html>`);
  pop.document.close();
}

function buildHTMLTable(rows, opts = {}) {
  const border = opts.border ? ` border="${opts.border}"` : "";
  const headers = ["Kind","DTS Tracking No.","From/Office","Document Details","Received By","To/Office","Date","ID"];
  const cells = ["kind","dtsNo","fromOffice","details","receivedBy","toOffice","date","id"];
  const thead = `<thead><tr>${headers.map(h => `<th>${escapeHTML(h)}</th>`).join("")}</tr></thead>`;
  const tbody = `<tbody>${rows.map(r => `<tr>${
    cells.map(k => `<td>${escapeHTML(r[k] ?? "")}</td>`).join("")
  }</tr>`).join("")}</tbody>`;
  return `<table${border}>${thead}${tbody}</table>`;
}

function downloadFile(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}

/* ========= Import CSV ========= */
importCsv.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) throw new Error("Empty CSV");

    const header = rows[0].map(h => (h || "").toString().trim().toLowerCase());
    const idx = (name) => header.indexOf(name);

    const mapCol = {
      id: coalesceIndex(["id"]),
      kind: coalesceIndex(["kind","type"]),
      dtsNo: coalesceIndex(["dtsno","dts no","dts tracking no","tracking no","tracking"]),
      fromOffice: coalesceIndex(["fromoffice","from/office","from","office from"]),
      details: coalesceIndex(["details","document details","document","desc","description"]),
      receivedBy: coalesceIndex(["receivedby","received by"]),
      toOffice: coalesceIndex(["tooffice","to/office","to","office to"]),
      date: coalesceIndex(["date","dateforwarded","date forwarded","date received"])
    };

    function coalesceIndex(names) {
      for (const n of names) { const i = idx(n); if (i >= 0) return i; }
      return -1;
    }
    function val(row, i) { return i >= 0 ? (row[i] ?? "").toString() : ""; }

    const data = getDocs();
    const existingIds = new Set(data.map(d => d.id));

    let imported = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every(x => (x ?? "").trim() === "")) continue;

      let incomingId = val(row, mapCol.id) || "";
      if (!incomingId || existingIds.has(incomingId)) {
        incomingId = genUniqueId(existingIds);
      }
      existingIds.add(incomingId);

      const rec = {
        id: incomingId,
        kind: (val(row, mapCol.kind) || "forward").toLowerCase() === "received" ? "received" : "forward",
        dtsNo: val(row, mapCol.dtsNo),
        fromOffice: val(row, mapCol.fromOffice),
        details: val(row, mapCol.details),
        receivedBy: val(row, mapCol.receivedBy),
        toOffice: val(row, mapCol.toOffice),
        date: val(row, mapCol.date),
      };
      data.push(rec);
      imported++;
    }

    saveDocs(data);
    alert(`Imported ${imported} record(s).`);
    renderTable();
  } catch (err) {
    console.error(err);
    alert("Failed to import CSV. Please check the file format.");
  } finally {
    e.target.value = "";
  }
});

/* CSV parser */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cur); rows.push(row);
        row = []; cur = "";
      } else {
        cur += c;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

/* ========= Print ========= */
printBtn.addEventListener("click", () => window.print());
window.addEventListener("beforeprint", () => { renderTable(); document.body.classList.add("print-mode"); });
window.addEventListener("afterprint",  () => document.body.classList.remove("print-mode"));

/* ========= Init ========= */
btnForward.click();
document.getElementById("dateForwarded").value = new Date().toISOString().slice(0, 10);
document.getElementById("rxDate").value = new Date().toISOString().slice(0, 10);
