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
    const boxSize = 6.5;
    const boxTop = y;
    const base = boxTop + boxSize * 0.72;   // baseline do texto
    const meio = boxTop + boxSize / 2;      // centro vertical (para a régua)
    // Quadradinho do número (contorno escuro, sem preenchimento)
    doc.setDrawColor(...TINTA).setLineWidth(0.4).roundedRect(mx, boxTop, boxSize, boxSize, 1.3, 1.3, "S");
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...TINTA);
    doc.text(num, mx + boxSize / 2, base, { align: "center" });
    // Título (escuro, caixa normal)
    const titleX = mx + boxSize + 3.5;
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...TINTA);
    doc.text(texto, titleX, base);
    const titleW = doc.getTextWidth(texto);
    // Sufixo à direita (ex.: "5 de 8 concluídos")
    let fimRegua = larg - mx;
    if (sufixo) {
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
      doc.text(sufixo, larg - mx, base, { align: "right" });
      fimRegua = larg - mx - doc.getTextWidth(sufixo) - 4;
    }
    // Régua fina entre o título e o sufixo/margem
    const inicioRegua = titleX + titleW + 4;
    if (fimRegua > inicioRegua) {
      doc.setDrawColor(226, 229, 223).setLineWidth(0.3).line(inicioRegua, meio, fimRegua, meio);
    }
    y = boxTop + boxSize + 6;
  };

  // ── Faixa de cor no topo (degradê simulado com blocos) ──
  const faixaH = 4;
  const passos = 60;
  for (let i = 0; i < passos; i++) {
    const t = i / (passos - 1);
    // interpola VERDE_ESCURO → VERDE
    const r = Math.round(VERDE_ESCURO[0] + (VERDE[0] - VERDE_ESCURO[0]) * t);
    const g = Math.round(VERDE_ESCURO[1] + (VERDE[1] - VERDE_ESCURO[1]) * t);
    const b = Math.round(VERDE_ESCURO[2] + (VERDE[2] - VERDE_ESCURO[2]) * t);
    doc.setFillColor(r, g, b).rect((larg * i) / passos, 0, larg / passos + 0.5, faixaH, "F");
  }
  y = 20;

  // ── Cabeçalho: marca vetorial + selo do setor ──
  doc.setDrawColor(...TINTA).setLineWidth(1.5).circle(mx + 5.5, y, 5.5, "S");
  doc.setFillColor(...VERDE).circle(mx + 5.5, y, 2.4, "F");
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...TINTA);
  doc.text("F O R E N Z A", mx + 15, y - 0.5);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
  doc.text("GESTÃO DE PRODUÇÃO", mx + 15.5, y + 4.5);

  // Selo do setor (canto direito) + emissão — cor por setor
  const corSetor = dossie ? VERDE_ESCURO : corDoSetor(local);
  const selo = (dossie ? "Dossiê" : rotuloLocal(local)).toUpperCase();
  doc.setFont("helvetica", "bold").setFontSize(9);
  const wSelo = doc.getTextWidth(selo) + 12;
  doc.setFillColor(...corSetor).roundedRect(larg - mx - wSelo, y - 4.5, wSelo, 7.5, 2, 2, "F");
  doc.setTextColor(255).text(selo, larg - mx - wSelo / 2, y + 0.4, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...CINZA);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`, larg - mx, y + 7, { align: "right" });
  if (totalPartes > 1) {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...AMBAR);
    doc.text(`PARTE ${parte} DE ${totalPartes}`, larg - mx, y + 11.5, { align: "right" });
  }
  y += 15;

  // ── Título com linha grossa ──
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...TINTA);
  doc.text(dossie ? "Dossiê do pedido" : "Romaneio de produção", mx, y);
  y += 3;
  doc.setDrawColor(...TINTA).setLineWidth(0.8).line(mx, y, larg - mx, y);
  y += 10;

  // ── Bloco de destaque da quantidade ──
  doc.setFillColor(237, 247, 242).roundedRect(mx, y, larg - mx * 2, 20, 3, 3, "F");
  doc.setFont("helvetica", "bold").setFontSize(24).setTextColor(...VERDE_ESCURO);
  const qtdNum = String(dossie ? pedido.total : qtd);
  const largNum = doc.getTextWidth(qtdNum);
  doc.text(qtdNum, mx + 8, y + 13.5);
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(90);
  doc.text(dossie ? "peças · pedido finalizado" : `peças em ${rotuloLocal(local).toLowerCase()}`, mx + 12 + largNum, y + 13.5);
  if (dossie) {
    if (pedido.arquivado_em) {
      doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
      doc.text("ARQUIVADO EM", larg - mx - 8, y + 8, { align: "right" });
      doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...TINTA);
      doc.text(fmtData(pedido.arquivado_em) || "—", larg - mx - 8, y + 15, { align: "right" });
    }
  } else {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...CINZA);
    doc.text("PEDIDO COMPLETO", larg - mx - 8, y + 8, { align: "right" });
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...TINTA);
    doc.text(`${pedido.total} peças`, larg - mx - 8, y + 15, { align: "right" });
  }
  y += 30;

  // ── Informações em duas colunas ──
  const campos = [
    ["Referência", pedido.referencia],
    ["ID de corte", pedido.corte_id],
    ["Nota fiscal", pedido.nota_fiscal],
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
      tituloSecao("Grade de tamanhos");

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

      // Linha de total (só se houver variantes ou mais de uma linha) — destaque verde escuro
      if (temVariante || linhasGrade.length > 1) {
        x = mx;
        if (temVariante) { celula(x, y, colVar, "TOTAL", { fill: VERDE_ESCURO, corTexto: [255, 255, 255], alinhar: "left" }); x += colVar; }
        cols.forEach((t) => { celula(x, y, cw, totalTam(t), { fill: VERDE_ESCURO, corTexto: [255, 255, 255] }); x += cw; });
        celula(x, y, colTotal, geral, { fill: VERDE_ESCURO, corTexto: [255, 255, 255] });
        y += hLinha;
      }
      y += 13;
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
      const colTam = 40;
      const cw = (larguraTabela - colTam) / 3; // 1ª, 2ª, Total
      const tot1 = tams.reduce((a, t) => a + (parseInt(g1[t], 10) || 0), 0);
      const tot2 = tams.reduce((a, t) => a + (parseInt(g2[t], 10) || 0), 0);

      const cel = (cx, cy, cwid, texto, { fill, corTexto, bold, alinhar } = {}) => {
        if (fill) { doc.setFillColor(...fill); doc.rect(cx, cy, cwid, hLinha, "F"); }
        doc.setDrawColor(230).setLineWidth(0.2).rect(cx, cy, cwid, hLinha, "S");
        doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(9).setTextColor(...(corTexto || TINTA));
        const al = alinhar || "center";
        const tx = al === "left" ? cx + 2 : al === "right" ? cx + cwid - 2 : cx + cwid / 2;
        doc.text(String(texto), tx, cy + hLinha * 0.66, { align: al });
      };

      // Cabeçalho
      let x = mx;
      cel(x, y, colTam, "TAMANHO", { fill: [240, 240, 237], corTexto: CINZA, bold: true, alinhar: "left" }); x += colTam;
      cel(x, y, cw, "1ª QUALIDADE", { fill: [225, 240, 233], corTexto: VERDE_ESCURO, bold: true }); x += cw;
      cel(x, y, cw, "2ª QUALIDADE", { fill: [250, 236, 220], corTexto: [150, 90, 20], bold: true }); x += cw;
      cel(x, y, cw, "TOTAL", { fill: [240, 240, 237], corTexto: CINZA, bold: true });
      y += hLinha;

      // Linhas por tamanho
      tams.forEach((t) => {
        const q1 = parseInt(g1[t], 10) || 0;
        const q2 = parseInt(g2[t], 10) || 0;
        x = mx;
        cel(x, y, colTam, t, { bold: true, alinhar: "left" }); x += colTam;
        cel(x, y, cw, q1 || "·", { corTexto: q1 ? TINTA : [190, 190, 185] }); x += cw;
        cel(x, y, cw, q2 || "·", { corTexto: q2 ? TINTA : [190, 190, 185] }); x += cw;
        cel(x, y, cw, q1 + q2, { fill: [250, 250, 248], corTexto: VERDE_ESCURO, bold: true });
        y += hLinha;
      });

      // Total
      x = mx;
      cel(x, y, colTam, "TOTAL", { fill: VERDE_ESCURO, corTexto: [255, 255, 255], bold: true, alinhar: "left" }); x += colTam;
      cel(x, y, cw, tot1, { fill: VERDE_ESCURO, corTexto: [255, 255, 255], bold: true }); x += cw;
      cel(x, y, cw, tot2, { fill: VERDE_ESCURO, corTexto: [255, 255, 255], bold: true }); x += cw;
      cel(x, y, cw, tot1 + tot2, { fill: VERDE_ESCURO, corTexto: [255, 255, 255], bold: true });
      y += hLinha + 13;
    }
  }

  // ── Rastreio dos processos (trilha visual) — reutilizável (corte/acabamento) ──
  const desenharProcessos = (titulo, lista) => {
    if (!lista || lista.length === 0) return;
    quebraSePreciso(14);
    const concluidos = lista.filter((p) => p.qtd >= pedido.total).length;
    tituloSecao(titulo, `${concluidos} de ${lista.length} concluídos`);
    y += 3; // respiro entre o título e o primeiro processo

    const cx = mx + 3; // centro das bolinhas (eixo da trilha)
    let topoAnterior = 0;
    lista.forEach(({ nome, qtd: feitas, grade, obs }, idx) => {
      const obsLinhas = obs ? doc.splitTextToSize(`Obs: ${obs}`, larg - mx * 2 - 14) : [];
      const temGrade = grade && Object.entries(grade).some(([, q]) => (parseInt(q, 10) || 0) > 0);
      const alturaItem = 6 + 7 + (temGrade ? 8 : 0) + obsLinhas.length * 4 + 5;
      const yAntesQuebra = y;
      quebraSePreciso(alturaItem);
      if (y < yAntesQuebra) topoAnterior = 0; // quebrou de página: não liga a trilha entre páginas

      const completo = feitas >= pedido.total;
      const parcial = feitas > 0 && !completo;
      const cor = completo ? VERDE : parcial ? AMBAR : [190, 190, 185];
      const topo = y - 1.6;

      if (idx > 0 && topoAnterior > 0 && topo - topoAnterior < 40 && topo > topoAnterior) {
        doc.setDrawColor(215).setLineWidth(0.5).line(cx, topoAnterior + 2.2, cx, topo - 2.2);
      }

      if (completo) {
        doc.setFillColor(...VERDE).circle(cx, topo, 2.2, "F");
        doc.setDrawColor(255).setLineWidth(0.5);
        doc.line(cx - 1, topo, cx - 0.2, topo + 0.9); doc.line(cx - 0.2, topo + 0.9, cx + 1.1, topo - 0.8);
      } else if (parcial) {
        doc.setFillColor(...AMBAR).circle(cx, topo, 2.2, "F");
        doc.setFillColor(255).circle(cx, topo, 0.8, "F");
      } else {
        doc.setFillColor(255).setDrawColor(...cor).setLineWidth(0.5).circle(cx, topo, 2.2, "FD");
      }

      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...(completo || parcial ? TINTA : CINZA));
      doc.text(nome, cx + 6, y);
      doc.setFont("helvetica", "bold").setTextColor(...(completo ? VERDE_ESCURO : parcial ? AMBAR : CINZA));
      doc.text(`${feitas}/${pedido.total}`, larg - mx, y, { align: "right" });

      const pct = Math.max(0, Math.min(1, feitas / (pedido.total || 1)));
      const barX = cx + 6, barW = larg - mx - barX - 20, barY = y + 1.8;
      doc.setFillColor(235, 235, 231).roundedRect(barX, barY, barW, 1.4, 0.7, 0.7, "F");
      if (pct > 0) { doc.setFillColor(...cor).roundedRect(barX, barY, barW * pct, 1.4, 0.7, 0.7, "F"); }
      y += 7;

      if (temGrade) {
        const ordenados = Object.entries(grade)
          .filter(([, q]) => (parseInt(q, 10) || 0) > 0)
          .sort(([a], [b]) => {
            const ia = TAMANHOS_GRADE.indexOf(a), ib = TAMANHOS_GRADE.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
          });
        const chipH = 5;
        let chipX = cx + 6;
        ordenados.forEach(([t, q]) => {
          doc.setFont("helvetica", "bold").setFontSize(7.5);
          const label = `${t}  ${q}`;
          const wChip = doc.getTextWidth(label) + 8;
          if (chipX + wChip > larg - mx) { chipX = cx + 6; y += chipH + 2; }
          doc.setFillColor(242, 241, 236).setDrawColor(226, 224, 216).setLineWidth(0.2).roundedRect(chipX, y, wChip, chipH, 1, 1, "FD");
          doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...TINTA).text(String(t), chipX + 3, y + 3.4);
          const wT = doc.getTextWidth(String(t));
          doc.setFont("helvetica", "normal").setTextColor(...CINZA).text(String(q), chipX + 3 + wT + 2, y + 3.4);
          chipX += wChip + 3;
        });
        y += chipH + 3;
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
  };

  if (dossie) {
    desenharProcessos("Processos do corte", processos);
    desenharProcessos("Processos do acabamento", processosAcabamento);
  } else {
    desenharProcessos("Processos", processos);
  }

  // ── Observações gerais ──
  if (pedido.observacoes) {
    const linhas = doc.splitTextToSize(pedido.observacoes, larg - mx * 2 - 10);
    quebraSePreciso(14 + linhas.length * 4.6);
    tituloSecao("Observações do pedido");
    doc.setFillColor(248, 248, 246).roundedRect(mx, y, larg - mx * 2, linhas.length * 4.6 + 6, 2, 2, "F");
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(60);
    doc.text(linhas, mx + 5, y + 6);
    y += linhas.length * 4.6 + 12;
  }

  // ── Remessas de oficina (para a etapa Oficina) ──
  if (remessasOficina && remessasOficina.length > 0) {
    const hLinha = 7;
    quebraSePreciso(18 + remessasOficina.length * hLinha);
    tituloSecao("Remessas de oficina");

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
      if (r.motivo) {
        const linhas = doc.splitTextToSize(`Motivo do fechamento: ${r.motivo}`, larguraTabela - 6);
        quebraSePreciso(linhas.length * 4 + 3);
        doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(...CINZA);
        linhas.forEach((ln) => { doc.text(ln, mx + 3, y + 3); y += 4; });
        y += 1.5;
      }
    });
    // Borda inferior da tabela
    doc.setDrawColor(225).setLineWidth(0.25).line(mx, y, larg - mx, y);
    y += 8;
  }

  // ── Aviamentos (para a etapa Aviamento) ──
  if (aviamentos && aviamentos.length > 0) {
    const hLinha = 7;
    quebraSePreciso(16 + aviamentos.length * hLinha);
    tituloSecao("Aviamentos");

    const larguraTabela = larg - mx * 2;
    const colItem = larguraTabela * 0.3;
    const colDet = larguraTabela * 0.34;
    const colCons = larguraTabela * 0.2;
    const colQtd = larguraTabela * 0.16;

    // Cabeçalho em faixa
    doc.setFillColor(244, 244, 241).rect(mx, y, larguraTabela, hLinha, "F");
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
    doc.text("ITEM", mx + 3, y + 4.7);
    doc.text("ESPECIFICAÇÃO", mx + colItem + 3, y + 4.7);
    doc.text("CONSUMO", mx + colItem + colDet + 3, y + 4.7);
    doc.text("QTD", larg - mx - 3, y + 4.7, { align: "right" });
    y += hLinha;

    aviamentos.forEach((a, idx) => {
      quebraSePreciso(hLinha);
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

      if (idx % 2 === 1) { doc.setFillColor(250, 250, 248).rect(mx, y, larguraTabela, hLinha, "F"); }
      doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...TINTA);
      doc.text(a.nome, mx + 3, y + 4.8);
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
      doc.text(doc.splitTextToSize(detalhe, colDet - 4)[0] || detalhe, mx + colItem + 3, y + 4.8);
      doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...(a.consumo ? TINTA : [190, 190, 185]));
      doc.text(a.consumo ? String(a.consumo) : "—", mx + colItem + colDet + 3, y + 4.8);
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
    tituloSecao("Imagens");
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

  // ── Histórico dos processos: quando cada processo desta etapa foi finalizado ──
  if (historico && historico.length) {
    const hLinha = 8;
    quebraSePreciso(16 + (historico.length + 1) * hLinha);
    tituloSecao("Histórico dos processos");
    const larguraTabela = larg - mx * 2;
    const colProc = larguraTabela * 0.4;
    const colData = larguraTabela * 0.4;
    const colQtd = larguraTabela - colProc - colData;
    const cel = (cx, cwid, texto, { fill, corTexto, bold, alinhar } = {}) => {
      if (fill) { doc.setFillColor(...fill); doc.rect(cx, y, cwid, hLinha, "F"); }
      doc.setDrawColor(230).setLineWidth(0.2).rect(cx, y, cwid, hLinha, "S");
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(9).setTextColor(...(corTexto || TINTA));
      const al = alinhar || "center";
      const tx = al === "left" ? cx + 2.5 : al === "right" ? cx + cwid - 2.5 : cx + cwid / 2;
      doc.text(String(texto), tx, y + hLinha * 0.66, { align: al });
    };
    let x = mx;
    cel(x, colProc, "PROCESSO", { fill: [240, 240, 237], corTexto: CINZA, bold: true, alinhar: "left" }); x += colProc;
    cel(x, colData, "FINALIZADO EM", { fill: [240, 240, 237], corTexto: CINZA, bold: true }); x += colData;
    cel(x, colQtd, "PEÇAS", { fill: [240, 240, 237], corTexto: CINZA, bold: true });
    y += hLinha;
    historico.forEach((n, i) => {
      x = mx;
      if (i % 2 === 1) { doc.setFillColor(247, 249, 247).rect(mx, y, larguraTabela, hLinha, "F"); }
      cel(x, colProc, n.nome, { bold: true, alinhar: "left" }); x += colProc;
      cel(x, colData, n.feito_em || "—", { corTexto: [70, 68, 62] }); x += colData;
      cel(x, colQtd, n.qtd != null ? String(n.qtd) : "—", { corTexto: [70, 68, 62] });
      y += hLinha;
    });
    y += 13;
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
    const colMov = larguraTabela * 0.5;
    const colQtd = larguraTabela * 0.16;
    const colData = larguraTabela - colMov - colQtd;
    const cel = (cx, cwid, texto, { fill, corTexto, bold, alinhar } = {}) => {
      if (fill) { doc.setFillColor(...fill); doc.rect(cx, y, cwid, hLinha, "F"); }
      doc.setDrawColor(230).setLineWidth(0.2).rect(cx, y, cwid, hLinha, "S");
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(9).setTextColor(...(corTexto || TINTA));
      const al = alinhar || "center";
      const tx = al === "left" ? cx + 2.5 : al === "right" ? cx + cwid - 2.5 : cx + cwid / 2;
      doc.text(String(texto), tx, y + hLinha * 0.66, { align: al });
    };
    let x = mx;
    cel(x, colMov, "MOVIMENTO", { fill: [240, 240, 237], corTexto: CINZA, bold: true, alinhar: "left" }); x += colMov;
    cel(x, colQtd, "PEÇAS", { fill: [240, 240, 237], corTexto: CINZA, bold: true }); x += colQtd;
    cel(x, colData, "DATA", { fill: [240, 240, 237], corTexto: CINZA, bold: true });
    y += hLinha;
    linhaTempo.forEach((m, i) => {
      quebraSePreciso(hLinha);
      x = mx;
      if (i % 2 === 1) { doc.setFillColor(247, 249, 247).rect(mx, y, larguraTabela, hLinha, "F"); }
      cel(x, colMov, `${rotuloLocal(m.de_local)} > ${rotuloLocal(m.para_local)}`, { bold: true, alinhar: "left" }); x += colMov;
      cel(x, colQtd, m.qtd != null ? String(m.qtd) : "—", { corTexto: [70, 68, 62] }); x += colQtd;
      cel(x, colData, fmtDT(m.data), { corTexto: [70, 68, 62] });
      y += hLinha;
    });
    y += 13;
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
