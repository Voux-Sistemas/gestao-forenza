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
  "Ficha Técnica de Corte": "var(--teal)",
  Corte: "var(--azul)",
  Amostra: "var(--rosa)",
  Oficina: "var(--warning)",
  "Aviação": "var(--roxo)",
  Acabamento: "var(--orange)",
  Estoque: "var(--success)",
  Perda: "var(--danger)",
};

// Histórico das etapas de um pedido: a primeira vez que ele chegou em cada fase
// do fluxo, na ordem cronológica, derivado só dos movimentos.
// Retorna [{ etapa, rotulo, data, qtd, inicio }].
export function historicoEtapas(pedido, movimentos) {
  const movs = (movimentos || [])
    .filter((m) => m.pedido_id === pedido.id)
    .sort((a, b) => String(a.data || a.criado_em || "").localeCompare(String(b.data || b.criado_em || "")));
  const nodes = [];
  const origem = movs[0]?.de_local;
  if (origem && LOCAIS.includes(origem)) {
    nodes.push({ etapa: origem, rotulo: rotuloLocal(origem), data: pedido.criado_em || pedido.created_at || null, inicio: true });
  }
  const vistos = new Set(origem ? [origem] : []);
  movs.forEach((m) => {
    if (!m.para_local || vistos.has(m.para_local) || !LOCAIS.includes(m.para_local)) return;
    vistos.add(m.para_local);
    nodes.push({ etapa: m.para_local, rotulo: rotuloLocal(m.para_local), data: m.data || m.criado_em, qtd: m.qtd });
  });
  return nodes;
}

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
