// ============================================================
// Configurações centrais do painel
// A URL da API e o intervalo de sync vêm de js/keyapi.js
// (que é carregado ANTES deste arquivo no index.html)
// ============================================================

const CONFIG = {
  FILE_NAME: "PRODUTOS VALIDADE LOJA.xlsx",
  SHEET_NAME: "CONS",
  PAGE_SIZE: 50,
  COLUMNS: [
    "LOJA.SIST","SEGMENTO","CONTAGEM","LOJA","CODIGO","DESCRIÇÃO DOS PRODUTOS",
    "DATA","QTD.VENC","MD.VD.MÊS","QTD.SIST","PRECO.SIST","DDE.VENC","DDE.SIST",
    "PRECO.PROM","PERC%","DIAS.S.VD","%DESC","STATUS","PREC.DESC","PRC.ARRED",
    "DESC","CUSTO","MARGEM","DIAS P/ VENCIMENTO","CATEGORIA.SIST","GRUPO"
  ],
  EDITABLE_FIELDS: ["PRECO.SIST","PRC.ARRED"],

  // ===== GOOGLE SHEETS API =====
  // A URL e o intervalo vêm de js/keyapi.js (carregado antes).
  // Se KEY_API não estiver definido, ficam vazios e o sync é desativado.
  API_URL: (typeof KEY_API !== "undefined" ? KEY_API.API_URL : ""),
  API_REFRESH_MS: (typeof KEY_API !== "undefined" ? KEY_API.REFRESH_MS : 15000),

  // Colunas que vão para o Google Sheets
  SHEETS_COLUMNS: [
    "LOJA",
    "CODIGO",
    "DESCRIÇÃO DOS PRODUTOS",
    "PRECO.SIST",
    "%DESC",
    "PRC.ARRED"
  ]
};

const state = {
  originalRows: [],
  rows: [],
  filteredRows: [],
  sortKey: null,
  sortDirection: 1,
  currentPage: 1,
  pricingRule: false,
  view: "table",

  // ===== Controle de sincronização =====
  doneRows: new Set(),   // Chaves "LOJA|CODIGO|DATA" já feitas
  syncTimer: null,       // Timer do refresh automático
  lastSync: null         // Última sincronização bem-sucedida
};