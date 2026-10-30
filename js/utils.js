// Funções de conversão e formatação usadas pelos módulos
function normalizeText(value){return String(value ?? "").trim();}
function parseNumber(value){
  if(value === null || value === undefined || value === "") return null;
  if(typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value).trim().replace(/\s/g,"").replace(/R\$/gi,"").replace(/%/g,"");
  if(!s) return null;
  // Formato brasileiro: ponto de milhar e vírgula decimal.
  if(s.includes(",")) s = s.replace(/\./g,"").replace(",",".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function parsePercent(value){return parseNumber(value);}
function parseDate(value){
  if(value instanceof Date && !Number.isNaN(value.getTime())) return new Date(value.getFullYear(),value.getMonth(),value.getDate());
  if(typeof value === "number" && window.XLSX?.SSF){
    const d = XLSX.SSF.parse_date_code(value);
    if(d) return new Date(d.y,d.m-1,d.d);
  }
  const s = normalizeText(value);
  if(!s) return null;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(br) return new Date(+br[3],+br[2]-1,+br[1]);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso) return new Date(+iso[1],+iso[2]-1,+iso[3]);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(),d.getMonth(),d.getDate());
}
function dateInputValue(value){
  const d=parseDate(value); if(!d)return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function formatDate(value){
  const d=parseDate(value);return d?`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`:normalizeText(value);
}
function formatMoney(value){
  const n=parseNumber(value); if(n===null)return normalizeText(value);
  return `R$ ${n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function normalizeMoneyInput(value){
  let s=String(value??"").trim().replace(/R\$/gi,"").replace(/\s/g,"");
  if(!s)return "";
  if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  const n=Number.parseFloat(s);
  if(!Number.isFinite(n))return null;
  return `R$ ${n.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function debounce(fn,wait=180){let timer;return(...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),wait);};}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function uniqueValues(rows,key){
  return [...new Set(rows.map(r=>normalizeText(r[key])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}));
}
function storageKey(row,field){return `edicao:${normalizeText(row.LOJA)}|${normalizeText(row.CODIGO)}|${dateInputValue(row.DATA)||normalizeText(row.DATA)}|${field}`;}
function getEditedValue(row,field){const v=localStorage.getItem(storageKey(row,field));return v===null?row[field]:v;}
function editedCount(){
  let n=0;for(const key of Object.keys(localStorage))if(key.startsWith("edicao:"))n++;return n;
}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
