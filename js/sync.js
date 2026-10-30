// ============================================================
// SINCRONIZAÇÃO COM GOOGLE SHEETS
// ------------------------------------------------------------
// - Envia os itens de um grupo como "Feito" (POST)
// - Consulta periodicamente quais itens já foram feitos (GET)
// - Normaliza TODAS as chaves para garantir match perfeito
// - Atualiza state.doneRows e a interface
// ============================================================

// ------------------------------------------------------------
// Normaliza a DATA recebida do Sheets para "YYYY-MM-DD".
// Aceita: Date, ISO, DD/MM/YYYY, "Thu Oct 29 2026 ..."
// ------------------------------------------------------------
function normalizarDataIso(valor) {
  if (!valor) return "";

  // 1) Objeto Date (raro via JSON, mas possível)
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    const y = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, "0");
    const d = String(valor.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const s = String(valor).trim();
  if (!s) return "";

  // 2) ISO: YYYY-MM-DD...
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // 3) BR: DD/MM/AAAA
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  // 4) "Thu Oct 29 2026 ..." — extrai por mês em inglês
  const meses = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
  };
  m = s.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (m && meses[m[1]]) {
    return `${m[3]}-${meses[m[1]]}-${m[2].padStart(2, "0")}`;
  }

  // 5) Fallback: parser do browser
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }

  return "";
}

// ------------------------------------------------------------
// Gera a chave normalizada (mesma lógica de syncKey em groups.js)
// ------------------------------------------------------------
function chaveSync(loja, codigo, data) {
  const l = String(loja ?? "").trim().toUpperCase();
  const c = String(codigo ?? "").trim().replace(/\.0+$/, "");
  const d = normalizarDataIso(data);
  return `${l}|${c}|${d}`;
}

// ------------------------------------------------------------
// Envia um grupo como "Feito" para o Google Sheets
// ------------------------------------------------------------
async function marcarGrupoComoFeito(grupo, btn) {
  if (!CONFIG.API_URL) {
    alert(
      "A URL da API não está configurada.\n" +
      "Abra js/keyapi.js e cole a URL do seu Web App do Google Apps Script em API_URL."
    );
    return;
  }

  const itens = grupo.rows.map(row => ({
    loja: normalizeText(row.LOJA),
    codigo: normalizeText(row.CODIGO),
    descricao: normalizeText(row["DESCRIÇÃO DOS PRODUTOS"]),
    precoSist: parseNumber(getEditedValue(row, "PRECO.SIST")),
    desc: parsePercent(getEditedValue(row, "%DESC")),
    prcArred: parseNumber(getEditedValue(row, "PRC.ARRED")),
    data: dateInputValue(row.DATA) // sempre "YYYY-MM-DD"
  }));

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

  try {
    const resp = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "marcarFeito", itens })
    });

    const data = await resp.json();
    if (data.status !== "success") {
      throw new Error(data.message || "Erro desconhecido no servidor");
    }

    // Marca localmente com a MESMA chave normalizada do syncKey()
    grupo.rows.forEach(row => {
      state.doneRows.add(syncKey(row));
    });

    btn.classList.add("done");
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Feito';

    renderCurrentView();
    atualizarIndicadorSync();
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Marcar Feito';
    alert("Erro ao enviar para o Google Sheets:\n" + err.message);
  }
}

// ------------------------------------------------------------
// Consulta o Sheets para saber quais itens já foram feitos
// ------------------------------------------------------------
async function sincronizarStatus() {
  if (!CONFIG.API_URL) return;

  try {
    const resp = await fetch(
      `${CONFIG.API_URL}?action=listarFeitos&t=${Date.now()}`,
      {
        method: "GET",
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      }
    );

    const data = await resp.json();
    if (data.status !== "success") {
      console.warn("Sync retornou erro:", data.message);
      return;
    }

    // Reconstrói o Set com chaves normalizadas do Sheets
    const novos = new Set();
    (data.feitos || []).forEach(item => {
      const key = chaveSync(item.loja, item.codigo, item.data);
      // Ignora chaves inválidas (data vazia, etc.)
      if (key.split("|")[2]) novos.add(key);
    });

    // Preserva o que já foi marcado localmente nesta sessão
    state.doneRows.forEach(k => novos.add(k));

    const mudou = novos.size !== state.doneRows.size;
    state.doneRows = novos;
    state.lastSync = new Date();

    if (mudou) renderCurrentView();
    atualizarIndicadorSync();
  } catch (err) {
    console.warn("Sync falhou:", err.message);
  }
}

// ------------------------------------------------------------
// Inicia o ciclo de sincronização a cada 15s
// ------------------------------------------------------------
function iniciarSync() {
  if (state.syncTimer) clearInterval(state.syncTimer);

  if (!CONFIG.API_URL) {
    console.warn(
      "Sync desativado: CONFIG.API_URL vazio. " +
      "Configure a URL em js/keyapi.js."
    );
    atualizarIndicadorSync();
    return;
  }

  sincronizarStatus(); // primeira chamada imediata
  state.syncTimer = setInterval(sincronizarStatus, CONFIG.API_REFRESH_MS);
}

// ------------------------------------------------------------
// Atualiza o indicador visual de última sincronização
// ------------------------------------------------------------
function atualizarIndicadorSync() {
  const el = document.getElementById("syncStatus");
  if (!el) return;

  if (!CONFIG.API_URL) {
    el.textContent = "Sync: desativado";
    el.style.background = "#f1f5f9";
    el.style.color = "#64748b";
    return;
  }

  if (!state.lastSync) {
    el.textContent = "Sync: —";
    return;
  }

  const hh = String(state.lastSync.getHours()).padStart(2, "0");
  const mm = String(state.lastSync.getMinutes()).padStart(2, "0");
  const ss = String(state.lastSync.getSeconds()).padStart(2, "0");
  el.textContent = `Sync: ${hh}:${mm}:${ss}`;
}