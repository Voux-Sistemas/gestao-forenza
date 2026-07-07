import { jsPDF } from "jspdf";
import { rotuloLocal } from "./etapas.js";

const TINTA = [38, 37, 30];        // quase-preto da marca
const VERDE = [29, 158, 117];      // verde do ponto da logo
const VERDE_ESCURO = [8, 80, 65];  // verde profundo
const AMBAR = [186, 117, 23];
const CINZA = [130, 128, 120];

const fmtData = (d) => {
  if (!d) return null;
  const data = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T12:00") : new Date(d);
  return isNaN(data) ? null : data.toLocaleDateString("pt-BR");
};

// Gera o romaneio em PDF das peças de um pedido em uma etapa.
export function gerarPdfEtapa({ pedido, cliente, local, qtd, parte, totalPartes, oficina, processos }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const larg = doc.internal.pageSize.getWidth();
  const mx = 16;
  let y = 18;

  const rodape = () => {
    doc.setDrawColor(225).setLineWidth(0.2).line(mx, 287, larg - mx, 287);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
    doc.text("Gerado pelo sistema Forenza — Gestão de produção", mx, 291.5);
    doc.text(`Página ${doc.getNumberOfPages()}`, larg - mx, 291.5, { align: "right" });
  };
  const quebraSePreciso = (altura) => {
    if (y + altura > 280) { rodape(); doc.addPage(); y = 18; }
  };

  // ── Cabeçalho: marca vetorial (anel + ponto verde) + FORENZA ──
  doc.setDrawColor(...TINTA).setLineWidth(1.5).circle(mx + 5.5, y, 5.5, "S");
  doc.setFillColor(...VERDE).circle(mx + 5.5, y, 2.4, "F");
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...TINTA);
  doc.text("F O R E N Z A", mx + 15, y - 0.5);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
  doc.text("Gestão de produção", mx + 15, y + 4.5);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`, larg - mx, y - 1.5, { align: "right" });
  if (totalPartes > 1) {
    const txt = `PARTE ${parte} DE ${totalPartes}`;
    doc.setFont("helvetica", "bold").setFontSize(8);
    const w = doc.getTextWidth(txt) + 8;
    doc.setFillColor(...VERDE_ESCURO).roundedRect(larg - mx - w, y + 1.5, w, 6.5, 3.2, 3.2, "F");
    doc.setTextColor(255).text(txt, larg - mx - w / 2, y + 6, { align: "center" });
  }
  y += 12;
  doc.setDrawColor(...VERDE_ESCURO).setLineWidth(0.7).line(mx, y, larg - mx, y);
  y += 11;

  // ── Título + destaque da quantidade ──
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...TINTA);
  doc.text("Romaneio de produção", mx, y);
  y += 8;
  doc.setFillColor(237, 247, 242);
  doc.roundedRect(mx, y, larg - mx * 2, 19, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold").setFontSize(21).setTextColor(...VERDE_ESCURO);
  const qtdTxt = `${qtd} peças`;
  const largQtd = doc.getTextWidth(qtdTxt); // medir com a fonte grande, antes de trocar
  doc.text(qtdTxt, mx + 7, y + 12.5);
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(90);
  doc.text(`em ${rotuloLocal(local)}`, mx + 10 + largQtd, y + 12.5);
  doc.setFontSize(9.5).setTextColor(...CINZA);
  doc.text(`pedido completo: ${pedido.total} peças`, larg - mx - 7, y + 12, { align: "right" });
  y += 28;

  // ── Informações em duas colunas ──
  const campos = [
    ["Referência", pedido.referencia],
    ["Cliente", cliente],
    ["Marca", pedido.marca],
    ["Oficina responsável", oficina],
    ["Criado em", fmtData(pedido.created_at)],
    ["Prazo de entrega", fmtData(pedido.prazo)],
    ["Cor", pedido.cor],
    ["Peso", pedido.peso],
    ["Volume", pedido.volume],
  ].filter(([, v]) => v);
  const colLarg = (larg - mx * 2 - 10) / 2;
  campos.forEach(([rotulo, valor], i) => {
    const col = i % 2;
    const x = mx + col * (colLarg + 10);
    if (col === 0) quebraSePreciso(8);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
    doc.text(String(rotulo).toUpperCase(), x, y);
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...TINTA);
    doc.text(doc.splitTextToSize(String(valor), colLarg)[0] || "", x, y + 4.5);
    if (col === 1 || i === campos.length - 1) y += 11;
  });
  y += 3;

  // ── Grade (tabela) ──
  if (pedido.grade && Object.keys(pedido.grade).length > 0) {
    const entradas = Object.entries(pedido.grade);
    quebraSePreciso(14 + entradas.length * 7);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text("GRADE DE TAMANHOS (PEDIDO COMPLETO)", mx, y);
    y += 4;
    const tw = 100;
    doc.setFillColor(244, 244, 241).setDrawColor(210).setLineWidth(0.25);
    doc.rect(mx, y, tw, 6.5, "FD");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...CINZA);
    doc.text("TAMANHO", mx + 3, y + 4.3);
    doc.text("QUANTIDADE", mx + tw - 3, y + 4.3, { align: "right" });
    y += 6.5;
    entradas.forEach(([t, q]) => {
      doc.setDrawColor(220).rect(mx, y, tw, 6.5, "S");
      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...TINTA);
      doc.text(String(t), mx + 3, y + 4.4);
      doc.setTextColor(...VERDE_ESCURO);
      doc.text(String(q), mx + tw - 3, y + 4.4, { align: "right" });
      y += 6.5;
    });
    doc.setFillColor(237, 247, 242).setDrawColor(210).rect(mx, y, tw, 6.5, "FD");
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text("TOTAL", mx + 3, y + 4.4);
    doc.text(String(entradas.reduce((a, [, q]) => a + (parseInt(q, 10) || 0), 0)), mx + tw - 3, y + 4.4, { align: "right" });
    y += 13;
  }

  // ── Rastreio dos processos da etapa ──
  if (processos && processos.length > 0) {
    quebraSePreciso(12);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text(`PROCESSOS — ${rotuloLocal(local).toUpperCase()}`, mx, y);
    y += 6;
    processos.forEach(({ nome, qtd: feitas, grade, obs }) => {
      const obsLinhas = obs ? doc.splitTextToSize(`Obs: ${obs}`, larg - mx * 2 - 12) : [];
      quebraSePreciso(7 + obsLinhas.length * 4);
      const completo = feitas >= pedido.total;
      const parcial = feitas > 0 && !completo;
      if (completo) doc.setFillColor(...VERDE).circle(mx + 2, y - 1, 1.8, "F");
      else if (parcial) doc.setFillColor(...AMBAR).circle(mx + 2, y - 1, 1.8, "F");
      else doc.setDrawColor(170).setLineWidth(0.4).circle(mx + 2, y - 1, 1.8, "S");
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...TINTA);
      doc.text(nome, mx + 7, y);
      doc.setTextColor(...(completo ? VERDE_ESCURO : parcial ? AMBAR : CINZA));
      doc.text(`${feitas}/${pedido.total}`, larg - mx, y, { align: "right" });
      y += 4.5;
      if (grade && Object.keys(grade).length > 0) {
        const partes = Object.entries(grade).filter(([, q]) => (parseInt(q, 10) || 0) > 0).map(([t, q]) => `${t}: ${q}`);
        if (partes.length) {
          doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
          const gl = doc.splitTextToSize("Por tamanho — " + partes.join("   "), larg - mx * 2 - 7);
          doc.text(gl, mx + 7, y);
          y += gl.length * 4;
        }
      }
      if (obsLinhas.length) {
        doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(...CINZA);
        doc.text(obsLinhas, mx + 7, y);
        y += obsLinhas.length * 4;
      }
      doc.setDrawColor(232).setLineWidth(0.2).line(mx, y, larg - mx, y);
      y += 4.5;
    });
    y += 2;
  }

  // ── Observações gerais ──
  if (pedido.observacoes) {
    const linhas = doc.splitTextToSize(pedido.observacoes, larg - mx * 2 - 10);
    quebraSePreciso(14 + linhas.length * 4.6);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text("OBSERVAÇÕES DO PEDIDO", mx, y);
    y += 4;
    doc.setFillColor(248, 248, 246).roundedRect(mx, y, larg - mx * 2, linhas.length * 4.6 + 6, 2, 2, "F");
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(60);
    doc.text(linhas, mx + 5, y + 6);
    y += linhas.length * 4.6 + 12;
  }

  rodape();
  const limpar = (t) => String(t || "").replace(/[^a-zA-Z0-9-_]/g, "_");
  doc.save(`${limpar(pedido.referencia) || "pedido"}-${limpar(rotuloLocal(local))}${totalPartes > 1 ? `-parte${parte}de${totalPartes}` : ""}.pdf`);
}
