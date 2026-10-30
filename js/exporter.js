// Exporta o conjunto filtrado, incluindo os valores editados no navegador.
function exportRows(){
  return state.filteredRows.map(row=>{
    const out={};CONFIG.COLUMNS.forEach(col=>{
      let value=getEditedValue(row,col);
      if(col==="DATA")value=formatDate(value);
      out[col]=value;
    });return out;
  });
}
function exportXlsx(){
  if(!state.filteredRows.length){alert("Não há produtos para exportar.");return;}
  const ws=XLSX.utils.json_to_sheet(exportRows(),{header:CONFIG.COLUMNS});
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Produtos filtrados");
  XLSX.writeFile(wb,"produtos_validade_filtrados.xlsx");
}
function exportCsv(){
  if(!state.filteredRows.length){alert("Não há produtos para exportar.");return;}
  const rows=exportRows(),escape=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv="\uFEFF"+[CONFIG.COLUMNS.map(escape).join(";"),...rows.map(r=>CONFIG.COLUMNS.map(c=>escape(r[c])).join(";"))].join("\r\n");
  downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8;"}),"produtos_validade_filtrados.csv");
}
