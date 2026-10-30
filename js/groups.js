// ============================================================
// VISÃO AGRUPADA POR DATA DE VALIDADE
// - Contagem de SKUs distintos (CODIGO)
// - Botão "Feito" por grupo → envia para Google Sheets
// - Marca visualmente itens já feitos
// - Chave de sync normalizada para bater com o Sheets
// ============================================================

const GROUPS_COLUMNS = [
  "LOJA",
  "CODIGO",
  "DESCRIÇÃO DOS PRODUTOS",
  "QTD.SIST",
  "PRECO.SIST",
  "PRECO.PROM",
  "%DESC",
  "PRC.ARRED",
  "STATUS"
];

// ------------------------------------------------------------
// REGRA DE NEGÓCIO — item a precificar?
// PRECO.PROM = 0 E %DESC diferente de 0%
// ------------------------------------------------------------
function isPricingPending(row) {
  const prom = parseNumber(row["PRECO.PROM"]);
  const desc = parsePercent(row["%DESC"]);
  return prom === 0 && desc !== null && desc !== 0;
}

// ------------------------------------------------------------
// Chave única para sincronização com o Sheets
// Formato: "LOJA|CODIGO|YYYY-MM-DD" (tudo normalizado)
// ------------------------------------------------------------
function syncKey(row) {
  const loja = normalizeText(row.LOJA).toUpperCase();
  const codigo = normalizeText(row.CODIGO).replace(/\.0+$/, "");
  const dataIso = dateInputValue(row.DATA);
  return `${loja}|${codigo}|${dataIso}`;
}

// ------------------------------------------------------------
// Verifica se uma linha já foi marcada como "Feito"
// ------------------------------------------------------------
function isRowDone(row) {
  return state.doneRows.has(syncKey(row));
}

// ------------------------------------------------------------
// Diferença em dias entre hoje e uma data ISO (YYYY-MM-DD).
// Negativo = já venceu. 0 = vence hoje. Positivo = futuro.
// ------------------------------------------------------------
function diasAte(isoDate) {
  if (!isoDate) return null;
  const partes = isoDate.split("-").map(Number);
  if (partes.length !== 3 || partes.some(n => Number.isNaN(n))) return null;
  const [y, m, d] = partes;
  const alvo = new Date(y, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje) / 86400000);
}

