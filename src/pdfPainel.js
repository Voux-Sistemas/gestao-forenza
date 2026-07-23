import { jsPDF } from "jspdf";
import { rotuloLocal } from "./etapas.js";

const TINTA = [38, 37, 30];
const VERDE = [29, 158, 117];
const VERDE_ESCURO = [8, 80, 65];
const CINZA = [130, 128, 120];
const VERMELHO = [200, 60, 55];
const AMBAR_TXT = [176, 106, 16];

// Cor por etapa (RGB) + tom escuro para o texto do título do bloco.
const COR_ETAPA = {
  "Ficha Técnica de Corte": [14, 138, 138],
  "Corte": [45, 108, 179],
  "Amostra": [196, 60, 122],
  "Oficina": [186, 117, 23],
  "Aviação": [107, 95, 196],
  "Acabamento": [217, 101, 12],
  "Estoque": [23, 138, 90],
  "Entrada": [130, 128, 120],
};
const escurece = (c, f = 0.7) => c.map((v) => Math.round(v * f));

const fmt = (d) => {
  if (!d) return "—";
  const dt = /^\d{4}-\d{2}-\d{2}/.test(d) ? new Date(d.slice(0, 10) + "T12:00") : new Date(d);
  return isNaN(dt) ? "—" : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

// Painel da etapa (visão da direção) — paisagem.
//   tudo=true  → agrupa por ETAPA (blocos), com a marca em coluna.
//   tudo=false → uma etapa só, agrupa por MARCA.
// `blocos` = [{ chave, titulo, cor, itens: [...] }]  (já montado pelo Tabela.jsx)
export function gerarPainelEtapa({ etapa, tudo, blocos, filtros, totais }) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const larg = doc.internal.pageSize.getWidth();   // 297
  const alt = doc.internal.pageSize.getHeight();   // 210
  const mx = 10;
  let y = 14;

  const rodape = () => {
    doc.setDrawColor(225).setLineWidth(0.2).line(mx, alt - 8, larg - mx, alt - 8);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
    doc.text("Gerado pelo sistema Forenza — Gestão de produção", mx, alt - 4.5);
    doc.text(`Página ${doc.getNumberOfPages()}`, larg - mx, alt - 4.5, { align: "right" });
  };

  const tituloDoc = tudo ? "Produção" : rotuloLocal(etapa);

  // ── Capa (faixa premium) ──
  const coverH = 32;
  const CAPA_A = [22, 55, 32], CAPA_B = [30, 72, 43];
  const CLARO = [167, 204, 174], FAINT = [127, 163, 135];
  const AMBAR_CAPA = [223, 162, 54];
  {
    const passos = 240, passoL = larg / passos;
    for (let i = 0; i < passos; i++) {
      const t = i / (passos - 1);
      doc.setFillColor(
        Math.round(CAPA_A[0] + (CAPA_B[0] - CAPA_A[0]) * t),
        Math.round(CAPA_A[1] + (CAPA_B[1] - CAPA_A[1]) * t),
        Math.round(CAPA_A[2] + (CAPA_B[2] - CAPA_A[2]) * t)
      );
      doc.rect(i * passoL - 0.3, 0, passoL + 0.9, coverH, "F");
    }
    const fioY = coverH - 1, FIO_BASE = [18, 44, 26];
    doc.setFillColor(...FIO_BASE).rect(0, fioY, larg, 1, "F");
    const fadeW = larg * 0.5, nF = 120, wF = fadeW / nF;
    for (let i = 0; i < nF; i++) {
      const t = i / (nF - 1);
      doc.setFillColor(
        Math.round(AMBAR_CAPA[0] + (FIO_BASE[0] - AMBAR_CAPA[0]) * t),
        Math.round(AMBAR_CAPA[1] + (FIO_BASE[1] - AMBAR_CAPA[1]) * t),
        Math.round(AMBAR_CAPA[2] + (FIO_BASE[2] - AMBAR_CAPA[2]) * t)
      );
      doc.rect(i * wF - 0.2, fioY, wF + 0.6, 1, "F");
    }
  }
  doc.setDrawColor(255).setLineWidth(1).circle(mx + 4, 10.5, 3.8, "S");
  doc.setFillColor(111, 208, 138).circle(mx + 4, 10.5, 1.6, "F");
  doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...FAINT);
  doc.setCharSpace(0.5); doc.text("FORENZA · GESTÃO DE PRODUÇÃO", mx + 9.5, 7.5); doc.setCharSpace(0);
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(255);
  doc.text(tudo ? "Relatório de Produção" : `Painel de ${tituloDoc}`, mx + 9.5, 16);

  const partes = [];
  if (filtros.marca) partes.push(`marca "${filtros.marca}"`);
  if (filtros.etapaDe || filtros.etapaAte) partes.push(`na etapa ${filtros.etapaDe ? fmt(filtros.etapaDe) : "…"}–${filtros.etapaAte ? fmt(filtros.etapaAte) : "…"}`);
  if (filtros.entregaDe || filtros.entregaAte) partes.push(`entrega ${filtros.entregaDe ? fmt(filtros.entregaDe) : "…"}–${filtros.entregaAte ? fmt(filtros.entregaAte) : "…"}`);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CLARO);
  doc.text(`${tudo ? "Todas as etapas" : "Etapa única"} · ${partes.length ? partes.join(" · ") : "todas as marcas"}`, mx + 9.5, 22);
  doc.setFontSize(6.5).setTextColor(...FAINT);
  doc.text(`Emitido ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`, mx + 9.5, 26.5);

  // KPIs à direita
  const kpis = [["PEDIDOS", String(totais.pedidos)], ["PEÇAS", totais.pecas.toLocaleString("pt-BR")], ["ATRASADOS", String(totais.atrasados)]];
  let kx = larg - mx;
  [...kpis].reverse().forEach(([rot, val]) => {
    const alerta = rot === "ATRASADOS" && totais.atrasados > 0;
    doc.setFont("helvetica", "bold").setFontSize(12);
    const wV = doc.getTextWidth(val);
    doc.setFont("helvetica", "bold").setFontSize(6);
    const wR = doc.getTextWidth(rot);
    const cw = Math.max(wV, wR) + 11;
    const cx = kx - cw;
    doc.setFillColor(...(alerta ? [70, 52, 26] : [40, 70, 50]));
    doc.setDrawColor(...(alerta ? [120, 90, 40] : [58, 90, 66])).setLineWidth(0.3).roundedRect(cx, 5.5, cw, 15, 2.6, 2.6, "FD");
    doc.setFont("helvetica", "bold").setFontSize(6).setTextColor(...(alerta ? [230, 190, 110] : CLARO));
    doc.text(rot, cx + cw / 2, 10, { align: "center" });
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...(alerta ? [244, 198, 105] : [255, 255, 255]));
    doc.text(val, cx + cw / 2, 17.5, { align: "center" });
    kx = cx - 4;
  });

  y = coverH + 7;

  // ── Colunas (12) — larguras somam ~277 (larg - 2*mx) ──
  const cols = [
    { key: "marca", rot: "MARCA", w: 24, al: "left" },
    { key: "produto", rot: "PRODUTO", w: 40, al: "left" },
    { key: "referencia", rot: "REFERÊNCIA", w: 27, al: "left" },
    { key: "pedido", rot: "PEDIDO", w: 20, al: "left" },
    { key: "qtd", rot: "QTD", w: 14, al: "right" },
    { key: "corte", rot: "CORTE", w: 14, al: "right" },
    { key: "ncorte", rot: "Nº CORTE", w: 24, al: "left" },
    { key: "oficina", rot: "OFICINA", w: 24, al: "left" },
    { key: "entrega", rot: "ENTREGA", w: 18, al: "left" },
    { key: "prorrog", rot: "PRORROG.", w: 18, al: "left" },
    { key: "oficial", rot: "OFICIAL", w: 18, al: "left" },
    { key: "obs", rot: "OBS", w: 36, al: "left" },
  ];
  const larguraTabela = cols.reduce((a, c) => a + c.w, 0);
  const posX = (i) => mx + cols.slice(0, i).reduce((a, c) => a + c.w, 0);
  const idx = (k) => cols.findIndex((c) => c.key === k);
  const hLinha = 6.4;
  const RAIO = 2.6, BORDA = [231, 234, 228];

  const cabecalhoColunas = () => {
    doc.setFillColor(244, 247, 242).rect(mx, y, larguraTabela, 5.6, "F");
    doc.setFont("helvetica", "bold").setFontSize(6.3).setTextColor(...CINZA);
    cols.forEach((c, i) => {
      const x = posX(i);
      doc.text(c.rot, c.al === "right" ? x + c.w - 2.5 : x + 2.5, y + 3.8, { align: c.al });
    });
    y += 5.6;
  };

  const desenhaLinha = (it, zebra) => {
    const obsLinhas = it.obs ? doc.splitTextToSize(it.obs, cols[idx("obs")].w - 3) : [];
    const prodLinhas = doc.splitTextToSize(String(it.produto || "—"), cols[idx("produto")].w - 3);
    const nLin = Math.max(1, obsLinhas.length, prodLinhas.length);
    const hCel = Math.max(hLinha, 2.5 + nLin * 3.2 + 1.8);
    if (y + hCel > alt - 12) { rodape(); doc.addPage(); y = 14; cabecalhoColunas(); }
    if (zebra) { doc.setFillColor(250, 251, 249).rect(mx, y, larguraTabela, hCel, "F"); }
    if (it.atrasado) { doc.setFillColor(251, 236, 236).rect(mx, y, larguraTabela, hCel, "F"); }
    doc.setDrawColor(240, 243, 238).setLineWidth(0.25).line(mx, y, larg - mx, y);

    const baseY = y + 4;
    const put = (k, txt, bold, cor) => {
      const i = idx(k);
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(7.3).setTextColor(...(cor || [70, 68, 62]));
      const x = posX(i);
      const t = doc.splitTextToSize(String(txt), cols[i].w - 3)[0] || String(txt);
      doc.text(t, cols[i].al === "right" ? x + cols[i].w - 2.5 : x + 2.5, baseY, { align: cols[i].al });
    };
    put("marca", it.marca || "—", true, TINTA);
    // produto pode ter 2 linhas
    doc.setFont("helvetica", "normal").setFontSize(7.3).setTextColor(...TINTA);
    doc.text(prodLinhas.slice(0, 2), posX(idx("produto")) + 2.5, baseY);
    put("referencia", it.referencia || "—");
    put("pedido", it.pedido || "—");
    put("qtd", it.qtd, true, TINTA);
    put("corte", it.corte);
    put("ncorte", it.ncorte || "—");
    put("oficina", it.oficina || "—");
    // entrega: riscada se prorrogada
    const ie = posX(idx("entrega"));
    doc.setFont("helvetica", it.prorrog ? "normal" : "bold").setFontSize(7.3).setTextColor(...(it.prorrog ? CINZA : it.atrasado ? VERMELHO : VERDE_ESCURO));
    const et = fmt(it.entrega);
    doc.text(et, ie + 2.5, baseY);
    if (it.prorrog) { const w = doc.getTextWidth(et); doc.setDrawColor(...CINZA).setLineWidth(0.3).line(ie + 2.5, baseY - 1, ie + 2.5 + w, baseY - 1); }
    // prorrogada
    if (it.prorrog) { doc.setFont("helvetica", "bold").setFontSize(7.3).setTextColor(...VERMELHO); doc.text(fmt(it.prorrog), posX(idx("prorrog")) + 2.5, baseY); }
    else { doc.setFont("helvetica", "normal").setFontSize(7.3).setTextColor(200, 200, 195); doc.text("—", posX(idx("prorrog")) + 2.5, baseY); }
    // oficial
    put("oficial", it.oficial ? fmt(it.oficial) : "—", false, it.oficial ? [70, 68, 62] : [200, 200, 195]);
    // obs
    if (obsLinhas.length) { doc.setFont("helvetica", "italic").setFontSize(7).setTextColor(...AMBAR_TXT); doc.text(obsLinhas.slice(0, 2), posX(idx("obs")) + 2.5, baseY); }
    else { doc.setFont("helvetica", "normal").setFontSize(7.3).setTextColor(200, 200, 195); doc.text("—", posX(idx("obs")) + 2.5, baseY); }
    y += hCel;
  };

  // ── Render dos blocos ──
  blocos.forEach((bloco) => {
    const pecas = bloco.itens.reduce((a, i) => a + (Number(i.qtd) || 0), 0);
    // cabeçalho do bloco
    if (y + 14 > alt - 12) { rodape(); doc.addPage(); y = 14; }
    const cor = bloco.cor || VERDE;
    doc.setFillColor(244, 247, 242).rect(mx, y, larguraTabela, 6.8, "F");
    doc.setDrawColor(229, 234, 224).setLineWidth(0.3).line(mx, y, larg - mx, y);
    doc.setFillColor(...cor).roundedRect(mx + 2.5, y + 2, 3, 3, 0.6, 0.6, "F");
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...escurece(cor));
    doc.text(String(bloco.titulo).toUpperCase(), mx + 8, y + 4.7);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...CINZA);
    doc.text(`${bloco.itens.length} pedido(s) · ${pecas.toLocaleString("pt-BR")} peças`, mx + 8 + doc.getTextWidth(String(bloco.titulo).toUpperCase()) + 4, y + 4.7);
    y += 6.8;
    // cabeçalho de colunas (repete por bloco)
    cabecalhoColunas();
    const tabTop = y - 5.6 - 6.8;
    bloco.itens.forEach((it, i) => desenhaLinha(it, i % 2 === 1));
    // moldura do bloco inteiro (título + tabela)
    doc.setDrawColor(...BORDA).setLineWidth(0.4).roundedRect(mx, tabTop, larguraTabela, y - tabTop, RAIO, RAIO, "S");
    y += 5;
  });

  rodape();
  doc.save(`painel-${tituloDoc.replace(/[^a-zA-Z0-9-_]/g, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
