import { jsPDF } from "jspdf";
import { rotuloLocal } from "./etapas.js";

const TINTA = [38, 37, 30];
const VERDE = [29, 158, 117];
const VERDE_ESCURO = [8, 80, 65];
const CINZA = [130, 128, 120];
const VERMELHO = [200, 60, 55];
const AMBAR_TXT = [176, 106, 16];

const COR_SETOR = {
  "Ficha Técnica de Corte": [14, 138, 138],
  "Corte": [45, 108, 179],
  "Amostra": [196, 60, 122],
  "Oficina": [186, 117, 23],
  "Aviação": [107, 95, 196],
  "Acabamento": [217, 101, 12],
  "Estoque": [23, 138, 90],
};

const fmt = (d) => {
  if (!d) return "—";
  const dt = /^\d{4}-\d{2}-\d{2}/.test(d) ? new Date(d.slice(0, 10) + "T12:00") : new Date(d);
  return isNaN(dt) ? "—" : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

// Painel da etapa (visão da direção) — paisagem, uma linha por pedido, agrupado por marca.
export function gerarPainelEtapa({ etapa, grupos, filtros, totais }) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const larg = doc.internal.pageSize.getWidth();   // 297
  const alt = doc.internal.pageSize.getHeight();   // 210
  const mx = 12;
  let y = 14;

  const rodape = () => {
    doc.setDrawColor(225).setLineWidth(0.2).line(mx, alt - 8, larg - mx, alt - 8);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
    doc.text("Gerado pelo sistema Forenza — Gestão de produção", mx, alt - 4.5);
    doc.text(`Página ${doc.getNumberOfPages()}`, larg - mx, alt - 4.5, { align: "right" });
  };
  const quebra = (h) => { if (y + h > alt - 12) { rodape(); doc.addPage(); y = 14; cabecalhoTabela(); } };

  // ── Capa (faixa premium, degradê verde + fio âmbar) ──
  const coverH = 34;
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
    const fioY = coverH - 1.1, FIO_BASE = [18, 44, 26];
    doc.setFillColor(...FIO_BASE).rect(0, fioY, larg, 1.1, "F");
    const fadeW = larg * 0.5, nF = 120, wF = fadeW / nF;
    for (let i = 0; i < nF; i++) {
      const t = i / (nF - 1);
      doc.setFillColor(
        Math.round(AMBAR_CAPA[0] + (FIO_BASE[0] - AMBAR_CAPA[0]) * t),
        Math.round(AMBAR_CAPA[1] + (FIO_BASE[1] - AMBAR_CAPA[1]) * t),
        Math.round(AMBAR_CAPA[2] + (FIO_BASE[2] - AMBAR_CAPA[2]) * t)
      );
      doc.rect(i * wF - 0.2, fioY, wF + 0.6, 1.1, "F");
    }
  }
  // marca
  doc.setDrawColor(255).setLineWidth(1).circle(mx + 4, 11, 4, "S");
  doc.setFillColor(111, 208, 138).circle(mx + 4, 11, 1.7, "F");
  doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...FAINT);
  doc.setCharSpace(0.5); doc.text("FORENZA · GESTÃO DE PRODUÇÃO", mx + 10, 8); doc.setCharSpace(0);
  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(255);
  doc.text(`Painel de ${rotuloLocal(etapa)}`, mx + 10, 17.5);

  // descrição dos filtros (à esquerda, abaixo do título)
  const partes = [];
  if (filtros.marca) partes.push(`marca "${filtros.marca}"`);
  if (filtros.etapaDe || filtros.etapaAte) partes.push(`na etapa ${filtros.etapaDe ? fmt(filtros.etapaDe) : "…"}–${filtros.etapaAte ? fmt(filtros.etapaAte) : "…"}`);
  if (filtros.entregaDe || filtros.entregaAte) partes.push(`entrega ${filtros.entregaDe ? fmt(filtros.entregaDe) : "…"}–${filtros.entregaAte ? fmt(filtros.entregaAte) : "…"}`);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CLARO);
  doc.text(`Filtros: ${partes.length ? partes.join(" · ") : "todos os pedidos da etapa"}`, mx + 10, 24);
  doc.setFontSize(7).setTextColor(...FAINT);
  doc.text(`Emitido ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`, mx + 10, 28.5);

  // KPIs à direita (cartões translúcidos pré-misturados)
  const kpis = [["PEDIDOS", String(totais.pedidos)], ["PEÇAS", totais.pecas.toLocaleString("pt-BR")], ["ATRASADOS", String(totais.atrasados)]];
  let kx = larg - mx;
  [...kpis].reverse().forEach(([rot, val], idx) => {
    const alerta = rot === "ATRASADOS" && totais.atrasados > 0;
    doc.setFont("helvetica", "bold").setFontSize(13);
    const wV = doc.getTextWidth(val);
    doc.setFont("helvetica", "bold").setFontSize(6.5);
    const wR = doc.getTextWidth(rot);
    const cw = Math.max(wV, wR) + 12;
    const cx = kx - cw;
    doc.setFillColor(...(alerta ? [70, 52, 26] : [40, 70, 50]));
    doc.setDrawColor(...(alerta ? [120, 90, 40] : [58, 90, 66])).setLineWidth(0.3).roundedRect(cx, 6, cw, 16, 3, 3, "FD");
    doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...(alerta ? [230, 190, 110] : CLARO));
    doc.text(rot, cx + cw / 2, 11, { align: "center" });
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...(alerta ? [244, 198, 105] : [255, 255, 255]));
    doc.text(val, cx + cw / 2, 19, { align: "center" });
    kx = cx - 5;
  });

  y = coverH + 8;

  // ── Tabela ──
  // Colunas (mm) somando ~ larg - 2*mx (273)
  const cols = [
    { rot: "PRODUTO", w: 46, al: "left" },
    { rot: "REFERÊNCIA", w: 30, al: "left" },
    { rot: "PEDIDO", w: 24, al: "left" },
    { rot: "EMISSÃO", w: 20, al: "left" },
    { rot: "QTD", w: 16, al: "right" },
    { rot: "CORTE", w: 16, al: "right" },
    { rot: "ENTREGA", w: 34, al: "left" },
    { rot: "OFICINA", w: 30, al: "left" },
    { rot: "OBSERVAÇÃO", w: 57, al: "left" },
  ];
  const larguraTabela = cols.reduce((a, c) => a + c.w, 0);
  const hLinha = 7;
  const RAIO = 3, BORDA = [231, 234, 228];

  const posX = (i) => mx + cols.slice(0, i).reduce((a, c) => a + c.w, 0);

  function cabecalhoTabela() {
    doc.setFillColor(246, 248, 244);
    doc.roundedRect(mx, y, larguraTabela, hLinha, RAIO, RAIO, "F");
    doc.rect(mx, y + hLinha - RAIO, larguraTabela, RAIO, "F");
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
    cols.forEach((c, i) => {
      const x = posX(i);
      doc.text(c.rot, c.al === "right" ? x + c.w - 3 : x + 3, y + 4.7, { align: c.al });
    });
    y += hLinha;
  }

  let tabTop = y;
  const fecha = () => { doc.setDrawColor(...BORDA).setLineWidth(0.4).roundedRect(mx, tabTop, larguraTabela, y - tabTop, RAIO, RAIO, "S"); };

  cabecalhoTabela();
  tabTop = y - hLinha;

  grupos.forEach((g) => {
    quebra(hLinha + 6);
    // faixa do grupo (marca)
    const cor = COR_SETOR[etapa] || VERDE;
    doc.setDrawColor(240, 243, 238).setLineWidth(0.3).line(mx, y, larg - mx, y);
    doc.setFillColor(250, 251, 249).rect(mx + 0.3, y + 0.15, larguraTabela - 0.6, 6.4, "F");
    doc.setFillColor(...cor).roundedRect(mx + 3, y + 1.8, 3, 3, 0.6, 0.6, "F");
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...TINTA);
    doc.text(g.marca, mx + 8, y + 4.6);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
    doc.text(`${g.itens.length} pedido(s) · ${g.pecas.toLocaleString("pt-BR")} peças`, mx + 8 + doc.getTextWidth(g.marca) + 4, y + 4.6);
    y += 6.6;

    g.itens.forEach((it, idx) => {
      const obsLinhas = it.obs ? doc.splitTextToSize(it.obs, cols[8].w - 4) : [];
      const hCel = Math.max(hLinha, 4 + obsLinhas.length * 3.4 + 2.5);
      quebra(hCel);
      if (idx % 2 === 1) { doc.setFillColor(250, 251, 249).rect(mx + 0.3, y, larguraTabela - 0.6, hCel, "F"); }
      if (it.atrasado) { doc.setFillColor(251, 236, 236).rect(mx + 0.3, y, larguraTabela - 0.6, hCel, "F"); }
      doc.setDrawColor(240, 243, 238).setLineWidth(0.3).line(mx, y, larg - mx, y);

      const baseY = y + 4.6;
      const val = (i, txt, bold, cor) => {
        doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(8).setTextColor(...(cor || [70, 68, 62]));
        const x = posX(i);
        const t = doc.splitTextToSize(String(txt), cols[i].w - 4)[0] || String(txt);
        doc.text(t, cols[i].al === "right" ? x + cols[i].w - 3 : x + 3, baseY, { align: cols[i].al });
      };
      val(0, it.produto || "—", true, TINTA);
      val(1, it.referencia || "—");
      val(2, it.pedido || "—");
      val(3, fmt(it.emissao));
      val(4, it.qtd, true, TINTA);
      val(5, it.corte);
      // entrega + prorrogação
      const ex = posX(6);
      if (it.novaEntrega) {
        doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
        const orig = fmt(it.entrega);
        doc.text(orig, ex + 3, baseY);
        const wo = doc.getTextWidth(orig);
        doc.setDrawColor(...CINZA).setLineWidth(0.3).line(ex + 3, baseY - 1, ex + 3 + wo, baseY - 1); // risco
        doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...VERMELHO);
        doc.text(`> ${fmt(it.novaEntrega)}`, ex + 3 + wo + 3, baseY);
      } else {
        doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...(it.atrasado ? VERMELHO : VERDE_ESCURO));
        doc.text(fmt(it.entrega), ex + 3, baseY);
      }
      val(7, it.oficina || "—");
      // observação (pode ter várias linhas)
      if (obsLinhas.length) {
        doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(...AMBAR_TXT);
        doc.text(obsLinhas, posX(8) + 3, baseY);
      }
      y += hCel;
    });
  });
  fecha();

  rodape();
  doc.save(`painel-${rotuloLocal(etapa).replace(/[^a-zA-Z0-9-_]/g, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
