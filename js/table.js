// ============================================================
// Renderização, ordenação e paginação da tabela plana.
// Depende de: utils.js (parseNumber, normalizeText, formatMoney,
// dateInputValue, formatDate, escapeHtml, getEditedValue,
// isEdited, storageKey), config.js (CONFIG, state),
// editableCells.js (startCellEdit, isEdited).
// ============================================================

function displayValue(row, col) {
  const value = getEditedValue(row, col);
  if (col === "DATA") return formatDate(value);
  if (["PRECO.SIST", "PRC.ARRED", "PRECO.PROM", "PREC.DESC", "CUSTO", "MARGEM"].includes(col)) {
    return value === "" ? "" : formatMoney(value);
  }
  if (col === "%DESC" || col === "PERC%") {
    return value === "" ? "" : `${normalizeText(value).replace("%", "")}%`;
  }
  return normalizeText(value);
}

function renderTable() {
  const total = state.filteredRows.length;
  const pages = Math.max(1, Math.ceil(total / CONFIG.PAGE_SIZE));
  state.currentPage = Math.min(state.currentPage, pages);

  const sorted = [...state.filteredRows];
  if (state.sortKey) {
    const key = state.sortKey;
    const dir = state.sortDirection;
    sorted.sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (key === "DATA") {
        av = parseDate(av)?.getTime() ?? 0;
        bv = parseDate(bv)?.getTime() ?? 0;
      } else if (
        ["DIAS P/ VENCIMENTO", "QTD.SIST", "QTD.VENC", "PRECO.SIST",
         "PRC.ARRED", "PRECO.PROM", "%DESC"].includes(key)
      ) {
        av = parseNumber(av) ?? -Infinity;
        bv = parseNumber(bv) ?? -Infinity;
      } else {
        av = normalizeText(av).toLocaleLowerCase("pt-BR");
        bv = normalizeText(bv).toLocaleLowerCase("pt-BR");
      }
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
    });
  }

  const start = (state.currentPage - 1) * CONFIG.PAGE_SIZE;
  const pageRows = sorted.slice(start, start + CONFIG.PAGE_SIZE);

  const head = document.getElementById("tableHead");
  const body = document.getElementById("tableBody");

  head.innerHTML = `<tr>${CONFIG.COLUMNS.map(col => {
    const sticky =
      col === "CODIGO" ? "sticky-code" :
      col === "DESCRIÇÃO DOS PRODUTOS" ? "sticky-description" : "";
    const icon =
      state.sortKey === col
        ? (state.sortDirection === 1 ? "fa-sort-up" : "fa-sort-down")
        : "fa-sort";
    return `<th data-key="${escapeHtml(col)}" class="${sticky}">
              ${escapeHtml(col)}<i class="fa-solid ${icon} sort-icon"></i>
            </th>`;
  }).join("")}</tr>`;

  body.innerHTML = pageRows.length
    ? pageRows.map(row => {
        const days = parseNumber(row["DIAS P/ VENCIMENTO"]);
        const rowClass =
          days !== null && days < 7 ? "urgent" :
          days !== null && days <= 30 ? "warning" : "";

        return `<tr class="${rowClass}">${CONFIG.COLUMNS.map(col => {
          const sticky =
            col === "CODIGO" ? "sticky-code" :
            col === "DESCRIÇÃO DOS PRODUTOS" ? "sticky-description" : "";

          if (CONFIG.EDITABLE_FIELDS.includes(col)) {
            const edited = isEdited(row, col);
            const value = displayValue(row, col);
            return `<td class="editable-cell ${sticky}"
                       data-edit="${escapeHtml(col)}"
                       data-row="${row._id}">
                      ${escapeHtml(value)}${edited ? '<i class="fa-solid fa-pen edited-icon" title="Valor editado localmente"></i>' : ""}
                    </td>`;
          }

          if (col === "STATUS") {
            const status = normalizeText(row[col]);
            const cls =
              status.toUpperCase() === "PENDENTE" ? "status-pendente" :
              status.toUpperCase() === "FEITO" ? "status-feito" : "status-other";
            return `<td class="${sticky}"><span class="status-badge ${cls}">${escapeHtml(status || "—")}</span></td>`;
          }

          if (col === "QTD.SIST" && parseNumber(row[col]) !== null && parseNumber(row[col]) < 0) {
            return `<td class="${sticky} negative">
                      <i class="fa-solid fa-triangle-exclamation warning-icon" title="Quantidade negativa"></i>
                      ${escapeHtml(displayValue(row, col))}
                    </td>`;
          }

          return `<td class="${sticky}">${escapeHtml(displayValue(row, col))}</td>`;
        }).join("")}</tr>`;
      }).join("")
    : `<tr><td class="empty-row" colspan="${CONFIG.COLUMNS.length}">Nenhum produto encontrado com os filtros atuais.</td></tr>`;

  // Clique no cabeçalho → ordenar
  head.querySelectorAll("th").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      state.sortDirection = state.sortKey === key ? -state.sortDirection : 1;
      state.sortKey = key;
      renderTable();
    });
  });

  // Clique em célula editável → editar
  body.querySelectorAll("[data-edit]").forEach(cell => {
    cell.addEventListener("click", () => {
      const row = state.rows.find(r => String(r._id) === cell.dataset.row);
      if (row) startCellEdit(cell, row, cell.dataset.edit);
    });
  });

  // Contadores e paginação
  document.getElementById("resultCount").textContent = `${total} de ${state.rows.length} produtos`;
  document.getElementById("editCount").textContent = `${editedCount()} células editadas`;
  document.getElementById("pageInfo").textContent = `Página ${total ? state.currentPage : 0} de ${total ? pages : 0}`;
  document.getElementById("prevPage").disabled = state.currentPage <= 1 || !total;
  document.getElementById("nextPage").disabled = state.currentPage >= pages || !total;

  const info = document.getElementById("activeFilterInfo");
  if (info) {
    info.textContent = state.pricingRule
      ? "Regra de Precificação ativa: PRECO.PROM = 0 e %DESC diferente de 0%"
      : `${total.toLocaleString("pt-BR")} produto(s) correspondem aos filtros`;
  }

  document.getElementById("loading").hidden = true;
  document.getElementById("errorBox").hidden = true;
  document.getElementById("tableWrap").hidden = false;
}