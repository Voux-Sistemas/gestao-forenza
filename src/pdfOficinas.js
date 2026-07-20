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

  // ── Cabeçalho com a marca ──
  doc.setDrawColor(...TINTA).setLineWidth(1.5).circle(mx + 5.5, y, 5.5, "S");
  doc.setFillColor(...VERDE).circle(mx + 5.5, y, 2.4, "F");
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...TINTA);
  doc.text("F O R E N Z A", mx + 15, y - 0.5);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...CINZA);
  doc.text("Gestão de produção", mx + 15, y + 4.5);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`, larg - mx, y - 1.5, { align: "right" });
  y += 12;
  doc.setDrawColor(...VERDE_ESCURO).setLineWidth(0.7).line(mx, y, larg - mx, y);
  y += 11;

  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...TINTA);
  doc.text(titulo, mx, y);
  y += 10;

  const linhaTabela = (cols, larguras, { header, cor } = {}) => {
    let x = mx;
    if (header) { doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...CINZA); }
    else { doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...(cor || TINTA)); }
    cols.forEach((c, i) => {
      const alinhar = i >= cols.length - 3 && !isNaN(parseFloat(c)) ? "right" : "left";
      doc.text(String(c), alinhar === "right" ? x + larguras[i] - 2 : x + 1, y, { align: alinhar });
      x += larguras[i];
    });
    y += header ? 6 : 6.5;
  };

  let secaoN = 0;
  grupos.forEach((g) => {
    const totalFora = g.abertas.reduce((s, r) => s + (r.enviada - r.retornada), 0);
    quebra(30);
    // Título da oficina — numerado, estilo neutro (sem faixa verde)
    secaoN += 1;
    const num = String(secaoN).padStart(2, "0");
    const boxSize = 7;
    const boxTop = y - 4;
    const base = boxTop + boxSize * 0.72;
    const meio = boxTop + boxSize / 2;
    doc.setDrawColor(...TINTA).setLineWidth(0.4).roundedRect(mx, boxTop, boxSize, boxSize, 1.3, 1.3, "S");
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...TINTA);
    doc.text(num, mx + boxSize / 2, base, { align: "center" });
    const titleX = mx + boxSize + 3.5;
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...TINTA);
    doc.text(g.nome, titleX, base);
    const titleW = doc.getTextWidth(g.nome);
    const suf = `${g.abertas.length} em aberto · ${totalFora} peça(s) fora · ${g.fechadas.length} fechada(s)`;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CINZA);
    doc.text(suf, larg - mx, base, { align: "right" });
    const inicioRegua = titleX + titleW + 4;
    const fimRegua = larg - mx - doc.getTextWidth(suf) - 4;
    if (fimRegua > inicioRegua) doc.setDrawColor(226, 229, 223).setLineWidth(0.3).line(inicioRegua, meio, fimRegua, meio);
    y += 13;

    // Em aberto
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...AMBAR);
    doc.text("EM ABERTO", mx, y); y += 5;
    const larguras = [42, 42, 26, 26, 18, 20];
    if (g.abertas.length === 0) {
      doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(...CINZA);
      doc.text("Nenhuma remessa em aberto.", mx + 1, y); y += 7;
    } else {
      linhaTabela(["Pedido", "Saída", "Enviadas", "Retorn.", "Faltam", "Dias"], larguras, { header: true });
      g.abertas.forEach((r) => {
        quebra(8);
        const faltam = r.enviada - r.retornada;
        const dias = diasEntre(r.saida, null);
        linhaTabela([r.ref, fmt(r.saida), r.enviada, r.retornada, faltam, dias], larguras, { cor: dias > 7 ? VERMELHO : TINTA });
      });
    }
    y += 3;

    // Fechadas
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...VERDE_ESCURO);
    doc.text("FECHADAS", mx, y); y += 5;
    const largF = [42, 34, 34, 24, 20];
    if (g.fechadas.length === 0) {
      doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(...CINZA);
      doc.text("Nenhuma remessa fechada.", mx + 1, y); y += 7;
    } else {
      linhaTabela(["Pedido", "Saída", "Retorno", "Peças", "Dias"], largF, { header: true });
      g.fechadas.forEach((r) => {
        quebra(8);
        linhaTabela([r.ref, fmt(r.saida), fmt(r.fechamento), r.enviada, diasEntre(r.saida, r.fechamento)], largF);
      });
    }
    y += 10;
  });

  rodape();
  doc.save(`oficinas-${titulo.replace(/[^a-zA-Z0-9-_]/g, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
