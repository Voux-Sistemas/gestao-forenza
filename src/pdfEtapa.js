import { jsPDF } from "jspdf";
import { rotuloLocal } from "./etapas.js";
import { normalizarGrade, TAMANHOS_GRADE } from "./components/GradeTabela.jsx";

const TINTA = [38, 37, 30];        // quase-preto da marca
const VERDE = [29, 158, 117];      // verde do ponto da logo
const VERDE_ESCURO = [8, 80, 65];  // verde profundo
const AMBAR = [186, 117, 23];
const CINZA = [130, 128, 120];

// Cores por setor para o selo do topo (RGB, equivalentes às do sistema).
const COR_SETOR = {
  "Entrada": [130, 128, 120],
  "Ficha Técnica de Corte": [14, 138, 138],
  "Corte": [45, 108, 179],
  "Amostra": [196, 60, 122],
  "Oficina": [186, 117, 23],
  "Aviação": [107, 95, 196],
  "Acabamento": [217, 101, 12],
  "Estoque": [23, 138, 90],
};
const corDoSetor = (local) => COR_SETOR[local] || VERDE;

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

// Desenha a folha de romaneio de UM pedido no `doc` recebido, começando numa
// página já em branco. Não cria o documento, não renumera e não salva —
// isso fica a cargo de quem chama (permite juntar vários pedidos num PDF só).
async function desenharPedidoNoPdf(doc, { pedido, cliente, local, qtd, parte, totalPartes, oficina, processos, remessasOficina, aviamentos, imagens, classificacao, historico, dossie, processosAcabamento, linhaTempo }) {
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

  // Título de seção: caixa verde-clara com texto centralizado verticalmente. Avança y.
  let secaoN = 0;
  const tituloSecao = (texto, sufixo) => {
    secaoN += 1;
    const num = String(secaoN).padStart(2, "0");
    const boxSize = 6;
    const boxTop = y;
    const base = boxTop + boxSize * 0.73;
    const meio = boxTop + boxSize / 2;
    // Quadradinho suave verde-claro com o número em verde (harmoniza com a marca)
    doc.setFillColor(233, 244, 228).roundedRect(mx, boxTop, boxSize, boxSize, 2, 2, "F");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...VERDE_ESCURO);
    doc.text(num, mx + boxSize / 2, base, { align: "center" });
    // Título
    const titleX = mx + boxSize + 4;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...TINTA);
    doc.text(texto, titleX, base);
    const titleW = doc.getTextWidth(texto);
    // Sufixo à direita
    let fimRegua = larg - mx;
    if (sufixo) {
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
      doc.text(sufixo, larg - mx, base, { align: "right" });
      fimRegua = larg - mx - doc.getTextWidth(sufixo) - 5;
    }
    // Régua fina e clara
    const inicioRegua = titleX + titleW + 5;
    if (fimRegua > inicioRegua) {
      doc.setDrawColor(232, 235, 229).setLineWidth(0.3).line(inicioRegua, meio, fimRegua, meio);
    }
    y = boxTop + boxSize + 7;
  };

  // ══════════════════ CAPA (degradê suave, compacta) ══════════════════
  const coverH = 46;
  const CAPA_A = [22, 55, 32], CAPA_B = [30, 72, 43];   // baixo contraste: sem faixas visíveis
  const CLARO = [167, 204, 174], FAINT = [127, 163, 135];
  const ANEL = [111, 208, 138];
  const CARD_BG = [45, 82, 56], CARD_BORDA = [60, 94, 70], CARD_DIV = [60, 94, 70];
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
  }
  // fio de acabamento: âmbar desvanecendo para o verde
  {
    const fioH = 1.2, fioY = coverH - fioH;
    const FIO_BASE = [18, 44, 26];
    doc.setFillColor(...FIO_BASE).rect(0, fioY, larg, fioH, "F");
    const fadeW = larg * 0.55, nF = 120, wF = fadeW / nF;
    for (let i = 0; i < nF; i++) {
      const t = i / (nF - 1);
      doc.setFillColor(
        Math.round(AMBAR_CAPA[0] + (FIO_BASE[0] - AMBAR_CAPA[0]) * t),
        Math.round(AMBAR_CAPA[1] + (FIO_BASE[1] - AMBAR_CAPA[1]) * t),
        Math.round(AMBAR_CAPA[2] + (FIO_BASE[2] - AMBAR_CAPA[2]) * t)
      );
      doc.rect(i * wF - 0.2, fioY, wF + 0.6, fioH, "F");
    }
  }

  // ── LINHA 1 · marca (esq) ↔ documento (dir) ──
  const yM = 11;
  doc.setDrawColor(255).setLineWidth(1.1).circle(mx + 4.3, yM, 4.3, "S");
  doc.setFillColor(...ANEL).circle(mx + 4.3, yM, 1.9, "F");
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(255);
  doc.setCharSpace(1.4); doc.text("FORENZA", mx + 11.5, yM - 0.4); doc.setCharSpace(0);
  doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...FAINT);
  doc.setCharSpace(0.4); doc.text("GESTÃO DE PRODUÇÃO", mx + 12, yM + 3.6); doc.setCharSpace(0);

  // título do documento — largura real com charSpace, pra alinhar de fato na margem
  const docTitulo = dossie ? "DOSSIÊ DO PEDIDO" : "ROMANEIO DE PRODUÇÃO";
  const docCS = 0.6;
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...CLARO);
  const wDocTit = doc.getTextWidth(docTitulo) + docCS * Math.max(0, docTitulo.length - 1);
  doc.setCharSpace(docCS); doc.text(docTitulo, larg - mx - wDocTit, yM - 1.6); doc.setCharSpace(0);
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...FAINT);
  doc.text(`Emitido ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`, larg - mx, yM + 2.4, { align: "right" });

  // chip da etapa
  const eyebrow = (dossie ? "DOSSIÊ" : rotuloLocal(local)).toUpperCase();
  const eyeCS = 0.5;
  doc.setFont("helvetica", "bold").setFontSize(7.5);
  const wTxtEye = doc.getTextWidth(eyebrow) + eyeCS * Math.max(0, eyebrow.length - 1);
  const padEye = 5.5, eyeH = 6.2;
  const wEye = wTxtEye + padEye * 2;
  const eyeX = larg - mx - wEye, eyeY = yM + 5.6;
  doc.setFillColor(...AMBAR_CAPA).roundedRect(eyeX, eyeY, wEye, eyeH, eyeH / 2, eyeH / 2, "F");
  doc.setTextColor(28, 22, 8).setCharSpace(eyeCS);
  doc.text(eyebrow, eyeX + padEye, eyeY + eyeH * 0.665);
  doc.setCharSpace(0);
  if (totalPartes > 1) { doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...ANEL); doc.text(`PARTE ${parte} DE ${totalPartes}`, larg - mx, eyeY + eyeH + 4, { align: "right" }); }

  // ── LINHA 2 · identidade (esq) ↔ cartão KPI achatado (dir) ──
  let concl = 0, totProc = 0;
  [processos, processosAcabamento].forEach((l) => { if (l && l.length) { totProc += l.length; concl += l.filter((p) => p.qtd >= pedido.total).length; } });
  const temProg = totProc > 0;
  const pctProg = temProg ? concl / totProc : 0;

  const numTxt = String(dossie ? pedido.total : qtd);
  doc.setFont("helvetica", "bold").setFontSize(15);
  const wNum = doc.getTextWidth(numTxt);
  doc.setFont("helvetica", "bold").setFontSize(6.5);
  const kpiCS = 0.3;
  const kpiRot = "TOTAL DE PEÇAS";
  const wRotKpi = doc.getTextWidth(kpiRot) + kpiCS * (kpiRot.length - 1);
  const padCard = 5.5, anelR = 4.3;
  const cardH = 12;
  const cardW = padCard + wRotKpi + 3.5 + 0.3 + 3.5 + wNum + (temProg ? 3.5 + 0.3 + 3.5 + anelR * 2 : 0) + padCard;
  const cardX = larg - mx - cardW;
  const cardY = coverH - 6 - cardH;
  doc.setFillColor(...CARD_BG).setDrawColor(...CARD_BORDA).setLineWidth(0.35).roundedRect(cardX, cardY, cardW, cardH, cardH / 2, cardH / 2, "FD");
  // rótulo — baseline própria para ficar centralizado na vertical (cap 6.5pt ≈ 1.65mm)
  doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...CLARO);
  doc.setCharSpace(kpiCS); doc.text(kpiRot, cardX + padCard, cardY + cardH / 2 + 0.85); doc.setCharSpace(0);
  // divisória fina
  const div1X = cardX + padCard + wRotKpi + 3.5;
  doc.setDrawColor(...CARD_DIV).setLineWidth(0.3).line(div1X, cardY + 3, div1X, cardY + cardH - 3);
  // número — baseline própria (cap 15pt ≈ 3.8mm)
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(255);
  doc.text(numTxt, div1X + 0.3 + 3.5, cardY + cardH / 2 + 1.9);
  if (temProg) {
    const div2X = div1X + 0.3 + 3.5 + wNum + 3.5;
    doc.setDrawColor(...CARD_DIV).setLineWidth(0.3).line(div2X, cardY + 3, div2X, cardY + cardH - 3);
    const aCx = div2X + 0.3 + 3.5 + anelR, aCy = cardY + cardH / 2;
    doc.setDrawColor(52, 86, 62).setLineWidth(1.4).circle(aCx, aCy, anelR, "S");
    doc.setDrawColor(...ANEL).setLineWidth(1.4); doc.setLineCap("round");
    const segs = Math.max(1, Math.round(48 * pctProg));
    for (let i = 0; i < segs; i++) {
      const a0 = -Math.PI / 2 + 2 * Math.PI * pctProg * (i / segs);
      const a1 = -Math.PI / 2 + 2 * Math.PI * pctProg * ((i + 1) / segs);
      doc.line(aCx + anelR * Math.cos(a0), aCy + anelR * Math.sin(a0), aCx + anelR * Math.cos(a1), aCy + anelR * Math.sin(a1));
    }
    doc.setLineCap("butt");
    doc.setFont("helvetica", "bold").setFontSize(5.8).setTextColor(255);
    doc.text(`${Math.round(pctProg * 100)}%`, aCx, aCy + 0.9, { align: "center" });
  }

  // identidade (esquerda) — base alinhada com o cartão
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(255);
  const heroLarg = cardX - mx - 10;
  doc.text(doc.splitTextToSize(String(cliente || pedido.referencia || "—"), heroLarg > 40 ? heroLarg : 90)[0] || "—", mx, cardY + 1.5);
  let metaX = mx;
  [["REFERÊNCIA", pedido.referencia], ["ID DO CORTE", pedido.corte_id]].filter(([, v]) => v).forEach(([rot, val]) => {
    doc.setFont("helvetica", "bold").setFontSize(6.3).setTextColor(...FAINT).setCharSpace(0.35);
    doc.text(rot, metaX, cardY + 7.2);
    const wRot = doc.getTextWidth(rot) + rot.length * 0.35;
    doc.setCharSpace(0);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(234, 243, 236);
    doc.text(String(val), metaX, cardY + 12);
    metaX += Math.max(wRot, doc.getTextWidth(String(val))) + 11;
  });

  y = coverH + 11;

  // ── Informações em três colunas ──
  const campos = [
    ["Referência", pedido.referencia],
    ["ID de corte", pedido.corte_id],
    ["Nota fiscal", pedido.nota_fiscal],
    ["Cliente", cliente],
    ["Marca", pedido.marca],
    ["Oficina responsável", oficina],
    ["Criado em", fmtData(pedido.created_at)],
    ["Prazo de entrega", fmtData(pedido.prazo)],
    ["Arquivado em", dossie ? fmtData(pedido.arquivado_em) : null],
    ["Cor", pedido.cor],
    ["Peso", pedido.peso],
    ["Volume", pedido.volume],
  ].filter(([, v]) => v);
  const gapCol = 8;
  const colLarg = (larg - mx * 2 - gapCol * 2) / 3;
  campos.forEach(([rotulo, valor], i) => {
    const col = i % 3;
    const x = mx + col * (colLarg + gapCol);
    if (col === 0) quebraSePreciso(12);
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...CINZA);
    doc.setCharSpace(0.3); doc.text(String(rotulo).toUpperCase(), x, y); doc.setCharSpace(0);
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...TINTA);
    doc.text(doc.splitTextToSize(String(valor), colLarg)[0] || "", x, y + 4.8);
    if (col === 2 || i === campos.length - 1) y += 12;
  });
  y += 1;
  doc.setDrawColor(235, 238, 232).setLineWidth(0.3).line(mx, y, larg - mx, y);
  y += 9;

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
      tituloSecao("Grade de tamanhos");

      const larguraTabela = larg - mx * 2;
      const colVar = temVariante ? 34 : 0;
      const colTotal = 20;
      const cw = (larguraTabela - colVar - colTotal) / cols.length;
      const RAIO = 2.8;
      const BORDA_T = [231, 234, 228];

      const totalTam = (t) => linhasGrade.reduce((a, l) => a + (parseInt(l.qtds[t], 10) || 0), 0);
      const totalLinha = (l) => cols.reduce((a, t) => a + (parseInt(l.qtds[t], 10) || 0), 0);
      const geral = linhasGrade.reduce((a, l) => a + totalLinha(l), 0);
      const haLinhaTotal = temVariante || linhasGrade.length > 1;
      const tabTop = y;

      // Só o texto — a moldura arredondada e as divisórias vêm no fim.
      const celula = (cx, cy, cwid, texto, { header, corTexto, bold, alinhar } = {}) => {
        doc.setFont("helvetica", bold === false ? "normal" : "bold").setFontSize(header ? 7.5 : 9.5).setTextColor(...(corTexto || TINTA));
        doc.text(String(texto), alinhar === "left" ? cx + 3.5 : cx + cwid / 2, cy + 5.4, { align: alinhar === "left" ? "left" : "center" });
      };

      // Cabeçalho — fundo suave com o topo arredondado
      doc.setFillColor(246, 248, 244);
      doc.roundedRect(mx, tabTop, larguraTabela, hLinha, RAIO, RAIO, "F");
      doc.rect(mx, tabTop + hLinha - RAIO, larguraTabela, RAIO, "F");
      let x = mx;
      if (temVariante) { celula(x, y, colVar, "VARIANTE", { header: true, corTexto: CINZA, alinhar: "left" }); x += colVar; }
      cols.forEach((t) => { celula(x, y, cw, t, { header: true, corTexto: CINZA }); x += cw; });
      celula(x, y, colTotal, "TOTAL", { header: true, corTexto: VERDE_ESCURO });
      y += hLinha;

      const xTotal = mx + colVar + cw * cols.length;

      // Linhas
      linhasGrade.forEach((l, idx) => {
        const ultimaSemTotal = !haLinhaTotal && idx === linhasGrade.length - 1;
        doc.setFillColor(242, 248, 239);
        doc.rect(xTotal, y, colTotal - 0.4, hLinha - (ultimaSemTotal ? 0.5 : 0), "F");
        x = mx;
        if (temVariante) { celula(x, y, colVar, l.variante || "—", { corTexto: TINTA, alinhar: "left" }); x += colVar; }
        cols.forEach((t) => {
          const q = parseInt(l.qtds[t], 10) || 0;
          celula(x, y, cw, q || "·", { corTexto: q ? TINTA : [190, 190, 185], bold: !!q });
          x += cw;
        });
        celula(x, y, colTotal, totalLinha(l), { corTexto: VERDE_ESCURO });
        y += hLinha;
      });

      // Linha de total — faixa escura com a base arredondada
      if (haLinhaTotal) {
        doc.setFillColor(...VERDE_ESCURO);
        doc.roundedRect(mx, y, larguraTabela, hLinha, RAIO, RAIO, "F");
        doc.rect(mx, y, larguraTabela, RAIO, "F");
        x = mx;
        if (temVariante) { celula(x, y, colVar, "TOTAL", { corTexto: [255, 255, 255], alinhar: "left" }); x += colVar; }
        cols.forEach((t) => { celula(x, y, cw, totalTam(t), { corTexto: [255, 255, 255] }); x += cw; });
        celula(x, y, colTotal, geral, { corTexto: [255, 255, 255] });
        y += hLinha;
      }

      // Divisórias finas + moldura arredondada
      const tabBottom = y;
      const fimVert = haLinhaTotal ? tabBottom - hLinha : tabBottom;
      doc.setDrawColor(...BORDA_T).setLineWidth(0.25);
      if (temVariante) doc.line(mx + colVar, tabTop, mx + colVar, fimVert);
      cols.forEach((_, i) => { if (i > 0) { const px = mx + colVar + cw * i; doc.line(px, tabTop, px, fimVert); } });
      doc.line(xTotal, tabTop, xTotal, fimVert);
      for (let r = 1; r <= linhasGrade.length; r++) {
        const py = tabTop + hLinha * r;
        if (py < fimVert - 0.1) doc.line(mx, py, larg - mx, py);
      }
      doc.setDrawColor(...BORDA_T).setLineWidth(0.4).roundedRect(mx, tabTop, larguraTabela, tabBottom - tabTop, RAIO, RAIO, "S");
      y += 12;
    }
  }

  // ── Classificação por qualidade (1ª/2ª por tamanho) — só quando houver ──
  if (classificacao && (classificacao.primeira || classificacao.segunda)) {
    const g1 = classificacao.primeira || {};
    const g2 = classificacao.segunda || {};
    const tams = TAMANHOS_GRADE.filter((t) => (parseInt(g1[t], 10) || 0) > 0 || (parseInt(g2[t], 10) || 0) > 0);
    // tamanhos fora da lista padrão, se houver
    [...Object.keys(g1), ...Object.keys(g2)].forEach((t) => {
      if (!tams.includes(t) && ((parseInt(g1[t], 10) || 0) > 0 || (parseInt(g2[t], 10) || 0) > 0)) tams.push(t);
    });

    if (tams.length > 0) {
      const hLinha = 8;
      quebraSePreciso(16 + (tams.length + 2) * hLinha);
      tituloSecao("Classificação por qualidade");

      const larguraTabela = larg - mx * 2;
      const RAIO_C = 3, BORDA_C = [231, 234, 228];
      const colTam = 40;
      const cw = (larguraTabela - colTam) / 3; // 1ª, 2ª, Total
      const tot1 = tams.reduce((a, t) => a + (parseInt(g1[t], 10) || 0), 0);
      const tot2 = tams.reduce((a, t) => a + (parseInt(g2[t], 10) || 0), 0);
      const tabTopC = y;
      const xTotC = mx + colTam + cw * 2;

      const cel = (cx, cy, cwid, texto, { corTexto, bold, alinhar, header } = {}) => {
        doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(header ? 7.5 : 9).setTextColor(...(corTexto || TINTA));
        const al = alinhar || "center";
        const tx = al === "left" ? cx + 3.5 : al === "right" ? cx + cwid - 3.5 : cx + cwid / 2;
        doc.text(String(texto), tx, cy + hLinha * 0.66, { align: al });
      };

      // Cabeçalho — faixa suave com topo arredondado
      doc.setFillColor(246, 248, 244);
      doc.roundedRect(mx, tabTopC, larguraTabela, hLinha, RAIO_C, RAIO_C, "F");
      doc.rect(mx, tabTopC + hLinha - RAIO_C, larguraTabela, RAIO_C, "F");
      let x = mx;
      cel(x, y, colTam, "TAMANHO", { corTexto: CINZA, bold: true, alinhar: "left", header: true }); x += colTam;
      cel(x, y, cw, "1ª QUALIDADE", { corTexto: VERDE_ESCURO, bold: true, header: true }); x += cw;
      cel(x, y, cw, "2ª QUALIDADE", { corTexto: [150, 90, 20], bold: true, header: true }); x += cw;
      cel(x, y, cw, "TOTAL", { corTexto: CINZA, bold: true, header: true });
      y += hLinha;

      // Linhas por tamanho (coluna Total com leve verde)
      tams.forEach((t) => {
        const q1 = parseInt(g1[t], 10) || 0;
        const q2 = parseInt(g2[t], 10) || 0;
        doc.setFillColor(242, 248, 239).rect(xTotC, y, cw - 0.4, hLinha, "F");
        x = mx;
        cel(x, y, colTam, t, { bold: true, alinhar: "left" }); x += colTam;
        cel(x, y, cw, q1 || "·", { corTexto: q1 ? TINTA : [190, 190, 185] }); x += cw;
        cel(x, y, cw, q2 || "·", { corTexto: q2 ? TINTA : [190, 190, 185] }); x += cw;
        cel(x, y, cw, q1 + q2, { corTexto: VERDE_ESCURO, bold: true });
        y += hLinha;
      });

      // Total — faixa escura com base arredondada
      doc.setFillColor(...VERDE_ESCURO);
      doc.roundedRect(mx, y, larguraTabela, hLinha, RAIO_C, RAIO_C, "F");
      doc.rect(mx, y, larguraTabela, RAIO_C, "F");
      x = mx;
      cel(x, y, colTam, "TOTAL", { corTexto: [255, 255, 255], bold: true, alinhar: "left" }); x += colTam;
      cel(x, y, cw, tot1, { corTexto: [255, 255, 255], bold: true }); x += cw;
      cel(x, y, cw, tot2, { corTexto: [255, 255, 255], bold: true }); x += cw;
      cel(x, y, cw, tot1 + tot2, { corTexto: [255, 255, 255], bold: true });
      y += hLinha;

      // Divisórias finas + moldura arredondada
      const fimVertC = y - hLinha;
      doc.setDrawColor(...BORDA_C).setLineWidth(0.25);
      doc.line(mx + colTam, tabTopC, mx + colTam, fimVertC);
      doc.line(mx + colTam + cw, tabTopC, mx + colTam + cw, fimVertC);
      doc.line(xTotC, tabTopC, xTotC, fimVertC);
      for (let r = 1; r <= tams.length; r++) {
        const py = tabTopC + hLinha * r;
        if (py < fimVertC - 0.1) doc.line(mx, py, larg - mx, py);
      }
      doc.setDrawColor(...BORDA_C).setLineWidth(0.4).roundedRect(mx, tabTopC, larguraTabela, y - tabTopC, RAIO_C, RAIO_C, "S");
      y += 12;
    }
  }

  // ── Rastreio dos processos (trilha visual) — reutilizável (corte/acabamento) ──
  const desenharProcessos = (titulo, lista) => {
    if (!lista || lista.length === 0) return;
    quebraSePreciso(44);   // garante título + cabeçalho do quadro + 1ª linha na mesma página
    const concluidos = lista.filter((p) => p.qtd >= pedido.total).length;
    const somaFeitas = lista.reduce((s, p) => s + Math.min(p.qtd, pedido.total), 0);
    const pctPecas = pedido.total ? Math.round((somaFeitas / (pedido.total * lista.length)) * 100) : 0;
    tituloSecao(titulo);
    y += 1;

    // moldura única da seção: cabeçalho de rastreio + barra geral + lista com divisórias
    const inL = mx + 4.5, inR = larg - mx - 4.5;   // recuo interno do conteúdo
    let quadroTop = y;
    let primeiroDoQuadro = true;
    const fechaQuadro = () => {
      doc.setDrawColor(231, 234, 228).setLineWidth(0.4).roundedRect(mx, quadroTop, larg - mx * 2, y - quadroTop, 3, 3, "S");
    };

    // ── cabeçalho do quadro (fundo suave, topo arredondado) ──
    {
      const headerH = 14;
      const wQ = larg - mx * 2;
      doc.setFillColor(250, 251, 248);
      doc.roundedRect(mx, quadroTop, wQ, headerH, 3, 3, "F");
      doc.rect(mx, quadroTop + headerH - 3, wQ, 3, "F");   // base do cabeçalho reta
      // rótulo à esquerda
      doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(90, 100, 89);
      doc.setCharSpace(0.7); doc.text("RASTREIO DOS PROCESSOS", inL, quadroTop + 5.8); doc.setCharSpace(0);
      // resumo à direita: "N/M completos · P% das peças" (número em verde)
      const resto = `/${lista.length} completos · ${pctPecas}% das peças`;
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
      const wResto = doc.getTextWidth(resto);
      doc.text(resto, inR, quadroTop + 5.8, { align: "right" });
      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...VERDE_ESCURO);
      doc.text(String(concluidos), inR - wResto, quadroTop + 5.8, { align: "right" });
      // barra geral de progresso (das peças)
      const barY = quadroTop + 8.6;
      doc.setFillColor(233, 236, 230).roundedRect(inL, barY, inR - inL, 2.2, 1.1, 1.1, "F");
      const fracPecas = Math.max(0, Math.min(1, pctPecas / 100));
      if (fracPecas > 0) doc.setFillColor(...VERDE).roundedRect(inL, barY, (inR - inL) * fracPecas, 2.2, 1.1, 1.1, "F");
      y = quadroTop + headerH;
      // divisória sob o cabeçalho
      doc.setDrawColor(238, 241, 236).setLineWidth(0.3).line(mx, y, larg - mx, y);
      primeiroDoQuadro = true;   // a 1ª linha não desenha outra divisória
    }

    lista.forEach(({ nome, qtd: feitas, grade, obs, feito_em }) => {
      const completo = feitas >= pedido.total;
      const parcial = feitas > 0 && !completo;
      const cor = completo ? VERDE : parcial ? AMBAR : [190, 190, 185];
      const temGrade = parcial && grade && Object.entries(grade).some(([, q]) => (parseInt(q, 10) || 0) > 0);
      const obsLinhas = obs ? doc.splitTextToSize(`Obs: ${obs}`, inR - inL - 14) : [];
      const alturaItem = 3 + (parcial ? 12 : 8) + (temGrade ? 8 : 0) + obsLinhas.length * 4 + 1.5;

      // quebra de página: fecha o quadro nesta página e reabre na próxima
      if (y + alturaItem + 2 > 280) {
        fechaQuadro();
        quebraSePreciso(alturaItem + 2);
        quadroTop = y;
        primeiroDoQuadro = true;
      }

      // divisória entre processos (não antes do primeiro do quadro)
      if (!primeiroDoQuadro) {
        doc.setDrawColor(240, 243, 238).setLineWidth(0.3).line(mx, y, larg - mx, y);
      }
      primeiroDoQuadro = false;
      y += 3;   // respiro superior da linha

      const cx = inL + 2.2;
      const marcaY = y + 1.2;

      // marcador de status
      if (completo) {
        doc.setFillColor(...VERDE).circle(cx, marcaY, 2.2, "F");
        doc.setDrawColor(255).setLineWidth(0.5);
        doc.line(cx - 1, marcaY, cx - 0.2, marcaY + 0.9); doc.line(cx - 0.2, marcaY + 0.9, cx + 1.1, marcaY - 0.8);
      } else if (parcial) {
        doc.setDrawColor(...AMBAR).setLineWidth(0.7).circle(cx, marcaY, 2.2, "S");
      } else {
        doc.setDrawColor(200).setLineWidth(0.5).circle(cx, marcaY, 2.2, "S");
      }

      // nome
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...(completo || parcial ? TINTA : CINZA));
      doc.text(nome, cx + 6, y + 2);

      if (parcial) {
        // contagem + selo de %
        const pct = Math.max(0, Math.min(1, feitas / (pedido.total || 1)));
        const pctTxt = `${Math.round(pct * 100)}%`;
        doc.setFont("helvetica", "bold").setFontSize(7.5);
        const badgeW = doc.getTextWidth(pctTxt) + 6;
        const badgeX = inR - badgeW;
        doc.setFillColor(251, 241, 223).roundedRect(badgeX, y - 1.6, badgeW, 5, 1.6, 1.6, "F");
        doc.setTextColor(...AMBAR).text(pctTxt, badgeX + 3, y + 1.8);
        doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...AMBAR);
        doc.text(`${feitas}/${pedido.total}`, badgeX - 4, y + 2, { align: "right" });
        y += 5;
        // barra arredondada
        const barX = cx + 6, barW = inR - barX, barY = y;
        doc.setFillColor(240, 242, 238).roundedRect(barX, barY, barW, 2, 1, 1, "F");
        if (pct > 0) doc.setFillColor(...cor).roundedRect(barX, barY, barW * pct, 2, 1, 1, "F");
        y += 5;
        // chips de tamanho (contorno leve)
        if (temGrade) {
          const ordenados = Object.entries(grade)
            .filter(([, q]) => (parseInt(q, 10) || 0) > 0)
            .sort(([a], [b]) => {
              const ia = TAMANHOS_GRADE.indexOf(a), ib = TAMANHOS_GRADE.indexOf(b);
              return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
            });
          const chipH = 5;
          let chipX = cx + 6;
          y += 1;
          ordenados.forEach(([t, q]) => {
            doc.setFont("helvetica", "bold").setFontSize(7.5);
            const label = `${t}  ${q}`;
            const wChip = doc.getTextWidth(label) + 8;
            if (chipX + wChip > inR) { chipX = cx + 6; y += chipH + 2; }
            doc.setFillColor(255, 255, 255).setDrawColor(230, 233, 227).setLineWidth(0.3).roundedRect(chipX, y, wChip, chipH, 2, 2, "FD");
            doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...TINTA).text(String(t), chipX + 3, y + 3.4);
            const wT = doc.getTextWidth(String(t));
            doc.setFont("helvetica", "normal").setTextColor(...CINZA).text(String(q), chipX + 3 + wT + 2, y + 3.4);
            chipX += wChip + 3;
          });
          y += chipH + 2;
        }
      } else {
        // compacto (concluído em verde, não iniciado em cinza) — sem barra
        doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...(completo ? VERDE_ESCURO : CINZA));
        doc.text(`${feitas}/${pedido.total}`, inR, y + 2, { align: "right" });
        if (completo && feito_em) {
          const wTot = doc.getTextWidth(`${feitas}/${pedido.total}`);
          doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
          doc.text(String(feito_em), inR - wTot - 4, y + 2, { align: "right" });
        }
        y += 6;
      }

      if (obsLinhas.length) {
        doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(...CINZA);
        doc.text(obsLinhas, cx + 6, y + 1);
        y += obsLinhas.length * 4 + 1;
      }

      y += 1.5;   // respiro inferior da linha
    });
    fechaQuadro();
    y += 10;
  };

  if (dossie) {
    desenharProcessos("Processos do corte", processos);
    desenharProcessos("Processos do acabamento", processosAcabamento);
  } else {
    desenharProcessos("Processos", processos);
  }

  // ── Observações gerais — caixinha de nota ──
  if (pedido.observacoes) {
    const linhas = doc.splitTextToSize(pedido.observacoes, larg - mx * 2 - 12);
    quebraSePreciso(14 + linhas.length * 4.6);
    tituloSecao("Observações do pedido");
    const hNota = linhas.length * 4.6 + 7;
    doc.setFillColor(250, 251, 248).setDrawColor(231, 234, 228).setLineWidth(0.4).roundedRect(mx, y, larg - mx * 2, hNota, 3, 3, "FD");
    doc.setFont("helvetica", "italic").setFontSize(9.5).setTextColor(58, 66, 58);
    doc.text(linhas, mx + 6, y + 6.2);
    y += hNota + 10;
  }

  // ── Remessas de oficina (para a etapa Oficina) ──
  if (remessasOficina && remessasOficina.length > 0) {
    const hLinha = 7.5;
    quebraSePreciso(18 + remessasOficina.length * hLinha);
    tituloSecao("Remessas de oficina");

    const larguraTabela = larg - mx * 2;
    const RAIO_R = 3, BORDA_R = [231, 234, 228];
    // oficina | saída | retorno | enviadas | retorn.
    const cols = [larguraTabela * 0.30, larguraTabela * 0.20, larguraTabela * 0.20, larguraTabela * 0.15, larguraTabela * 0.15];
    const fmtD = (d) => {
      if (!d) return "—";
      const dt = /^\d{4}-\d{2}-\d{2}/.test(d) ? new Date(d.slice(0, 10) + "T12:00") : new Date(d);
      return isNaN(dt) ? "—" : dt.toLocaleDateString("pt-BR");
    };
    const headers = ["OFICINA", "SAÍDA", "RETORNO", "ENVIADAS", "RETORN."];

    let tabTopR = y;
    const fechaTabR = () => {
      doc.setDrawColor(...BORDA_R).setLineWidth(0.4).roundedRect(mx, tabTopR, larguraTabela, y - tabTopR, RAIO_R, RAIO_R, "S");
    };
    const cabecalhoR = () => {
      doc.setFillColor(246, 248, 244);
      doc.roundedRect(mx, y, larguraTabela, hLinha, RAIO_R, RAIO_R, "F");
      doc.rect(mx, y + hLinha - RAIO_R, larguraTabela, RAIO_R, "F");
      let x = mx;
      doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
      headers.forEach((h, i) => {
        const alinhar = i >= 3 ? "right" : "left";
        doc.text(h, alinhar === "right" ? x + cols[i] - 3.5 : x + 3.5, y + 4.9, { align: alinhar });
        x += cols[i];
      });
      y += hLinha;
    };
    cabecalhoR();

    remessasOficina.forEach((r, idx) => {
      const linhasMotivo = r.motivo ? doc.splitTextToSize(`Motivo do fechamento: ${r.motivo}`, larguraTabela - 8) : [];
      const alturaLinha = hLinha + (linhasMotivo.length ? linhasMotivo.length * 4 + 2.5 : 0);
      if (y + alturaLinha + 2 > 280) { fechaTabR(); quebraSePreciso(alturaLinha + hLinha + 2); tabTopR = y; cabecalhoR(); }
      const emAberto = !r.retorno;
      doc.setDrawColor(240, 243, 238).setLineWidth(0.3).line(mx, y, larg - mx, y);   // divisória
      if (idx % 2 === 1) { doc.setFillColor(250, 251, 249).rect(mx + 0.3, y + 0.15, larguraTabela - 0.6, alturaLinha - 0.3, "F"); }
      const vals = [r.oficina, fmtD(r.saida), emAberto ? "em aberto" : fmtD(r.retorno), String(r.enviada), String(r.retornada)];
      let x = mx;
      vals.forEach((v, i) => {
        const alinhar = i >= 3 ? "right" : "left";
        doc.setFont("helvetica", i === 0 ? "bold" : "normal").setFontSize(8.5).setTextColor(...(emAberto ? AMBAR : i === 0 ? TINTA : [90, 88, 82]));
        const txt = i === 0 ? (doc.splitTextToSize(v, cols[i] - 5)[0] || v) : v;
        doc.text(txt, alinhar === "right" ? x + cols[i] - 3.5 : x + 3.5, y + 5, { align: alinhar });
        x += cols[i];
      });
      y += hLinha;
      if (linhasMotivo.length) {
        doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(...CINZA);
        linhasMotivo.forEach((ln) => { doc.text(ln, mx + 3.5, y + 2.6); y += 4; });
        y += 2.5;
      }
    });
    fechaTabR();
    y += 10;
  }

  // ── Aviamentos (para a etapa Aviamento) ──
  if (aviamentos && aviamentos.length > 0) {
    const hLinha = 7;
    quebraSePreciso(16 + aviamentos.length * hLinha);
    tituloSecao("Aviamentos");

    const larguraTabela = larg - mx * 2;
    const RAIO_A = 3, BORDA_A = [231, 234, 228];
    const colItem = larguraTabela * 0.3;
    const colDet = larguraTabela * 0.34;
    const colCons = larguraTabela * 0.2;
    const colQtd = larguraTabela * 0.16;

    let tabTopA = y;
    const fechaTabA = () => {
      doc.setDrawColor(...BORDA_A).setLineWidth(0.4).roundedRect(mx, tabTopA, larguraTabela, y - tabTopA, RAIO_A, RAIO_A, "S");
    };
    const cabecalhoA = () => {
      doc.setFillColor(246, 248, 244);
      doc.roundedRect(mx, y, larguraTabela, hLinha, RAIO_A, RAIO_A, "F");
      doc.rect(mx, y + hLinha - RAIO_A, larguraTabela, RAIO_A, "F");
      doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
      doc.text("ITEM", mx + 3.5, y + 4.9);
      doc.text("ESPECIFICAÇÃO", mx + colItem + 3.5, y + 4.9);
      doc.text("CONSUMO", mx + colItem + colDet + 3.5, y + 4.9);
      doc.text("QTD", larg - mx - 3.5, y + 4.9, { align: "right" });
      y += hLinha;
    };
    cabecalhoA();

    aviamentos.forEach((a, idx) => {
      if (y + hLinha + 2 > 280) { fechaTabA(); quebraSePreciso(hLinha * 2 + 2); tabTopA = y; cabecalhoA(); }
      // Especificação conforme o tipo (o consumo agora vai em coluna própria).
      const partes = [];
      if (a.largura) partes.push(`largura ${a.largura}`);
      if (a.tipoCampo === "ziper") {
        if (a.tipo) partes.push(a.tipo);
        if (a.tamanho) partes.push(a.tamanho);
      } else if (a.tamanho) {
        partes.push(`tam. ${a.tamanho}`);
      }
      const detalhe = partes.join(" · ") || "—";

      doc.setDrawColor(240, 243, 238).setLineWidth(0.3).line(mx, y, larg - mx, y);   // divisória
      if (idx % 2 === 1) { doc.setFillColor(250, 251, 249).rect(mx + 0.3, y + 0.15, larguraTabela - 0.6, hLinha - 0.3, "F"); }
      doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...TINTA);
      doc.text(a.nome, mx + 3.5, y + 5);
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
      doc.text(doc.splitTextToSize(detalhe, colDet - 5)[0] || detalhe, mx + colItem + 3.5, y + 5);
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...(a.consumo ? TINTA : [190, 190, 185]));
      doc.text(a.consumo ? String(a.consumo) : "—", mx + colItem + colDet + 3.5, y + 5);
      if (a.qtd) {
        doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...TINTA);
        doc.text(String(a.qtd), larg - mx - 3.5, y + 5, { align: "right" });
      }
      y += hLinha;
    });
    fechaTabA();
    y += 10;
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
    tituloSecao("Imagens");
    let x = mx;
    let alturaLinha = 0;
    imgs.forEach((im, i) => {
      const escala = Math.min(larguraCol / im.w, 55 / im.h); // cabe na coluna, máx ~55mm de altura
      const w = im.w * escala;
      const h = im.h * escala;
      // Só quebra a partir da 2ª imagem (a 1ª já foi garantida junto com o título).
      if (i % 2 === 0) { if (i > 0) quebraSePreciso(h + 10); x = mx; }
      // imagem com cantos arredondados (clip); se o clip falhar, cai no desenho normal
      try {
        doc.saveGraphicsState();
        doc.roundedRect(x, y, w, h, 2.5, 2.5, null);
        doc.clip();
        doc.discardPath();
        doc.addImage(im.dataUrl, im.fmt, x, y, w, h);
        doc.restoreGraphicsState();
      } catch {
        try { doc.addImage(im.dataUrl, im.fmt, x, y, w, h); } catch { /* ignora imagem inválida */ }
      }
      doc.setDrawColor(224, 228, 221).setLineWidth(0.4).roundedRect(x, y, w, h, 2.5, 2.5, "S");
      if (im.rotulo) {
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
        doc.text(im.rotulo, x, y + h + 4);
      }
      alturaLinha = Math.max(alturaLinha, h);
      if (i % 2 === 1 || i === imgs.length - 1) { y += alturaLinha + 10; alturaLinha = 0; }
      else { x += larguraCol + 8; }
    });
  }

  // ── Histórico dos processos: quando cada processo desta etapa foi finalizado ──
  if (historico && historico.length) {
    const hLinha = 8;
    quebraSePreciso(16 + (historico.length + 1) * hLinha);
    tituloSecao("Histórico dos processos");
    const larguraTabela = larg - mx * 2;
    const colProc = larguraTabela * 0.4;
    const colData = larguraTabela * 0.4;
    const colQtd = larguraTabela - colProc - colData;
    const RAIO_H = 2.8, BORDA_H = [232, 235, 229];
    const tabTopH = y;
    const cel = (cx, cwid, texto, { corTexto, bold, alinhar } = {}) => {
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(9).setTextColor(...(corTexto || TINTA));
      const al = alinhar || "center";
      const tx = al === "left" ? cx + 3.5 : al === "right" ? cx + cwid - 3.5 : cx + cwid / 2;
      doc.text(String(texto), tx, y + hLinha * 0.66, { align: al });
    };
    // Cabeçalho com topo arredondado
    doc.setFillColor(246, 248, 244);
    doc.roundedRect(mx, tabTopH, larguraTabela, hLinha, RAIO_H, RAIO_H, "F");
    doc.rect(mx, tabTopH + hLinha - RAIO_H, larguraTabela, RAIO_H, "F");
    let x = mx;
    cel(x, colProc, "PROCESSO", { corTexto: CINZA, bold: true, alinhar: "left" }); x += colProc;
    cel(x, colData, "FINALIZADO EM", { corTexto: CINZA, bold: true }); x += colData;
    cel(x, colQtd, "PEÇAS", { corTexto: CINZA, bold: true });
    y += hLinha;
    historico.forEach((n, i) => {
      x = mx;
      const ultima = i === historico.length - 1;
      if (i % 2 === 1) { doc.setFillColor(248, 250, 247).rect(mx + 0.4, y, larguraTabela - 0.8, hLinha - (ultima ? 0.5 : 0), "F"); }
      cel(x, colProc, n.nome, { bold: true, alinhar: "left" }); x += colProc;
      cel(x, colData, n.feito_em || "—", { corTexto: [70, 68, 62] }); x += colData;
      cel(x, colQtd, n.qtd != null ? String(n.qtd) : "—", { corTexto: [70, 68, 62] });
      y += hLinha;
    });
    // Divisórias finas + moldura arredondada
    doc.setDrawColor(...BORDA_H).setLineWidth(0.25);
    doc.line(mx + colProc, tabTopH, mx + colProc, y);
    doc.line(mx + colProc + colData, tabTopH, mx + colProc + colData, y);
    for (let r = 1; r <= historico.length; r++) {
      const py = tabTopH + hLinha * r;
      if (py < y - 0.1) doc.line(mx, py, larg - mx, py);
    }
    doc.setDrawColor(...BORDA_H).setLineWidth(0.4).roundedRect(mx, tabTopH, larguraTabela, y - tabTopH, RAIO_H, RAIO_H, "S");
    y += 12;
  }

  // ── Linha do tempo: todos os movimentos do pedido, em ordem ──
  if (linhaTempo && linhaTempo.length) {
    const hLinha = 8;
    quebraSePreciso(16 + hLinha);
    tituloSecao("Linha do tempo");
    const fmtDT = (d) => {
      if (!d) return "—";
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d).slice(0, 10);
      return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
    };
    const larguraTabela = larg - mx * 2;
    const RAIO_L = 3, BORDA_L = [231, 234, 228];
    const colMov = larguraTabela * 0.5;
    const colQtd = larguraTabela * 0.16;
    const colData = larguraTabela - colMov - colQtd;
    const cel = (cx, cwid, texto, { corTexto, bold, alinhar } = {}) => {
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(9).setTextColor(...(corTexto || TINTA));
      const al = alinhar || "center";
      const tx = al === "left" ? cx + 3.5 : al === "right" ? cx + cwid - 3.5 : cx + cwid / 2;
      doc.text(String(texto), tx, y + hLinha * 0.66, { align: al });
    };
    let tabTopL = y;
    const fechaTabL = () => {
      doc.setDrawColor(...BORDA_L).setLineWidth(0.4).roundedRect(mx, tabTopL, larguraTabela, y - tabTopL, RAIO_L, RAIO_L, "S");
    };
    const cabecalhoL = () => {
      doc.setFillColor(246, 248, 244);
      doc.roundedRect(mx, y, larguraTabela, hLinha, RAIO_L, RAIO_L, "F");
      doc.rect(mx, y + hLinha - RAIO_L, larguraTabela, RAIO_L, "F");
      let x = mx;
      cel(x, colMov, "MOVIMENTO", { corTexto: CINZA, bold: true, alinhar: "left" }); x += colMov;
      cel(x, colQtd, "PEÇAS", { corTexto: CINZA, bold: true }); x += colQtd;
      cel(x, colData, "DATA", { corTexto: CINZA, bold: true });
      y += hLinha;
    };
    cabecalhoL();
    linhaTempo.forEach((m, i) => {
      if (y + hLinha + 2 > 280) { fechaTabL(); quebraSePreciso(hLinha * 2 + 2); tabTopL = y; cabecalhoL(); }
      doc.setDrawColor(240, 243, 238).setLineWidth(0.3).line(mx, y, larg - mx, y);
      if (i % 2 === 1) { doc.setFillColor(250, 251, 249).rect(mx + 0.3, y + 0.15, larguraTabela - 0.6, hLinha - 0.3, "F"); }
      let x = mx;
      cel(x, colMov, `${rotuloLocal(m.de_local)} > ${rotuloLocal(m.para_local)}`, { bold: true, alinhar: "left" }); x += colMov;
      cel(x, colQtd, m.qtd != null ? String(m.qtd) : "—", { corTexto: [70, 68, 62] }); x += colQtd;
      cel(x, colData, fmtDT(m.data), { corTexto: [70, 68, 62] });
      y += hLinha;
    });
    fechaTabL();
    y += 12;
  }

  rodape();
}

