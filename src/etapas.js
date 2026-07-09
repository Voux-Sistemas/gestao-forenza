// Fonte única de verdade para as etapas do fluxo de produção.
// Para adicionar/remover/renomear uma etapa no futuro, mexa apenas aqui.

// Etapas "em produção", na ordem do fluxo real da fábrica.
// Atenção: "Entrada" é o valor gravado no banco (histórico antigo usa esse nome);
// na tela ela aparece como "Pedidos" — veja LABELS abaixo.
export const PRODUCAO = [
  "Entrada",
  "Ficha Técnica de Corte",
  "Corte",
  "Amostra",
  "Oficina",
  "Aviação",
  "Acabamento",
];

// Colunas visíveis no quadro kanban.
export const COLUNAS = PRODUCAO;

// Todos os destinos possíveis de uma movimentação (Estoque e Perda saem do quadro).
export const LOCAIS = [...PRODUCAO, "Estoque", "Perda"];

// Nome de exibição quando difere do valor gravado no banco.
const LABELS = { Entrada: "Pedidos", "Aviação": "Aviamento" };
export const rotuloLocal = (local) => LABELS[local] || local;

export const CORES_ETAPA = {
  Entrada: "var(--text-3)",
  "Ficha Técnica de Corte": "var(--accent)",
  Corte: "var(--accent)",
  Amostra: "var(--warning)",
  Oficina: "var(--warning)",
  Aviação: "var(--accent)",
  Acabamento: "var(--orange)",
  Estoque: "var(--success)",
  Perda: "var(--danger)",
};

// Saldo de peças de um pedido em cada local, reconstruído a partir dos movimentos.
// Locais desconhecidos (dados antigos como "Primeira"/"Segunda") são tratados sem quebrar.
export function calcularSaldos(pedidoId, total, movimentos) {
  const s = { Estoque: 0, Perda: 0 };
  for (const l of PRODUCAO) s[l] = 0;
  s.Entrada = total;
  for (const m of movimentos) {
    if (m.pedido_id !== pedidoId) continue;
    if (s[m.de_local] === undefined) s[m.de_local] = 0;
    if (s[m.para_local] === undefined) s[m.para_local] = 0;
    s[m.de_local] -= m.qtd;
    s[m.para_local] += m.qtd;
  }
  return s;
}

// Total de peças ainda dentro do fluxo de produção (qualquer coluna do quadro).
export const somaProducao = (s) => PRODUCAO.reduce((acc, l) => acc + (s[l] || 0), 0);
