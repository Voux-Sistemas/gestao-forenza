import { jsPDF } from "jspdf";
import { rotuloLocal } from "./etapas.js";
import { normalizarGrade, TAMANHOS_GRADE } from "./components/GradeTabela.jsx";

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
export async function gerarPdfEtapa({ pedido, cliente, local, qtd, parte, totalPartes, oficina, processos, remessasOficina, aviamentos, imagens }) {
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
  doc.text(`Romaneio de produção · ${rotuloLocal(local)}`, mx, y);
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

  // ── Grade de tamanhos (variante × tamanho, igual ao sistema) ──
  const linhasGrade = normalizarGrade(pedido.grade);
  if (linhasGrade.length > 0) {
    // Tamanhos usados por qualquer variante, na ordem oficial.
    const usados = TAMANHOS_GRADE.filter((t) => linhasGrade.some((l) => (parseInt(l.qtds[t], 10) || 0) > 0));
    const extras = [];
    linhasGrade.forEach((l) => Object.keys(l.qtds).forEach((t) => {
      if (!TAMANHOS_GRADE.includes(t) && !extras.includes(t) && (parseInt(l.qtds[t], 10) || 0) > 0) extras.push(t);
    }));
    const cols = [...usados, ...extras];
    const temVariante = linhasGrade.some((l) => (l.variante || "").trim());

    if (cols.length > 0) {
      const hLinha = 8;
      quebraSePreciso(16 + linhasGrade.length * hLinha);
      doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
      doc.text("GRADE DE TAMANHOS", mx, y);
      y += 5;

      const larguraTabela = larg - mx * 2;
      const colVar = temVariante ? 34 : 0;
      const colTotal = 20;
      const cw = (larguraTabela - colVar - colTotal) / cols.length;

      const totalTam = (t) => linhasGrade.reduce((a, l) => a + (parseInt(l.qtds[t], 10) || 0), 0);
      const totalLinha = (l) => cols.reduce((a, t) => a + (parseInt(l.qtds[t], 10) || 0), 0);
      const geral = linhasGrade.reduce((a, l) => a + totalLinha(l), 0);

      // Helper de célula: reseta cor a cada chamada (evita blocos cinza fantasmas).
      const celula = (cx, cy, cwid, texto, { header, fill, corTexto, bold, alinhar } = {}) => {
        if (fill) { doc.setFillColor(...fill); doc.rect(cx, cy, cwid, hLinha, "F"); }
        doc.setDrawColor(214).setLineWidth(0.25).rect(cx, cy, cwid, hLinha, "S");
        doc.setFont("helvetica", bold === false ? "normal" : "bold").setFontSize(header ? 7.5 : 9.5).setTextColor(...(corTexto || TINTA));
        doc.text(String(texto), alinhar === "left" ? cx + 3 : cx + cwid / 2, cy + 5.3, { align: alinhar === "left" ? "left" : "center" });
      };

      // Cabeçalho
      let x = mx;
      if (temVariante) { celula(x, y, colVar, "VARIANTE", { header: true, fill: [244, 244, 241], corTexto: CINZA, alinhar: "left" }); x += colVar; }
      cols.forEach((t) => { celula(x, y, cw, t, { header: true, fill: [244, 244, 241], corTexto: CINZA }); x += cw; });
      celula(x, y, colTotal, "TOTAL", { header: true, fill: [237, 247, 242], corTexto: VERDE_ESCURO });
      y += hLinha;

      // Linhas de variantes
      linhasGrade.forEach((l) => {
        x = mx;
        if (temVariante) { celula(x, y, colVar, l.variante || "—", { corTexto: TINTA, alinhar: "left" }); x += colVar; }
        cols.forEach((t) => {
          const q = parseInt(l.qtds[t], 10) || 0;
          celula(x, y, cw, q || "·", { corTexto: q ? TINTA : [190, 190, 185], bold: !!q });
          x += cw;
        });
        celula(x, y, colTotal, totalLinha(l), { fill: [250, 250, 248], corTexto: VERDE_ESCURO });
        y += hLinha;
      });

      // Linha de total (só se houver variantes ou mais de uma linha)
      if (temVariante || linhasGrade.length > 1) {
        x = mx;
        if (temVariante) { celula(x, y, colVar, "TOTAL", { fill: [244, 244, 241], corTexto: CINZA, alinhar: "left" }); x += colVar; }
        cols.forEach((t) => { celula(x, y, cw, totalTam(t), { fill: [244, 244, 241], corTexto: VERDE_ESCURO }); x += cw; });
        celula(x, y, colTotal, geral, { fill: [237, 247, 242], corTexto: VERDE_ESCURO });
        y += hLinha;
      }
      y += 13;
    }
  }

  // ── Rastreio dos processos da etapa (trilha visual) ──
  if (processos && processos.length > 0) {
    quebraSePreciso(14);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text(`PROCESSOS — ${rotuloLocal(local).toUpperCase()}`, mx, y);
    y += 7;

    const cx = mx + 3; // centro das bolinhas (eixo da trilha)
    let topoAnterior = 0;
    processos.forEach(({ nome, qtd: feitas, grade, obs }, idx) => {
      const obsLinhas = obs ? doc.splitTextToSize(`Obs: ${obs}`, larg - mx * 2 - 14) : [];
      const temGrade = grade && Object.entries(grade).some(([, q]) => (parseInt(q, 10) || 0) > 0);
      const alturaItem = 6 + (temGrade ? 4.5 : 0) + obsLinhas.length * 4 + 5;
      quebraSePreciso(alturaItem);

      const completo = feitas >= pedido.total;
      const parcial = feitas > 0 && !completo;
      const cor = completo ? VERDE : parcial ? AMBAR : [190, 190, 185];
      const topo = y - 1.6;

      // Linha da trilha ligando à bolinha anterior.
      if (idx > 0) {
        doc.setDrawColor(215).setLineWidth(0.5).line(cx, topoAnterior + 2.2, cx, topo - 2.2);
      }

      // Bolinha do processo.
      if (completo) {
        doc.setFillColor(...VERDE).circle(cx, topo, 2.2, "F");
        doc.setDrawColor(255).setLineWidth(0.5);
        doc.line(cx - 1, topo, cx - 0.2, topo + 0.9); doc.line(cx - 0.2, topo + 0.9, cx + 1.1, topo - 0.8); // check
      } else if (parcial) {
        doc.setFillColor(...AMBAR).circle(cx, topo, 2.2, "F");
        doc.setFillColor(255).circle(cx, topo, 0.8, "F");
      } else {
        doc.setFillColor(255).setDrawColor(...cor).setLineWidth(0.5).circle(cx, topo, 2.2, "FD");
      }

      // Nome + contagem.
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...(completo || parcial ? TINTA : CINZA));
      doc.text(nome, cx + 6, y);
      doc.setFont("helvetica", "bold").setTextColor(...(completo ? VERDE_ESCURO : parcial ? AMBAR : CINZA));
      doc.text(`${feitas}/${pedido.total}`, larg - mx, y, { align: "right" });

      // Mini barra de progresso.
      const pct = Math.max(0, Math.min(1, feitas / (pedido.total || 1)));
      const barX = cx + 6, barW = larg - mx - barX - 20, barY = y + 1.8;
      doc.setFillColor(235, 235, 231).roundedRect(barX, barY, barW, 1.4, 0.7, 0.7, "F");
      if (pct > 0) { doc.setFillColor(...cor).roundedRect(barX, barY, barW * pct, 1.4, 0.7, 0.7, "F"); }
      y += 6;

      if (temGrade) {
        const partes = Object.entries(grade).filter(([, q]) => (parseInt(q, 10) || 0) > 0).map(([t, q]) => `${t}: ${q}`);
        doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
        doc.text("Por tamanho — " + partes.join("   "), cx + 6, y);
        y += 4.5;
      }
      if (obsLinhas.length) {
        doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(...CINZA);
        doc.text(obsLinhas, cx + 6, y);
        y += obsLinhas.length * 4;
      }
      topoAnterior = topo;
      y += 5;
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
    const hLinha = 7;
    quebraSePreciso(18 + remessasOficina.length * hLinha);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text("REMESSAS DE OFICINA", mx, y);
    y += 5;

    const larguraTabela = larg - mx * 2;
    // oficina | saída | retorno | enviadas | retorn.
    const cols = [larguraTabela * 0.30, larguraTabela * 0.20, larguraTabela * 0.20, larguraTabela * 0.15, larguraTabela * 0.15];
    const fmtD = (d) => {
      if (!d) return "—";
      const dt = /^\d{4}-\d{2}-\d{2}/.test(d) ? new Date(d.slice(0, 10) + "T12:00") : new Date(d);
      return isNaN(dt) ? "—" : dt.toLocaleDateString("pt-BR");
    };
    const headers = ["OFICINA", "SAÍDA", "RETORNO", "ENVIADAS", "RETORN."];

    // Cabeçalho em faixa
    doc.setFillColor(244, 244, 241).rect(mx, y, larguraTabela, hLinha, "F");
    let x = mx;
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
    headers.forEach((h, i) => {
      const alinhar = i >= 3 ? "right" : "left";
      doc.text(h, alinhar === "right" ? x + cols[i] - 3 : x + 3, y + 4.7, { align: alinhar });
      x += cols[i];
    });
    y += hLinha;

    remessasOficina.forEach((r, idx) => {
      quebraSePreciso(hLinha);
      const emAberto = !r.retorno;
      // Zebra
      if (idx % 2 === 1) { doc.setFillColor(250, 250, 248).rect(mx, y, larguraTabela, hLinha, "F"); }
      const vals = [r.oficina, fmtD(r.saida), emAberto ? "em aberto" : fmtD(r.retorno), String(r.enviada), String(r.retornada)];
      x = mx;
      vals.forEach((v, i) => {
        const alinhar = i >= 3 ? "right" : "left";
        doc.setFont("helvetica", i === 0 ? "bold" : "normal").setFontSize(8.5).setTextColor(...(emAberto ? AMBAR : i === 0 ? TINTA : [90, 88, 82]));
        const txt = i === 0 ? (doc.splitTextToSize(v, cols[i] - 4)[0] || v) : v;
        doc.text(txt, alinhar === "right" ? x + cols[i] - 3 : x + 3, y + 4.8, { align: alinhar });
        x += cols[i];
      });
      y += hLinha;
    });
    // Borda inferior da tabela
    doc.setDrawColor(225).setLineWidth(0.25).line(mx, y, larg - mx, y);
    y += 8;
  }

  // ── Aviamentos (para a etapa Aviamento) ──
  if (aviamentos && aviamentos.length > 0) {
    const hLinha = 7;
    quebraSePreciso(16 + aviamentos.length * hLinha);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text("AVIAMENTOS", mx, y);
    y += 5;

    const larguraTabela = larg - mx * 2;
    const colItem = larguraTabela * 0.32;
    const colDet = larguraTabela * 0.48;
    const colQtd = larguraTabela * 0.20;

    // Cabeçalho em faixa
    doc.setFillColor(244, 244, 241).rect(mx, y, larguraTabela, hLinha, "F");
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
    doc.text("ITEM", mx + 3, y + 4.7);
    doc.text("ESPECIFICAÇÃO", mx + colItem + 3, y + 4.7);
    doc.text("QTD", larg - mx - 3, y + 4.7, { align: "right" });
    y += hLinha;

    aviamentos.forEach((a, idx) => {
      quebraSePreciso(hLinha);
      // Descrição conforme o tipo.
      const partes = [];
      if (a.largura) partes.push(`largura ${a.largura}`);
      if (a.tipoCampo === "ziper") {
        if (a.tipo) partes.push(a.tipo);
        if (a.tamanho) partes.push(a.tamanho);
      } else if (a.tamanho) {
        partes.push(`tam. ${a.tamanho}`);
      }
      if (a.consumo) partes.push(`consumo ${a.consumo}`);
      const detalhe = partes.join(" · ") || "—";

      if (idx % 2 === 1) { doc.setFillColor(250, 250, 248).rect(mx, y, larguraTabela, hLinha, "F"); }
      doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...TINTA);
      doc.text(a.nome, mx + 3, y + 4.8);
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
      doc.text(doc.splitTextToSize(detalhe, colDet - 4)[0] || detalhe, mx + colItem + 3, y + 4.8);
      if (a.qtd) {
        doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...TINTA);
        doc.text(String(a.qtd), larg - mx - 3, y + 4.8, { align: "right" });
      }
      y += hLinha;
    });
    doc.setDrawColor(225).setLineWidth(0.25).line(mx, y, larg - mx, y);
    y += 8;
  }

  // ── Imagens anexadas (referência e amostra) ──
  const imgs = [];
  for (const it of (imagens || [])) {
    if (!it.url) continue;
    const carregada = await carregarImagem(it.url);
    if (carregada) imgs.push({ ...carregada, rotulo: it.rotulo });
  }
  if (imgs.length > 0) {
    const larguraCol = (larg - mx * 2 - 8) / 2; // duas por linha
    // Altura da primeira imagem (para garantir que o título não fique órfão).
    const primeira = imgs[0];
    const escala0 = Math.min(larguraCol / primeira.w, 55 / primeira.h);
    const h0 = primeira.h * escala0;
    // Título + primeira imagem precisam caber JUNTOS na mesma página.
    quebraSePreciso(6 + 6 + h0 + 6);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text("IMAGENS", mx, y);
    y += 6;
    let x = mx;
    let alturaLinha = 0;
    imgs.forEach((im, i) => {
      const escala = Math.min(larguraCol / im.w, 55 / im.h); // cabe na coluna, máx ~55mm de altura
      const w = im.w * escala;
      const h = im.h * escala;
      // Só quebra a partir da 2ª imagem (a 1ª já foi garantida junto com o título).
      if (i % 2 === 0) { if (i > 0) quebraSePreciso(h + 10); x = mx; }
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