const limparNome = (t) => String(t || "").replace(/[^a-zA-Z0-9-_]/g, "_");

// Renumera todas as páginas com "Página X de Y".
function renumerarPaginas(doc) {
  const larg = doc.internal.pageSize.getWidth();
  const mx = 16;
  const totalPag = doc.getNumberOfPages();
  for (let p = 1; p <= totalPag; p++) {
    doc.setPage(p);
    doc.setFillColor(255, 255, 255).rect(larg - mx - 40, 288.5, 40, 5, "F"); // limpa a numeração antiga
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
    doc.text(`Página ${p} de ${totalPag}`, larg - mx, 291.5, { align: "right" });
  }
}

// Romaneio de UM pedido numa etapa (comportamento original).
export async function gerarPdfEtapa(params) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await desenharPedidoNoPdf(doc, params);
  renumerarPaginas(doc);
  const { pedido, local, totalPartes, parte } = params;
  doc.save(`${limparNome(pedido.referencia) || "pedido"}-${limparNome(rotuloLocal(local))}${totalPartes > 1 ? `-parte${parte}de${totalPartes}` : ""}.pdf`);
}

// Dossiê completo de um pedido finalizado: todas as etapas num documento só
// (grade, classificação, processos de corte e acabamento, aviamentos, remessas).
export async function gerarDossiePedido({ pedido, cliente, classificacao, processosCorte, processosAcabamento, aviamentos, remessasOficina, movimentos }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const linhaTempo = (movimentos || [])
    .slice()
    .sort((a, b) => String(a.criado_em || a.data || "").localeCompare(String(b.criado_em || b.data || "")))
    .map((m) => ({ de_local: m.de_local, para_local: m.para_local, qtd: m.qtd, data: m.criado_em || m.data }));
  await desenharPedidoNoPdf(doc, {
    pedido, cliente, local: "Estoque", qtd: pedido.total, parte: 1, totalPartes: 1,
    oficina: null, processos: processosCorte || null, processosAcabamento: processosAcabamento || null,
    remessasOficina: remessasOficina || null, aviamentos: aviamentos || null, imagens: [],
    classificacao: classificacao || null, historico: null, dossie: true,
    linhaTempo: linhaTempo.length ? linhaTempo : null,
  });
  renumerarPaginas(doc);
  const hoje = new Date().toISOString().slice(0, 10);
  doc.save(`dossie-${limparNome(pedido.referencia) || "pedido"}-${hoje}.pdf`);
}

