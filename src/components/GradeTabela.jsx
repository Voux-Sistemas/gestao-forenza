import React from "react";

// Tamanhos numerados padrão (iguais à grade de faturamento / ficha física).
export const TAMANHOS_GRADE = ["PP/36", "P/38", "M/40", "G/42", "GG/44", "EG/46", "EGG/48", "EXG/50"];

// Normaliza qualquer grade para o formato de variantes: [{ variante, qtds: {tam: q} }].
// Aceita o formato novo (array) e o antigo simples ({P: 30}) para transição suave.
export function normalizarGrade(grade) {
  if (!grade) return [];
  if (Array.isArray(grade)) return grade.filter((l) => l && l.qtds && Object.keys(l.qtds).length);
  const qtds = Object.fromEntries(Object.entries(grade).filter(([, q]) => (parseInt(q, 10) || 0) > 0));
  return Object.keys(qtds).length ? [{ variante: "", qtds }] : [];
}

// Soma total de uma grade (todas as variantes e tamanhos).
export function totalGrade(grade) {
  return normalizarGrade(grade).reduce((a, l) => a + Object.values(l.qtds).reduce((b, q) => b + (parseInt(q, 10) || 0), 0), 0);
}

// Soma por tamanho, consolidando todas as variantes: { "P/38": 60, ... }.
export function gradePorTamanho(grade) {
  const out = {};
  normalizarGrade(grade).forEach((l) => {
    Object.entries(l.qtds).forEach(([t, q]) => { out[t] = (out[t] || 0) + (parseInt(q, 10) || 0); });
  });
  return out;
}

// Tabela somente-leitura no estilo da ficha física: variantes × tamanhos, com totais.
export default function GradeTabela({ grade, margem = "0 0 14px" }) {
  const linhas = normalizarGrade(grade);
  if (linhas.length === 0) return null;

  // Só mostra as colunas de tamanho que têm algum valor (tabela enxuta).
  const usados = TAMANHOS_GRADE.filter((t) => linhas.some((l) => (parseInt(l.qtds[t], 10) || 0) > 0));
  const cols = usados.length ? usados : TAMANHOS_GRADE;
  const temVariante = linhas.some((l) => l.variante && l.variante.trim());
  const totalTam = (t) => linhas.reduce((a, l) => a + (parseInt(l.qtds[t], 10) || 0), 0);
  const totalLinha = (l) => cols.reduce((a, t) => a + (parseInt(l.qtds[t], 10) || 0), 0);
  const geral = linhas.reduce((a, l) => a + totalLinha(l), 0);

  const cel = { border: "1px solid var(--border)", padding: "4px 6px", textAlign: "center", fontSize: 11.5, whiteSpace: "nowrap" };
  const th = { ...cel, background: "var(--surface-2)", fontSize: 9.5, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".3px" };

  return (
    <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 9, margin: margem }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {temVariante && <th style={{ ...th, textAlign: "left", minWidth: 84 }}>VARIANTE</th>}
            {cols.map((t) => <th key={t} style={th}>{t}</th>)}
            <th style={{ ...th, background: "var(--surface-3)", color: "var(--text-2)" }}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i}>
              {temVariante && <td style={{ ...cel, textAlign: "left", fontWeight: 600 }}>{l.variante || "—"}</td>}
              {cols.map((t) => {
                const q = parseInt(l.qtds[t], 10) || 0;
                return <td key={t} style={{ ...cel, color: q ? "var(--text)" : "var(--text-3)" }}>{q || "·"}</td>;
              })}
              <td style={{ ...cel, background: "var(--surface-2)", fontWeight: 700 }}>{totalLinha(l)}</td>
            </tr>
          ))}
          {(temVariante || linhas.length > 1) && (
            <tr>
              {temVariante && <td style={{ ...cel, textAlign: "left", fontWeight: 700, background: "var(--surface-2)", color: "var(--text-2)" }}>TOTAL</td>}
              {cols.map((t) => <td key={t} style={{ ...cel, fontWeight: 700, background: "var(--surface-2)", color: totalTam(t) ? "var(--accent)" : "var(--text-3)" }}>{totalTam(t) || "·"}</td>)}
              <td style={{ ...cel, background: "var(--accent-bg)", color: "var(--accent)", fontWeight: 800 }}>{geral}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
