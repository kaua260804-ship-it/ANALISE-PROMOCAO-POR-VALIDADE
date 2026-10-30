// ============================================================
// Edição local de PRECO.SIST e PRC.ARRED.
// As edições ficam no localStorage — o arquivo Excel nunca é
// alterado. Funciona tanto na tabela plana quanto na view
// agrupada (que também usa as mesmas células editáveis).
// ============================================================

// ------------------------------------------------------------
// Retorna true se a célula (row+field) já foi editada.
// ------------------------------------------------------------
function isEdited(row, field) {
  return localStorage.getItem(storageKey(row, field)) !== null;
}

// ------------------------------------------------------------
// Inicia a edição de uma célula. Funciona em ambas as views.
// ------------------------------------------------------------
function startCellEdit(cell, row, field) {
  if (cell.querySelector("input")) return; // já está editando

  const current = getEditedValue(row, field);
  const input = document.createElement("input");
  input.className = "cell-editor";
  input.value = current === null ? "" : String(current);
  input.setAttribute("aria-label", `Editar ${field}`);

  cell.textContent = "";
  cell.appendChild(input);
  input.focus();
  input.select();

  let finished = false;

  const finish = (save) => {
    if (finished) return;
    finished = true;

    if (save) {
      const normalized = normalizeMoneyInput(input.value);

      // Entrada inválida: mantém o editor aberto
      if (normalized === null) {
        input.focus();
        finished = false;
        return;
      }

      // Vazio: remove a edição (volta ao valor original)
      if (normalized === "") {
        localStorage.removeItem(storageKey(row, field));
      } else {
        localStorage.setItem(storageKey(row, field), normalized);
      }

      cell.classList.add("saved-flash");
      setTimeout(() => cell.classList.remove("saved-flash"), 600);
    }

    renderCurrentView();   // atualiza a view ativa (tabela ou grupos)
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    if (e.key === "Escape") { finish(false); }
  });
  input.addEventListener("blur", () => finish(true));
}

// ------------------------------------------------------------
// Restaura os valores originais apagando TODAS as edições
// salvas neste navegador.
// ------------------------------------------------------------
function restoreOriginals() {
  if (!confirm("Apagar todas as edições locais salvas neste navegador?")) return;

  Object.keys(localStorage)
    .filter(k => k.startsWith("edicao:"))
    .forEach(k => localStorage.removeItem(k));

  renderCurrentView();   // atualiza a view ativa (tabela ou grupos)
}