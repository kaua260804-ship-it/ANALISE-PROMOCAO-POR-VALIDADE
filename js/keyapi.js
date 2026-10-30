// ============================================================
// CHAVE DE API — Google Apps Script Web App
// ------------------------------------------------------------
// Centraliza a URL do Web App para não precisar mexer em
// config.js toda vez que a implantação for atualizada.
//
// Como atualizar:
//   1. Google Apps Script → Implantar → Gerenciar implantações
//   2. Copie a URL do Web App (termina em /exec)
//   3. Cole abaixo em API_URL
// ============================================================

const KEY_API = {
  // URL do Web App publicado no Google Apps Script
  API_URL: "https://script.google.com/macros/s/AKfycbylwK2GIT4jtvMgJ05w7x5JZWI5dPHPD6kEgsCQsPeQFK8mnYwc65lF2OEJyumiT5Bd0Q/exec",

  // Intervalo de sincronização automática (ms)
  REFRESH_MS: 15000
};