import { jsPDF } from "jspdf";

const TINTA = [38, 37, 30];
const VERDE = [29, 158, 117];
const VERDE_ESCURO = [8, 80, 65];
const AMBAR = [186, 117, 23];
const VERMELHO = [200, 60, 55];
const CINZA = [130, 128, 120];

const fmt = (d) => {
  if (!d) return "—";
  const data = /^\d{4}-\d{2}-\d{2}/.test(d) ? new Date(d.slice(0, 10) + "T12:00") : new Date(d);
  return isNaN(data) ? "—" : data.toLocaleDateString("pt-BR");
};
const diasEntre = (ini, fim) => {
  if (!ini) return "—";
  const a = new Date(ini), b = fim ? new Date(fim) : new Date();
  return Math.max(0, Math.round((b - a) / 86400000));
};

// Relatório de oficina(s): remessas em aberto (peças fora da fábrica) + histórico de fechadas.
// `grupos` = [{ nome, abertas: [...], fechadas: [...] }]  — cada remessa já com { ref, saida, fechamento, enviada, retornada }
export function gerarPdfOficinas({ grupos, titulo }) {
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
  const quebra = (h) => { if (y + h > 280) { rodape(); doc.addPage(); y = 18; } };

  // ══ CAPA premium (mesma linguagem dos romaneios) ══
  const coverH = 46;
  const CAPA_A = [22, 55, 32], CAPA_B = [30, 72, 43];
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
    const fioH = 1.2, fioY = coverH - fioH, FIO_BASE = [18, 44, 26];
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
  const yM = 11;
  doc.setDrawColor(255).setLineWidth(1.1).circle(mx + 4.3, yM, 4.3, "S");
  doc.setFillColor(...ANEL).circle(mx + 4.3, yM, 1.9, "F");
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(255);
  doc.setCharSpace(1.4); doc.text("FORENZA", mx + 11.5, yM - 0.4); doc.setCharSpace(0);
  doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...FAINT);
  doc.setCharSpace(0.4); doc.text("GESTÃO DE PRODUÇÃO", mx + 12, yM + 3.6); doc.setCharSpace(0);

  const docTitulo = "RELATÓRIO DE OFICINAS";
  const docCS = 0.6;
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...CLARO);
  const wDocTit = doc.getTextWidth(docTitulo) + docCS * (docTitulo.length - 1);
  doc.setCharSpace(docCS); doc.text(docTitulo, larg - mx - wDocTit, yM - 1.6); doc.setCharSpace(0);
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...FAINT);
  doc.text(`Emitido ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`, larg - mx, yM + 2.4, { align: "right" });

  const eyebrow = "OFICINAS";
  const eyeCS = 0.5;
  doc.setFont("helvetica", "bold").setFontSize(7.5);
  const wTxtEye = doc.getTextWidth(eyebrow) + eyeCS * (eyebrow.length - 1);
  const padEye = 5.5, eyeH = 6.2;
  const wEye = wTxtEye + padEye * 2;
  const eyeX = larg - mx - wEye, eyeY = yM + 5.6;
  doc.setFillColor(...AMBAR_CAPA).roundedRect(eyeX, eyeY, wEye, eyeH, eyeH / 2, eyeH / 2, "F");
  doc.setTextColor(28, 22, 8).setCharSpace(eyeCS);
  doc.text(eyebrow, eyeX + padEye, eyeY + eyeH * 0.665);
  doc.setCharSpace(0);

  // KPI: total de peças fora da fábrica (linha única nivelada)
  const totalFora = grupos.reduce((s, g) => s + g.abertas.reduce((a, r) => a + (r.enviada - r.retornada), 0), 0);
  const totalAbertas = grupos.reduce((s, g) => s + g.abertas.length, 0);
  const numTxt = String(totalFora);
  doc.setFont("helvetica", "bold").setFontSize(15);
  const wNum = doc.getTextWidth(numTxt);
  doc.setFont("helvetica", "bold").setFontSize(6.5);
  const kpiCS = 0.3, kpiRot = "PEÇAS FORA DA FÁBRICA";
  const wRotKpi = doc.getTextWidth(kpiRot) + kpiCS * (kpiRot.length - 1);
  const padCard = 5.5, cardH = 12;
  const cardW = padCard + wRotKpi + 3.5 + 0.3 + 3.5 + wNum + padCard;
  const cardX = larg - mx - cardW;
  const cardY = coverH - 6 - cardH;
  doc.setFillColor(...CARD_BG).setDrawColor(...CARD_BORDA).setLineWidth(0.35).roundedRect(cardX, cardY, cardW, cardH, cardH / 2, cardH / 2, "FD");
  doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(...CLARO);
  doc.setCharSpace(kpiCS); doc.text(kpiRot, cardX + padCard, cardY + cardH / 2 + 0.85); doc.setCharSpace(0);
  const div1X = cardX + padCard + wRotKpi + 3.5;
  doc.setDrawColor(...CARD_DIV).setLineWidth(0.3).line(div1X, cardY + 3, div1X, cardY + cardH - 3);
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(255);
  doc.text(numTxt, div1X + 0.3 + 3.5, cardY + cardH / 2 + 1.9);

  // identidade (esquerda)
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(255);
  const heroLarg = cardX - mx - 10;
  doc.text(doc.splitTextToSize(String(titulo || "Oficinas"), heroLarg > 40 ? heroLarg : 90)[0] || "Oficinas", mx, cardY + 1.5);
  let metaX = mx;
  [["OFICINAS", `${grupos.length}`], ["REMESSAS EM ABERTO", `${totalAbertas}`]].forEach(([rot, val]) => {
    doc.setFont("helvetica", "bold").setFontSize(6.3).setTextColor(...FAINT).setCharSpace(0.35);
    doc.text(rot, metaX, cardY + 7.2);
    const wRot = doc.getTextWidth(rot) + rot.length * 0.35;
    doc.setCharSpace(0);
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(234, 243, 236);
    doc.text(String(val), metaX, cardY + 12);
    metaX += Math.max(wRot, doc.getTextWidth(String(val))) + 11;
  });
  y = coverH + 11;

  // ── Tabela emoldurada (moldura arredondada + faixa de cabeçalho + divisórias + zebra) ──
  const RAIO = 3, BORDA = [231, 234, 228];
  const hLinha = 7.5;
  const tabela = (headers, larguras, aligns, linhas) => {
    const larguraTabela = larg - mx * 2;
    let tabTop = y;
    const fecha = () => {
      doc.setDrawColor(...BORDA).setLineWidth(0.4).roundedRect(mx, tabTop, larguraTabela, y - tabTop, RAIO, RAIO, "S");
    };
    const cabecalho = () => {
      doc.setFillColor(246, 248, 244);
      doc.roundedRect(mx, y, larguraTabela, hLinha, RAIO, RAIO, "F");
      doc.rect(mx, y + hLinha - RAIO, larguraTabela, RAIO, "F");
      doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...CINZA);
      let x = mx;
      headers.forEach((h, i) => {
        doc.text(String(h).toUpperCase(), aligns[i] === "right" ? x + larguras[i] - 3.5 : x + 3.5, y + 4.9, { align: aligns[i] });
        x += larguras[i];
      });
      y += hLinha;
    };
    cabecalho();
    linhas.forEach((ln, idx) => {
      if (y + hLinha + 2 > 280) { fecha(); quebra(hLinha * 2 + 2); tabTop = y; cabecalho(); }
      doc.setDrawColor(240, 243, 238).setLineWidth(0.3).line(mx, y, larg - mx, y);
      if (idx % 2 === 1) { doc.setFillColor(250, 251, 249).rect(mx + 0.3, y + 0.15, larguraTabela - 0.6, hLinha - 0.3, "F"); }
      let x = mx;
      ln.cols.forEach((c, i) => {
        doc.setFont("helvetica", i === 0 ? "bold" : "normal").setFontSize(8.5).setTextColor(...(ln.cor || (i === 0 ? TINTA : [90, 88, 82])));
        const txt = doc.splitTextToSize(String(c), larguras[i] - 5)[0] || String(c);
        doc.text(txt, aligns[i] === "right" ? x + larguras[i] - 3.5 : x + 3.5, y + 5, { align: aligns[i] });
        x += larguras[i];
      });
      y += hLinha;
    });
    fecha();
  };

  let secaoN = 0;
  grupos.forEach((g) => {
    const totalForaG = g.abertas.reduce((s, r) => s + (r.enviada - r.retornada), 0);
    quebra(46);   // título + rótulo + cabeçalho + 1ª linha juntos

    // Título da oficina — chip verde-claro numerado (padrão dos romaneios)
    secaoN += 1;
    const num = String(secaoN).padStart(2, "0");
    const boxSize = 6;
    const boxTop = y;
    const base = boxTop + boxSize * 0.73;
    const meio = boxTop + boxSize / 2;
    doc.setFillColor(233, 244, 228).roundedRect(mx, boxTop, boxSize, boxSize, 2, 2, "F");
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...VERDE_ESCURO);
    doc.text(num, mx + boxSize / 2, base, { align: "center" });
    const titleX = mx + boxSize + 4;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...TINTA);
    doc.text(g.nome, titleX, base);
    const titleW = doc.getTextWidth(g.nome);
    const suf = `${g.abertas.length} em aberto · ${totalForaG} peça(s) fora · ${g.fechadas.length} fechada(s)`;
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
    doc.text(suf, larg - mx, base, { align: "right" });
    const inicioRegua = titleX + titleW + 5;
    const fimRegua = larg - mx - doc.getTextWidth(suf) - 5;
    if (fimRegua > inicioRegua) doc.setDrawColor(232, 235, 229).setLineWidth(0.3).line(inicioRegua, meio, fimRegua, meio);
    y = boxTop + boxSize + 7;

    // Em aberto
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...AMBAR);
    doc.setCharSpace(0.5); doc.text("EM ABERTO", mx, y); doc.setCharSpace(0);
    y += 3.5;
    if (g.abertas.length === 0) {
      doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(...CINZA);
      doc.text("Nenhuma remessa em aberto.", mx + 1, y + 3); y += 9;
    } else {
      tabela(
        ["Pedido", "Saída", "Enviadas", "Retorn.", "Faltam", "Dias"],
        [42, 42, 26, 26, 18, 24],
        ["left", "left", "right", "right", "right", "right"],
        g.abertas.map((r) => {
          const dias = diasEntre(r.saida, null);
          return { cols: [r.ref, fmt(r.saida), r.enviada, r.retornada, r.enviada - r.retornada, dias], cor: dias > 7 ? VERMELHO : null };
        })
      );
      y += 6;
    }

    // Fechadas
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...VERDE_ESCURO);
    doc.setCharSpace(0.5); doc.text("FECHADAS", mx, y); doc.setCharSpace(0);
    y += 3.5;
    if (g.fechadas.length === 0) {
      doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(...CINZA);
      doc.text("Nenhuma remessa fechada.", mx + 1, y + 3); y += 9;
    } else {
      tabela(
        ["Pedido", "Saída", "Retorno", "Peças", "Dias"],
        [42, 36, 36, 30, 34],
        ["left", "left", "left", "right", "right"],
        g.fechadas.map((r) => ({ cols: [r.ref, fmt(r.saida), fmt(r.fechamento), r.enviada, diasEntre(r.saida, r.fechamento)] }))
      );
      y += 6;
    }
    y += 6;   // respiro entre oficinas
  });

  rodape();
  doc.save(`oficinas-${titulo.replace(/[^a-zA-Z0-9-_]/g, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