// ------------------------------------------------------------
// Constrói os grupos por DATA, com estatísticas incluindo SKUs
// ------------------------------------------------------------
function buildGroups(rows) {
  const mapa = new Map();

  rows.forEach(row => {
    const iso = dateInputValue(row.DATA);
    if (!iso) return;

    if (!mapa.has(iso)) {
      mapa.set(iso, { date: iso, label: formatDate(row.DATA), rows: [] });
    }
    mapa.get(iso).rows.push(row);
  });

  const grupos = [...mapa.values()].sort((a, b) => a.date.localeCompare(b.date));

  grupos.forEach(g => {
    g.rows.sort((a, b) => {
      const pa = isPricingPending(a) ? 0 : 1;
      const pb = isPricingPending(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return normalizeText(a["DESCRIÇÃO DOS PRODUTOS"])
        .localeCompare(normalizeText(b["DESCRIÇÃO DOS PRODUTOS"]), "pt-BR");
    });

    g.total = g.rows.length;
    g.pendentes = g.rows.filter(isPricingPending).length;
    g.qtdTotal = g.rows.reduce((s, r) => s + (parseNumber(r["QTD.SIST"]) || 0), 0);
    g.diasParaVencer = diasAte(g.date);

    // SKUs distintos (CODIGO únicos neste grupo)
    g.skus = new Set(
      g.rows.map(r => normalizeText(r.CODIGO)).filter(Boolean)
    ).size;

    // Status de conclusão
    g.feitos = g.rows.filter(isRowDone).length;
    g.todosFeitos = g.total > 0 && g.feitos === g.total;
  });

  return grupos;
}

// ------------------------------------------------------------
// Renderiza uma linha da tabela do grupo
// ------------------------------------------------------------
function renderGroupRow(row) {
  const pend = isPricingPending(row);
  const done = isRowDone(row);

  return `
    <tr class="${pend ? "linha-pendente" : ""} ${done ? "linha-feita" : ""}">
      ${GROUPS_COLUMNS.map(col => {
        if (col === "STATUS") {
          const s = normalizeText(row.STATUS).toUpperCase();
          const c = s === "PENDENTE" ? "status-pendente" : s === "FEITO" ? "status-feito" : "status-other";
          return `<td><span class="status-badge ${c}">${escapeHtml(row.STATUS || "—")}</span></td>`;
        }

        if (col === "PRC.ARRED") {
          const edited = isEdited(row, col);
          const val = displayValue(row, col);
          return `<td class="editable-cell ${edited ? "editado" : ""}"
                     data-edit="${escapeHtml(col)}"
                     data-row="${row._id}"
                     title="${pend ? "Clique para ajustar o preço-alvo" : "Clique para editar"}">
                    ${escapeHtml(val)}${edited ? '<i class="fa-solid fa-pen edited-icon"></i>' : ""}
                  </td>`;
        }

        if (col === "%DESC") {
          const d = parsePercent(row["%DESC"]);
          const clsD = d === 0 ? "desc-zero" : d !== null ? "desc-positivo" : "";
          return `<td class="${clsD}">${escapeHtml(displayValue(row, col))}</td>`;
        }

        return `<td>${escapeHtml(displayValue(row, col))}</td>`;
      }).join("")}
    </tr>
  `;
}

// ------------------------------------------------------------
// Renderiza um card de grupo com botão "Feito"
// ------------------------------------------------------------
function renderGroupCard(g) {
  const urgente = g.diasParaVencer !== null && g.diasParaVencer < 7;
  const alerta = g.diasParaVencer !== null && g.diasParaVencer <= 30;
  const clsUrg = urgente ? "urgency-red" : alerta ? "urgency-yellow" : "";

  const diasLabel =
    g.diasParaVencer === null ? "" :
    g.diasParaVencer < 0 ? `vencido há ${Math.abs(g.diasParaVencer)} dia(s)` :
    g.diasParaVencer === 0 ? "vence hoje" :
    `vence em ${g.diasParaVencer} dia(s)`;

  const badgeCls = urgente ? "badge-red" : alerta ? "badge-yellow" : "badge-green";

  const linhasHtml = g.rows.map(renderGroupRow).join("");

  const destaquePreco = g.rows
    .filter(isPricingPending)
    .map(r => {
      const alvo = getEditedValue(r, "PRC.ARRED");
      return `<span class="preco-chip">${escapeHtml(normalizeText(r.CODIGO))} → <strong>${escapeHtml(formatMoney(alvo))}</strong></span>`;
    })
    .join(" ");

  const hintHtml = g.pendentes
    ? `<div class="group-pricing-hint">
         <i class="fa-solid fa-bullseye"></i> Precificar com PRC.ARRED: ${destaquePreco}
       </div>`
    : "";

  // Botão Feito
  const btnDoneClass = g.todosFeitos ? "btn-done done" : "btn-done";
  const btnDoneText = g.todosFeitos ? "✓ Feito" : "Marcar Feito";
  const btnDoneDisabled = g.todosFeitos ? "disabled" : "";

  return `
    <div class="group-card ${clsUrg}" data-date="${g.date}">
      <div class="group-header">
        <div>
          <div class="group-date">
            <i class="fa-solid fa-calendar-day"></i> ${escapeHtml(g.label)}
          </div>
          <div class="group-meta">
            <span class="badge ${badgeCls}">${diasLabel}</span>
          </div>
        </div>
        <div class="group-stats">
          <span><strong>${g.total}</strong> linha(s)</span>
          <span><strong>${g.skus}</strong> SKU(s)</span>
          <span><strong>${g.pendentes}</strong> a precificar</span>
          <span><strong>${g.qtdTotal.toLocaleString("pt-BR")}</strong> un.</span>
        </div>
        <button class="${btnDoneClass}" data-date="${g.date}" ${btnDoneDisabled} type="button">
          <i class="fa-solid fa-check"></i> ${btnDoneText}
        </button>
        <i class="fa-solid fa-chevron-down chevron"></i>
      </div>
      ${hintHtml}
      <div class="group-body">
        <table>
          <thead>
            <tr>${GROUPS_COLUMNS.map(c => `<th>${escapeHtml(c)}</th>`).join("")}</tr>
          </thead>
          <tbody>${linhasHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// Renderiza a view agrupada completa
// ------------------------------------------------------------
function renderGroups() {
  const container = document.getElementById("groupsContainer");
  const summary = document.getElementById("groupsSummary");
  if (!container || !summary) return;

  const grupos = buildGroups(state.filteredRows);
  const totalPend = grupos.reduce((s, g) => s + g.pendentes, 0);
  const totalLinhas = grupos.reduce((s, g) => s + g.total, 0);
  const totalSkus = new Set(
    state.filteredRows.map(r => normalizeText(r.CODIGO)).filter(Boolean)
  ).size;

  summary.innerHTML = `
    <span><i class="fa-solid fa-calendar-days"></i> <strong>${grupos.length}</strong> data(s) de validade</span>
    <span><i class="fa-solid fa-cube"></i> <strong>${totalSkus}</strong> SKU(s) distinto(s)</span>
    <span><i class="fa-solid fa-triangle-exclamation"></i> <strong>${totalPend}</strong> item(ns) a precificar</span>
    <span><i class="fa-solid fa-boxes-stacked"></i> <strong>${totalLinhas}</strong> linha(s) no total</span>
  `;

  if (!grupos.length) {
    container.innerHTML = `<div class="group-empty">Nenhum produto com DATA válida nos filtros atuais.</div>`;
    return;
  }

  container.innerHTML = grupos.map(renderGroupCard).join("");

  // Abre grupos com pendentes ou os 3 primeiros
  const cards = container.querySelectorAll(".group-card");
  let abertos = 0;
  cards.forEach(card => {
    const g = grupos.find(x => x.date === card.dataset.date);
    if (g && g.pendentes > 0) { card.classList.add("open"); abertos++; }
  });
  if (abertos === 0) {
    for (let i = 0; i < Math.min(3, cards.length); i++) cards[i].classList.add("open");
  }

  // Toggle do header (exceto no botão Feito)
  container.querySelectorAll(".group-header").forEach(header => {
    header.addEventListener("click", (e) => {
      if (e.target.closest(".btn-done")) return;
      header.closest(".group-card").classList.toggle("open");
    });
  });

  // Edição de células
  container.querySelectorAll("[data-edit]").forEach(cell => {
    cell.addEventListener("click", (e) => {
      e.stopPropagation();
      const row = state.rows.find(r => String(r._id) === cell.dataset.row);
      if (row) startCellEdit(cell, row, cell.dataset.edit);
    });
  });

  // Botão "Feito" → envia grupo para o Sheets
  container.querySelectorAll(".btn-done:not(.done)").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const date = btn.dataset.date;
      const grupo = grupos.find(g => g.date === date);
      if (grupo) marcarGrupoComoFeito(grupo, btn);
    });
  });

  // Atualiza contadores do header
  const elResult = document.getElementById("resultCount");
  const elEdit = document.getElementById("editCount");
  if (elResult) elResult.textContent = `${totalLinhas} de ${state.rows.length} produtos`;
  if (elEdit) elEdit.textContent = `${editedCount()} células editadas`;

  const info = document.getElementById("activeFilterInfo");
  if (info) {
    info.textContent = state.pricingRule
      ? "Regra de Precificação ativa: PRECO.PROM = 0 e %DESC diferente de 0%"
      : `${totalLinhas.toLocaleString("pt-BR")} produto(s) correspondem aos filtros`;
  }
}