// Romaneio GERAL de uma coluna: uma página-resumo do lote + a folha
// detalhada de cada pedido (uma por página), tudo num PDF só.
// `itens` = lista de params no mesmo formato de gerarPdfEtapa (sem `local`).
// Romaneio GERAL de uma coluna: apenas o resumo do que há no setor (uma folha).
// Para ver um pedido específico, gera-se o PDF direto do pedido.
// `itens` = lista de { pedido, cliente, qtd }.
export async function gerarRomaneioColuna({ local, itens }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  desenharResumoColuna(doc, local, itens);
  renumerarPaginas(doc);
  const hoje = new Date().toISOString().slice(0, 10);
  doc.save(`romaneio-${limparNome(rotuloLocal(local))}-${hoje}.pdf`);
}

// Página-resumo (primeira folha) do romaneio geral: cabeçalho + tabela do lote.
function desenharResumoColuna(doc, local, itens) {
  const larg = doc.internal.pageSize.getWidth();
  const mx = 16;
  let y = 18;

  const rodape = () => {
    doc.setDrawColor(225).setLineWidth(0.2).line(mx, 287, larg - mx, 287);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
    doc.text("Gerado pelo sistema Forenza — Gestão de produção", mx, 291.5);
  };

  // ── Faixa de cor no topo (mesmo degradê do romaneio individual) ──
  const faixaH = 4, passos = 60;
  for (let i = 0; i < passos; i++) {
    const t = i / (passos - 1);
    const r = Math.round(VERDE_ESCURO[0] + (VERDE[0] - VERDE_ESCURO[0]) * t);
    const g = Math.round(VERDE_ESCURO[1] + (VERDE[1] - VERDE_ESCURO[1]) * t);
    const b = Math.round(VERDE_ESCURO[2] + (VERDE[2] - VERDE_ESCURO[2]) * t);
    doc.setFillColor(r, g, b).rect((larg * i) / passos, 0, larg / passos + 0.5, faixaH, "F");
  }
  y = 20;

  // ── Cabeçalho: marca + selo do setor ──
  doc.setDrawColor(...TINTA).setLineWidth(1.5).circle(mx + 5.5, y, 5.5, "S");
  doc.setFillColor(...VERDE).circle(mx + 5.5, y, 2.4, "F");
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...TINTA);
  doc.text("F O R E N Z A", mx + 15, y - 0.5);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
  doc.text("GESTÃO DE PRODUÇÃO", mx + 15.5, y + 4.5);

  const corSetor = corDoSetor(local);
  const selo = rotuloLocal(local).toUpperCase();
  doc.setFont("helvetica", "bold").setFontSize(9);
  const wSelo = doc.getTextWidth(selo) + 12;
  doc.setFillColor(...corSetor).roundedRect(larg - mx - wSelo, y - 4.5, wSelo, 7.5, 2, 2, "F");
  doc.setTextColor(255).text(selo, larg - mx - wSelo / 2, y + 0.4, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`, larg - mx, y + 7, { align: "right" });
  y += 15;

  // ── Título ──
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...TINTA);
  doc.text("Romaneio geral", mx, y);
  y += 3;
  doc.setDrawColor(...TINTA).setLineWidth(0.8).line(mx, y, larg - mx, y);
  y += 9;

  // ── Subtítulo com contagem do lote ──
  const totalPecas = itens.reduce((a, it) => a + (Number(it.qtd) || 0), 0);
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(90);
  doc.text(`${rotuloLocal(local)} · ${itens.length} pedido${itens.length === 1 ? "" : "s"} · ${totalPecas} peças na etapa`, mx, y);
  y += 10;

  // ── Tabela do lote ──
  const cols = [
    { rot: "#", w: 9, al: "left" },
    { rot: "REFERÊNCIA", w: 34, al: "left" },
    { rot: "CLIENTE", w: 45, al: "left" },
    { rot: "MARCA", w: 30, al: "left" },
    { rot: "QTD", w: 18, al: "right" },
    { rot: "TOTAL", w: 20, al: "right" },
    { rot: "PRAZO", w: 22, al: "right" },
  ];
  const hLinha = 8;

  const cabecalhoTabela = () => {
    doc.setFillColor(225, 240, 233).rect(mx, y, larg - mx * 2, hLinha, "F");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...VERDE_ESCURO);
    let cx = mx;
    cols.forEach((c) => {
      const tx = c.al === "right" ? cx + c.w - 2 : cx + 2;
      doc.text(c.rot, tx, y + hLinha * 0.66, { align: c.al });
      cx += c.w;
    });
    y += hLinha;
  };

  cabecalhoTabela();
  itens.forEach((it, i) => {
    if (y + hLinha > 282) { rodape(); doc.addPage(); y = 18; cabecalhoTabela(); }
    if (i % 2 === 1) { doc.setFillColor(247, 249, 247).rect(mx, y, larg - mx * 2, hLinha, "F"); }
    const valores = [
      String(i + 1),
      it.pedido?.referencia || "—",
      it.cliente || "—",
      it.pedido?.marca || "—",
      String(it.qtd ?? "—"),
      String(it.pedido?.total ?? "—"),
      fmtData(it.pedido?.prazo) || "—",
    ];
    let cx = mx;
    cols.forEach((c, ci) => {
      doc.setFont("helvetica", ci === 1 ? "bold" : "normal").setFontSize(9).setTextColor(...(ci === 1 ? TINTA : [70, 68, 62]));
      const txt = doc.splitTextToSize(valores[ci], c.w - 3)[0] || "";
      const tx = c.al === "right" ? cx + c.w - 2 : cx + 2;
      doc.text(txt, tx, y + hLinha * 0.66, { align: c.al });
      cx += c.w;
    });
    doc.setDrawColor(232).setLineWidth(0.2).line(mx, y + hLinha, larg - mx, y + hLinha);
    y += hLinha;
  });

  // Linha de total
  y += 2;
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...VERDE_ESCURO);
  doc.text(`Total do lote: ${totalPecas} peças na etapa`, larg - mx, y + 2, { align: "right" });

  rodape();
}
