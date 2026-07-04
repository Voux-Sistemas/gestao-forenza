import { jsPDF } from "jspdf";
import { rotuloLocal } from "./etapas.js";

const fmtData = (d) => (d ? new Date(d + "T12:00").toLocaleDateString("pt-BR") : null);

// Gera o PDF ("romaneio") das peças de um pedido em uma etapa específica.
export function gerarPdfEtapa({ pedido, cliente, local, qtd, parte, totalPartes }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const larg = doc.internal.pageSize.getWidth();
  const mx = 18; // margem lateral
  let y = 20;

  // Cabeçalho
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(8, 80, 65);
  doc.text("FORENZA", mx, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
  doc.text("Gestão de produção", mx, y + 5);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`, larg - mx, y, { align: "right" });
  y += 12;
  doc.setDrawColor(200).setLineWidth(0.3).line(mx, y, larg - mx, y);
  y += 10;

  // Título
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(30);
  doc.text(`Romaneio de produção — ${rotuloLocal(local)}`, mx, y);
  y += 6;
  if (totalPartes > 1) {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
    doc.text(`Parte ${parte} de ${totalPartes} do pedido`, mx, y);
    y += 6;
  }
  y += 4;

  // Quantidade em destaque
  doc.setFillColor(237, 247, 242);
  doc.roundedRect(mx, y, larg - mx * 2, 18, 2, 2, "F");
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(8, 80, 65);
  doc.text(`${qtd} peças`, mx + 6, y + 12);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
  doc.text(`nesta etapa · pedido com ${pedido.total} no total`, mx + 6 + doc.getTextWidth(`${qtd} peças`) + 4, y + 12);
  y += 28;

  // Campos
  const linha = (rotulo, valor) => {
    if (!valor) return;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120);
    doc.text(rotulo, mx, y);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(30);
    doc.text(String(valor), mx + 42, y);
    y += 7;
  };
  linha("Referência", pedido.referencia);
  linha("Cliente", cliente);
  linha("Marca", pedido.marca);
  linha("Prazo", fmtData(pedido.prazo));
  linha("Cor", pedido.cor);
  linha("Peso", pedido.peso);
  linha("Volume", pedido.volume);

  // Grade (do pedido completo)
  if (pedido.grade && Object.keys(pedido.grade).length > 0) {
    y += 4;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120);
    doc.text("Grade (pedido completo)", mx, y);
    y += 6;
    let x = mx;
    doc.setFontSize(10);
    Object.entries(pedido.grade).forEach(([t, q]) => {
      const txt = `${t}  ${q}`;
      const w = doc.getTextWidth(txt) + 10;
      if (x + w > larg - mx) { x = mx; y += 10; }
      doc.setDrawColor(190).setFillColor(248, 248, 246);
      doc.roundedRect(x, y - 5.5, w, 8, 2, 2, "FD");
      doc.setFont("helvetica", "bold").setTextColor(30);
      doc.text(txt, x + 5, y);
      x += w + 4;
    });
    y += 12;
  }

  // Observações
  if (pedido.observacoes) {
    y += 2;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(120);
    doc.text("Observações", mx, y);
    y += 6;
    doc.setTextColor(50).setFontSize(10);
    const linhas = doc.splitTextToSize(pedido.observacoes, larg - mx * 2);
    doc.text(linhas, mx, y);
    y += linhas.length * 5 + 4;
  }

  // Rodapé
  doc.setDrawColor(220).setLineWidth(0.2).line(mx, 285, larg - mx, 285);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(150);
  doc.text("Gerado pelo sistema Forenza — Gestão de produção", mx, 290);

  const nomeArquivo = `${(pedido.referencia || "pedido").replace(/[^a-zA-Z0-9-_]/g, "_")}-${rotuloLocal(local).replace(/[^a-zA-Z0-9-_]/g, "_")}${totalPartes > 1 ? `-parte${parte}de${totalPartes}` : ""}.pdf`;
  doc.save(nomeArquivo);
}
