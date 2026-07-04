import { supabase } from "./supabaseClient.js";
import { calcularSaldos, somaProducao } from "./etapas.js";

// Um pedido é considerado concluído quando não resta NENHUMA peça sob gestão:
// nada em produção, nada aguardando inspeção e nada em 1ª/2ª qualidade —
// ou seja, tudo foi expedido (baixa) ou registrado como perda.
// Quando isso acontece, o pedido é arquivado e passa a viver na página Histórico.
export async function arquivarSeConcluido(pedidoId) {
  const { data: pedido } = await supabase.from("pedidos").select("id, total, arquivado").eq("id", pedidoId).single();
  if (!pedido || pedido.arquivado) return false;

  const { data: movs } = await supabase.from("movimentos").select("pedido_id, de_local, para_local, qtd").eq("pedido_id", pedidoId);
  const s = calcularSaldos(pedido.id, pedido.total, movs || []);
  const restante = somaProducao(s) + (s.Estoque || 0) + (s.Primeira || 0) + (s.Segunda || 0);
  if (restante > 0) return false;

  const { error } = await supabase.from("pedidos").update({ arquivado: true, arquivado_em: new Date().toISOString() }).eq("id", pedido.id);
  return !error;
}
