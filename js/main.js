// Inicialização do painel e conexão dos controles.

function showError(message) {
  document.getElementById("loading").hidden = true;
  document.getElementById("tableWrap").hidden = true;
  const box = document.getElementById("errorBox");
  box.hidden = false;
  box.textContent = message;
}

function setRows(rows) {
  state.originalRows = rows;
  state.rows = rows.map(r => ({ ...r }));
  populateFilters();
  state.pricingRule = false;
  state.sortKey = null;
  state.sortDirection = 1;
  applyFilters();
}

async function handleFileInput(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;

  document.getElementById("loading").hidden = false;
  document.getElementById("tableWrap").hidden = true;

  try {
    setRows(await loadWorkbookFile(file));
  } catch (error) {
    showError(error.message);
  }

  input.value = "";
}

async function init() {
  document.getElementById("loading").hidden = false;

  try {
    setRows(await loadDefaultWorkbook());
  } catch (error) {
    showError(error.message);
  }

  ["fileInput", "fileInputGroups"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", handleFileInput);
  });

  [
    "dateFrom", "dateTo", "store", "segment", "status", "category", "group",
    "daysMin", "daysMax", "discount", "promoPrice"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      state.pricingRule = false;
      const btn = document.getElementById("pricingRule");
      if (btn) btn.classList.remove("active");
      applyFilters();
    });
  });

  const search = document.getElementById("search");
  if (search) search.addEventListener("input", debounce(() => applyFilters(), 180));

  document.getElementById("clearFilters").addEventListener("click", clearFilters);
  document.getElementById("pricingRule").addEventListener("click", togglePricingRule);
  document.getElementById("restoreBtn").addEventListener("click", restoreOriginals);
  document.getElementById("exportXlsx").addEventListener("click", exportXlsx);
  document.getElementById("exportCsv").addEventListener("click", exportCsv);

  document.getElementById("prevPage").addEventListener("click", () => {
    if (state.currentPage > 1) { state.currentPage--; renderTable(); }
  });
  document.getElementById("nextPage").addEventListener("click", () => {
    const pages = Math.ceil(state.filteredRows.length / CONFIG.PAGE_SIZE);
    if (state.currentPage < pages) { state.currentPage++; renderTable(); }
  });

  initViewToggle();
  
  // Inicia sincronização com Google Sheets
  iniciarSync();
}

document.addEventListener("DOMContentLoaded", init);