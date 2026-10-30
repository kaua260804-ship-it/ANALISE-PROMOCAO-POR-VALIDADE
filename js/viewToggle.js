// ============================================================
// Alterna entre a visão "Tabela plana" e "Agrupado por validade".
// Também centraliza a renderização da view atual para que
// filtros e edições atualizem a tela correta.
// ============================================================

/**
 * Define a view ativa.
 * @param {"table"|"groups"} mode
 */
function setView(mode) {
  state.view = mode;
  const isGroups = mode === "groups";

  const tableView = document.getElementById("tableView");
  const groupsView = document.getElementById("groupsView");
  if (tableView) tableView.hidden = isGroups;
  if (groupsView) groupsView.hidden = !isGroups;

  document.querySelectorAll("[data-view-btn]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.viewBtn === mode);
  });

  try {
    localStorage.setItem("viewMode", mode);
  } catch (_) {
    /* localStorage pode falhar em modo privado — ignora */
  }

  renderCurrentView();
}

/**
 * Renderiza a view ativa (tabela plana ou agrupada).
 * É o ponto único que deve ser chamado após qualquer filtro/edição.
 */
function renderCurrentView() {
  if (state.view === "groups") {
    if (typeof renderGroups === "function") renderGroups();
    else console.warn("renderGroups() não está disponível — groups.js não carregou?");
  } else {
    if (typeof renderTable === "function") renderTable();
    else console.warn("renderTable() não está disponível — table.js não carregou?");
  }
}

/**
 * Inicializa as abas. Lê a preferência salva em localStorage.
 */
function initViewToggle() {
  document.querySelectorAll("[data-view-btn]").forEach(btn => {
    btn.addEventListener("click", () => setView(btn.dataset.viewBtn));
  });

  let saved = null;
  try {
    saved = localStorage.getItem("viewMode");
  } catch (_) { /* ignora */ }

  setView(saved === "groups" ? "groups" : "table");
}