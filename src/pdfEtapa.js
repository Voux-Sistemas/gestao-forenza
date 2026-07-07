import { jsPDF } from "jspdf";
import { rotuloLocal } from "./etapas.js";
import { gradePorTamanho } from "./components/GradeTabela.jsx";

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

// Baixa uma imagem por URL e devolve { dataUrl, w, h } para embutir no PDF. Null se falhar.
async function carregarImagem(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    const dim = await new Promise((res) => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => res(null);
      img.src = dataUrl;
    });
    if (!dim) return null;
    const fmt = /png/i.test(blob.type) ? "PNG" : "JPEG";
    return { dataUrl, w: dim.w, h: dim.h, fmt };
  } catch { return null; }
}

// Gera o romaneio em PDF das peças de um pedido em uma etapa.
export async function gerarPdfEtapa({ pedido, cliente, local, qtd, parte, totalPartes, oficina, processos, remessasOficina, imagens }) {
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
  const gradeTam = gradePorTamanho(pedido.grade);
  if (Object.keys(gradeTam).length > 0) {
    const entradas = Object.entries(gradeTam);
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

  // ── Remessas de oficina (para a etapa Oficina) ──
  if (remessasOficina && remessasOficina.length > 0) {
    quebraSePreciso(14 + remessasOficina.length * 7);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text("REMESSAS DE OFICINA", mx, y);
    y += 5;
    const cols = [50, 30, 30, 24, 24]; // oficina, saída, retorno, enviadas, retorn.
    const fmtD = (d) => {
      if (!d) return "—";
      const dt = /^\d{4}-\d{2}-\d{2}/.test(d) ? new Date(d.slice(0, 10) + "T12:00") : new Date(d);
      return isNaN(dt) ? "—" : dt.toLocaleDateString("pt-BR");
    };
    // cabeçalho
    let x = mx;
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...CINZA);
    ["Oficina", "Saída", "Retorno", "Enviadas", "Retorn."].forEach((h, i) => {
      const alinhar = i >= 3 ? "right" : "left";
      doc.text(h, alinhar === "right" ? x + cols[i] - 2 : x, y, { align: alinhar });
      x += cols[i];
    });
    y += 5;
    remessasOficina.forEach((r) => {
      quebraSePreciso(7);
      x = mx;
      const vals = [r.oficina, fmtD(r.saida), r.retorno ? fmtD(r.retorno) : "em aberto", String(r.enviada), String(r.retornada)];
      const emAberto = !r.retorno;
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...(emAberto ? AMBAR : TINTA));
      vals.forEach((v, i) => {
        const alinhar = i >= 3 ? "right" : "left";
        const txt = i === 0 ? (doc.splitTextToSize(v, cols[i] - 2)[0] || v) : v;
        doc.text(txt, alinhar === "right" ? x + cols[i] - 2 : x, y, { align: alinhar });
        x += cols[i];
      });
      y += 5;
      doc.setDrawColor(235).setLineWidth(0.2).line(mx, y - 1.5, larg - mx, y - 1.5);
    });
    y += 5;
  }

  // ── Imagens anexadas (referência e amostra) ──
  const imgs = [];
  for (const it of (imagens || [])) {
    if (!it.url) continue;
    const carregada = await carregarImagem(it.url);
    if (carregada) imgs.push({ ...carregada, rotulo: it.rotulo });
  }
  if (imgs.length > 0) {
    quebraSePreciso(12);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text("IMAGENS", mx, y);
    y += 6;
    const larguraCol = (larg - mx * 2 - 8) / 2; // duas por linha
    let x = mx;
    let alturaLinha = 0;
    imgs.forEach((im, i) => {
      const escala = Math.min(larguraCol / im.w, 55 / im.h); // cabe na coluna, máx ~55mm de altura
      const w = im.w * escala;
      const h = im.h * escala;
      if (i % 2 === 0) { quebraSePreciso(h + 10); x = mx; }
      doc.setDrawColor(210).setLineWidth(0.3).rect(x, y, w, h, "S");
      try { doc.addImage(im.dataUrl, im.fmt, x, y, w, h); } catch { /* ignora imagem inválida */ }
      if (im.rotulo) {
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
        doc.text(im.rotulo, x, y + h + 4);
      }
      alturaLinha = Math.max(alturaLinha, h);
      if (i % 2 === 1 || i === imgs.length - 1) { y += alturaLinha + 10; alturaLinha = 0; }
      else { x += larguraCol + 8; }
    });
  }

  rodape();
  const limpar = (t) => String(t || "").replace(/[^a-zA-Z0-9-_]/g, "_");
  doc.save(`${limpar(pedido.referencia) || "pedido"}-${limpar(rotuloLocal(local))}${totalPartes > 1 ? `-parte${parte}de${totalPartes}` : ""}.pdf`);
}
