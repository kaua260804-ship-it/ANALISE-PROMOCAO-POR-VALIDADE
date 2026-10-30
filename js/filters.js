// ============================================================
// Preenche filtros com valores existentes e aplica todos os
// critérios selecionados. Ao final, chama renderCurrentView()
// para atualizar a view ativa (tabela plana OU agrupada).
// ============================================================

const FILTER_IDS = {
  store: "LOJA",
  segment: "SEGMENTO",
  category: "CATEGORIA.SIST",
  group: "GRUPO"
};

// ------------------------------------------------------------
// Popula um <select> com valores únicos de uma coluna.
// Preserva o valor atual se ele ainda existir.
// ------------------------------------------------------------
function populateSelect(id, key, allLabel) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = el.value;
  el.innerHTML =
    `<option value="">${escapeHtml(allLabel)}</option>` +
    uniqueValues(state.rows, key)
      .map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)
      .join("");
  if ([...el.options].some(o => o.value === current)) el.value = current;
}

// ------------------------------------------------------------
// Popula os selects baseados em colunas.
// ------------------------------------------------------------
function populateFilters() {
  populateSelect("store", "LOJA", "Todas");
  populateSelect("segment", "SEGMENTO", "Todos");
  populateSelect("category", "CATEGORIA.SIST", "Todas");
  populateSelect("group", "GRUPO", "Todos");
}

// ------------------------------------------------------------
// Aplica todos os filtros e atualiza a view ativa.
// ------------------------------------------------------------
function applyFilters() {
  const val = id => {
    const el = document.getElementById(id);
    return el ? el.value : "";
  };

  const from = val("dateFrom");
  const to = val("dateTo");
  const store = val("store");
  const segment = val("segment");
  const status = val("status");
  const category = val("category");
  const group = val("group");
  const min = val("daysMin");
  const max = val("daysMax");
  const discount = val("discount");
  const promo = val("promoPrice");
  const query = val("search").toLocaleLowerCase("pt-BR");

  state.filteredRows = state.rows.filter(row => {
    const date = dateInputValue(row.DATA);
    const days = parseNumber(row["DIAS P/ VENCIMENTO"]);
    const desc = parsePercent(row["%DESC"]);
    const price = parseNumber(row["PRECO.PROM"]);

    // Data
    if (from && (!date || date < from)) return false;
    if (to && (!date || date > to)) return false;

    // Selects
    if (store && normalizeText(row.LOJA) !== store) return false;
    if (segment && normalizeText(row.SEGMENTO) !== segment) return false;
    if (status && normalizeText(row.STATUS).toUpperCase() !== status) return false;
    if (category && normalizeText(row["CATEGORIA.SIST"]) !== category) return false;
    if (group && normalizeText(row.GRUPO) !== group) return false;

    // Dias para vencer
    if (min !== "" && (days === null || days < Number(min))) return false;
    if (max !== "" && (days === null || days > Number(max))) return false;

    // %DESC
    if (discount === "zero" && desc !== 0) return false;
    if (discount === "nonzero" && (desc === null || desc === 0)) return false;

    // PRECO.PROM
    if (promo === "zero" && price !== 0) return false;
    if (promo === "positive" && (price === null || price <= 0)) return false;

    // Busca livre (descrição + código)
    if (query) {
      const hay = `${normalizeText(row["DESCRIÇÃO DOS PRODUTOS"])} ${normalizeText(row.CODIGO)}`
        .toLocaleLowerCase("pt-BR");
      if (!hay.includes(query)) return false;
    }

    // Regra de precificação (botão "Regra de Precificação")
    if (state.pricingRule) {
      // Precisa estar no critério de "a precificar":
      // PRECO.PROM = 0 E %DESC diferente de 0%
      if (!(price === 0 && desc !== null && desc !== 0)) return false;
    }

    return true;
  });

  state.currentPage = 1;
  renderCurrentView();   // ← atualiza tabela plana OU agrupada
}

// ------------------------------------------------------------
// Limpa todos os filtros e desativa a regra de precificação.
// ------------------------------------------------------------
function clearFilters() {
  [
    "dateFrom", "dateTo", "store", "segment", "status",
    "category", "group", "daysMin", "daysMax",
    "discount", "promoPrice", "search"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  state.pricingRule = false;
  const btn = document.getElementById("pricingRule");
  if (btn) btn.classList.remove("active");

  applyFilters();
}

// ------------------------------------------------------------
// Alterna o filtro "Regra de Precificação":
//   mantém somente itens com PRECO.PROM = 0 E %DESC ≠ 0%
// ------------------------------------------------------------
function togglePricingRule() {
  state.pricingRule = !state.pricingRule;
  const btn = document.getElementById("pricingRule");
  if (btn) btn.classList.toggle("active", state.pricingRule);
  applyFilters();
}