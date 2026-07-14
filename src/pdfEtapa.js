import { jsPDF } from "jspdf";
import { rotuloLocal } from "./etapas.js";
import { gradePorTamanho, TAMANHOS_GRADE } from "./components/GradeTabela.jsx";

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

  // ── Grade (tabela horizontal, na ordem correta) ──
  const gradeTam = gradePorTamanho(pedido.grade);
  if (Object.keys(gradeTam).length > 0) {
    // Só os tamanhos usados, na ordem oficial (PP/36 → EXG/50); extras ao fim.
    const usados = TAMANHOS_GRADE.filter((t) => (parseInt(gradeTam[t], 10) || 0) > 0);
    const extras = Object.keys(gradeTam).filter((t) => !TAMANHOS_GRADE.includes(t) && (parseInt(gradeTam[t], 10) || 0) > 0);
    const cols = [...usados, ...extras];
    const total = cols.reduce((a, t) => a + (parseInt(gradeTam[t], 10) || 0), 0);

    quebraSePreciso(24);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text("GRADE DE TAMANHOS (PEDIDO COMPLETO)", mx, y);
    y += 5;

    const larguraTabela = larg - mx * 2;
    const colTotal = 22;
    const cw = Math.min(30, (larguraTabela - colTotal) / cols.length);
    const wTabela = cw * cols.length + colTotal;
    const hLinha = 8;

    // Cabeçalho (tamanhos)
    let x = mx;
    doc.setFillColor(244, 244, 241).setDrawColor(205).setLineWidth(0.25);
    cols.forEach((t) => {
      doc.rect(x, y, cw, hLinha, "FD");
      doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...CINZA);
      doc.text(String(t), x + cw / 2, y + 5.2, { align: "center" });
      x += cw;
    });
    doc.setFillColor(237, 247, 242).rect(x, y, colTotal, hLinha, "FD");
    doc.setTextColor(...VERDE_ESCURO).text("TOTAL", x + colTotal / 2, y + 5.2, { align: "center" });
    y += hLinha;

    // Linha de quantidades
    x = mx;
    cols.forEach((t) => {
      doc.setDrawColor(220).rect(x, y, cw, hLinha, "S");
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...TINTA);
      doc.text(String(gradeTam[t]), x + cw / 2, y + 5.4, { align: "center" });
      x += cw;
    });
    doc.setFillColor(237, 247, 242).setDrawColor(205).rect(x, y, colTotal, hLinha, "FD");
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...VERDE_ESCURO);
    doc.text(String(total), x + colTotal / 2, y + 5.4, { align: "center" });
    y += hLinha + 13;
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

  // ── Aviamentos (para a etapa Aviamento) ──
  if (aviamentos && aviamentos.length > 0) {
    quebraSePreciso(14 + aviamentos.length * 6);
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text("AVIAMENTOS", mx, y);
    y += 6;
    aviamentos.forEach((a) => {
      quebraSePreciso(7);
      // Monta a descrição conforme o tipo do item.
      const partes = [];
      if (a.largura) partes.push(`largura ${a.largura}`);
      if (a.tipoCampo === "ziper") {
        if (a.tipo) partes.push(a.tipo);
        if (a.tamanho) partes.push(a.tamanho);
      } else if (a.tamanho) {
        partes.push(`tam. ${a.tamanho}`);
      }
      if (a.consumo) partes.push(`consumo ${a.consumo}`);
      const detalhe = partes.join(" · ");
      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...TINTA);
      doc.text(a.nome, mx + 2, y);
      if (detalhe) {
        doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CINZA);
        doc.text(detalhe, mx + 45, y);
      }
      if (a.qtd) {
        doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...TINTA);
        doc.text(`Qtd: ${a.qtd}`, larg - mx - 2, y, { align: "right" });
      }
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
