// ============================================================
// LEITURA DA PLANILHA — ABA CONS
// ------------------------------------------------------------
// Layout esperado:
//   - Cabeçalho na LINHA 2 (índice 1), a partir da coluna B.
//   - Registros a partir da LINHA 3 (índice 2).
//   - Coluna A ignorada.
//
// Robustez:
//   - Auto-detecta a linha do cabeçalho procurando "LOJA.SIST".
//   - Auto-detecta a coluna inicial (A ou B) onde está "LOJA.SIST".
//   - Comparação normalizada (NFC, NBSP, espaços, maiúsculas).
//   - blankrows:true evita deslocamento por linhas vazias.
// ============================================================

/**
 * Normaliza um texto de cabeçalho para comparação:
 * - Unicode NFC (acentos compostos vs decompostos)
 * - NBSP (\u00A0) -> espaço comum
 * - espaços múltiplos -> um espaço
 * - trim
 * - maiúsculas
 */
function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Converte índice 0-based em letra de coluna Excel.
 * 0 -> A, 1 -> B, 25 -> Z, 26 -> AA ...
 */
function columnLetter(index) {
  let n = index + 1; // 1-based
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Lê a planilha enviada e retorna as linhas da aba CONS.
 */
async function loadWorkbookFile(file) {
  if (!window.XLSX) {
    throw new Error("A biblioteca XLSX não carregou. Verifique sua conexão com a internet.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[CONFIG.SHEET_NAME];
  if (!sheet) {
    throw new Error(`A aba "${CONFIG.SHEET_NAME}" não foi encontrada na planilha.`);
  }

  // Lê como matriz preservando linhas vazias
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
    blankrows: true
  });

  // ---- 1) Localiza a linha do cabeçalho (procura "LOJA.SIST") ----
  const alvo = normalizeHeader(CONFIG.COLUMNS[0]); // "LOJA.SIST"
  let headerIndex = matrix.findIndex(
    row => Array.isArray(row) && row.some(c => normalizeHeader(c) === alvo)
  );
  if (headerIndex < 0) headerIndex = 1; // fallback: linha 2 (índice 1)

  const headerRow = matrix[headerIndex] || [];

  // ---- 2) Localiza a coluna inicial onde está "LOJA.SIST" ----
  let startCol = headerRow.findIndex(c => normalizeHeader(c) === alvo);
  if (startCol < 0) startCol = 1; // fallback: coluna B (índice 1)

  // ---- 3) Compara as 26 colunas a partir de startCol ----
  const headers = headerRow
    .slice(startCol, startCol + CONFIG.COLUMNS.length)
    .map(normalizeHeader);

  const divergencias = [];
  CONFIG.COLUMNS.forEach((esperado, i) => {
    const esperadoNorm = normalizeHeader(esperado);
    const realNorm = headers[i] ?? "";
    if (realNorm !== esperadoNorm) {
      const letra = columnLetter(startCol + i);
      divergencias.push(
        `Coluna ${letra} (posição ${i + 1}): esperado "${esperado}", encontrado "${realNorm || "(vazio)"}"`
      );
    }
  });

  if (divergencias.length) {
    throw new Error(
      `Cabeçalho diferente do esperado na aba CONS ` +
      `(linha ${headerIndex + 1}, começando em ${columnLetter(startCol)}). ` +
      `Divergências:\n• ` + divergencias.join("\n• ")
    );
  }

  // ---- 4) Lê os registros a partir da linha seguinte ao cabeçalho ----
  const rows = matrix
    .slice(headerIndex + 1)
    .filter(r => Array.isArray(r) && r.slice(startCol).some(v => v !== "" && v != null && v !== undefined))
    .map((r, index) => {
      const obj = { _id: index };
      CONFIG.COLUMNS.forEach((col, i) => {
        obj[col] = r[startCol + i] ?? "";
      });
      return obj;
    });

  if (!rows.length) {
    throw new Error("A aba CONS não possui registros a partir da linha 3.");
  }

  return rows;
}

/**
 * Carrega a planilha padrão publicada junto ao site.
 */
async function loadDefaultWorkbook() {
  const response = await fetch(encodeURI(CONFIG.FILE_NAME));
  if (!response.ok) {
    throw new Error(
      `Não foi possível abrir "${CONFIG.FILE_NAME}". ` +
      `Coloque o arquivo na raiz do site e publique novamente. ` +
      `Também é possível usar "Carregar outra planilha". ` +
      `DICA: não abra o painel via file:// — use um servidor local ` +
      `(ex.: python -m http.server 8000).`
    );
  }
  return loadWorkbookFile({ arrayBuffer: () => response.arrayBuffer() });
}