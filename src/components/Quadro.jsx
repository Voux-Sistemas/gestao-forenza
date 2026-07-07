import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient.js";
import { Plus, ArrowRight, ArrowUpRight, ArrowDownLeft, Package, ClipboardList, AlertTriangle, Boxes, Trash2, Download, Scissors, Factory, Sparkles, Calendar, Search, Check, Clock, FileText, Shirt, Paperclip, ChevronDown, Tags, FileDown } from "lucide-react";
import { comprimirImagem } from "../comprimirImagem.js";
import { gerarPdfEtapa } from "../pdfEtapa.js";
import { arquivarSeConcluido } from "../arquivamento.js";
import GradeTabela, { normalizarGrade, totalGrade, gradePorTamanho } from "./GradeTabela.jsx";
import GradeEditor, { limparGrade } from "./GradeEditor.jsx";

import Toast, { avisoDeMovimento } from "./Toast.jsx";
import Overlay from "./Gaveta.jsx";
import { LOCAIS, COLUNAS, CORES_ETAPA as CORES, calcularSaldos, somaProducao, rotuloLocal } from "../etapas.js";

const ICONES_COLUNA = {
  Entrada: Download, "Ficha Técnica de Corte": FileText, Corte: Scissors,
  Amostra: Shirt, Oficina: Factory, Aviação: Tags,
  Acabamento: Sparkles, Estoque: Boxes, Perda: Trash2,
};
const PALETA_TAG = [
  { bg: "var(--accent-bg)", cor: "var(--accent)" },
  { bg: "var(--success-bg)", cor: "var(--success)" },
  { bg: "var(--warning-bg)", cor: "var(--warning)" },
  { bg: "var(--orange-bg)", cor: "var(--orange)" },
  { bg: "var(--danger-bg)", cor: "var(--danger)" },
];
function corDaTag(txt) {
  let h = 0;
  for (let i = 0; i < txt.length; i++) h = (h * 31 + txt.charCodeAt(i)) >>> 0;
  return PALETA_TAG[h % PALETA_TAG.length];
}

export default function Quadro({ session, perfil }) {
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [remessas, setRemessas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mover, setMover] = useState(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [arrastando, setArrastando] = useState(null); // { pedido, local, saldo } do card sendo arrastado
  const [colunaHover, setColunaHover] = useState(null); // coluna destacada durante o arraste

  const carregar = useCallback(async () => {
    const [p, c, o] = await Promise.all([
      supabase.from("pedidos").select("*").eq("arquivado", false).order("id"),
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("oficinas").select("*").order("nome_empresa"),
    ]);
    const ids = (p.data || []).map((x) => x.id);
    const [m, r] = ids.length ? await Promise.all([
      supabase.from("movimentos").select("*").in("pedido_id", ids).order("id"),
      supabase.from("remessas_oficina").select("*").in("pedido_id", ids).order("id"),
    ]) : [{ data: [] }, { data: [] }];
    setPedidos(p.data || []); setMovimentos(m.data || []);
    setClientes(c.data || []); setOficinas(o.data || []); setRemessas(r.data || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const podeEditar = perfil?.papel !== "cliente"; // funcionários também marcam processos e movem peças
  const ehMaster = perfil?.papel === "master";
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const canal = supabase.channel("quadro")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentos" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregar]);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || "—";
  const podeVerTudo = ["master", "chefe_geral"].includes(perfil?.papel);
  const colunas = podeVerTudo ? COLUNAS : (perfil?.setor ? [perfil.setor] : []);

  if (carregando) return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando quadro…</div>;
  if (!podeVerTudo && !perfil?.setor) return <div style={{ padding: 28, color: "var(--text-2)" }}>Seu usuário ainda não tem um setor definido.</div>;

  return (
    <div className="fade-in" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "20px 26px 0" }}>

      <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Quadro de produção</h2>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>Clique num card ou arraste-o para outra coluna para mover as peças.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {podeVerTudo && (
            <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
              <Search size={15} style={{ position: "absolute", left: 11, color: "var(--text-3)" }} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar referência ou cliente…" style={{ padding: "9px 12px 9px 33px", fontSize: 13, border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface)", color: "var(--text)", width: 250, outline: "none" }} />
            </div>
          )}
          {podeVerTudo && (
            <button onClick={() => setNovoAberto(true)} style={btnPrimary}><Plus size={16} /> Novo pedido</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 10, overflowX: "auto", alignItems: "stretch", paddingBottom: 2 }}>
        {colunas.map((local) => {
          const cards = pedidos
            .map((pe) => ({ pe, saldo: calcularSaldos(pe.id, pe.total, movimentos) }))
            .filter(({ saldo }) => saldo[local] > 0)
            .filter(({ pe }) => {
              const q = busca.trim().toLowerCase();
              if (!q) return true;
              return (pe.referencia || "").toLowerCase().includes(q) || (pe.marca || "").toLowerCase().includes(q) || nomeCliente(pe.cliente_id).toLowerCase().includes(q);
            });
          const IconeCol = ICONES_COLUNA[local] || Package;
          const alvoValido = arrastando && arrastando.local !== local;
          const destacada = alvoValido && colunaHover === local;
          return (
            <div
              key={local}
              onDragOver={(e) => { if (alvoValido) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (colunaHover !== local) setColunaHover(local); } }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setColunaHover((c) => (c === local ? null : c)); }}
              onDrop={(e) => {
                e.preventDefault();
                setColunaHover(null);
                if (alvoValido) setMover({ ...arrastando, destinoInicial: local });
                setArrastando(null);
              }}
              style={{
                ...coluna,
                borderTop: `3px solid ${CORES[local]}`,
                outline: destacada ? "2px dashed var(--accent)" : "none",
                outlineOffset: -2,
                background: destacada ? "var(--accent-bg)" : coluna.background,
                transition: "background .12s ease",
              }}
            >
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <IconeCol size={15} style={{ color: CORES[local] }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.15 }}>{rotuloLocal(local)}</span>
                <span style={{ fontSize: 11, color: "var(--text-2)", marginLeft: "auto", fontWeight: 600, background: "var(--surface-2)", borderRadius: 99, padding: "1px 8px" }}>{cards.length}</span>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 2 }}>
                {cards.map(({ pe, saldo }) => {
                  const urg = urgenciaDoCard(pe, local);
                  const partes = COLUNAS.filter((l) => saldo[l] > 0); // divisões do pedido pelo fluxo
                  const parte = partes.indexOf(local) + 1;
                  const procBadges = badgesDoCard(pe, local);
                  const infoRem = local === "Oficina" ? infoRemessasOficina(pe, remessas, oficinas) : null;
                  const pintarCard = urg && (urg.nivel === "atrasado" || urg.nivel === "hoje");
                  const estiloCard = pintarCard ? { ...card, background: urg.bg, border: `1px solid ${urg.borda}` } : card;
                  return (
                  <button
                    key={pe.id}
                    className="lift"
                    draggable={podeEditar}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(pe.id)); // necessário pro Firefox iniciar o arraste
                      setArrastando({ pedido: pe, local, saldo: saldo[local] });
                    }}
                    onDragEnd={() => { setArrastando(null); setColunaHover(null); }}
                    onClick={() => setMover({ pedido: pe, local, saldo: saldo[local], cliente: nomeCliente(pe.cliente_id), parte, totalPartes: partes.length })}
                    style={{
                      ...estiloCard,
                      cursor: podeEditar ? "grab" : "pointer",
                      opacity: arrastando?.pedido?.id === pe.id && arrastando?.local === local ? 0.4 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeCliente(pe.cliente_id)}</span>
                      {partes.length > 1 && (
                        <span title={`Parte ${parte} de ${partes.length} deste pedido`} style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap", color: "var(--accent)", background: "var(--accent-bg)", flexShrink: 0 }}>{parte}/{partes.length}</span>
                      )}
                      {pe.marca && <span style={{ fontSize: 10.5, fontWeight: 600, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap", color: "var(--text-2)", background: "var(--surface-2)", flexShrink: 0 }}>{pe.marca}</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 500, margin: "2px 0 6px" }}>{pe.referencia}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {(() => {
                        const completo = saldo[local] === pe.total;
                        const corQtd = completo ? "var(--success)" : "var(--warning)";
                        return <>
                          <Package size={13} style={{ color: corQtd }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: corQtd }}>{saldo[local]}</span>
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>de {pe.total}</span>
                        </>;
                      })()}
                      {pe.prazo && (() => {
                        const dp = diasAtePrazo(pe.prazo);
                        const corData = dp === null ? "var(--text-3)" : dp < 0 ? "var(--danger)" : dp <= 3 ? "var(--warning)" : "var(--success)";
                        return <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: corData }}><Calendar size={12} />{fmtCurto(pe.prazo)}</span>;
                      })()}
                    </div>
                    {urg && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9 }}>
                        {urg.nivel === "atrasado"
                          ? <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: 99, background: urg.cor, flexShrink: 0 }} />
                          : <urg.Icone size={13} style={{ color: urg.cor }} />}
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: urg.cor }}>{urg.label}</span>
                      </div>
                    )}
                    {infoRem && (
                      <div style={{ marginTop: 9, padding: "8px 10px 8px 12px", background: "var(--surface-2)", borderRadius: 8, borderLeft: "3px solid var(--text-3)" }}>
                        <div style={{ fontSize: 11.5, color: "var(--text)", fontWeight: 700 }}>{infoRem.nomeOficina}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                          <span style={{ fontSize: 10.5, color: "var(--text-2)" }}>{infoRem.totalAbertas > 1 ? `${infoRem.totalAbertas} remessas em aberto` : `há ${infoRem.dias} ${infoRem.dias === 1 ? "dia" : "dias"}`}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: infoRem.dias > 7 ? "var(--danger)" : "var(--text-2)" }}>faltam {infoRem.totalRestante}</span>
                        </div>
                      </div>
                    )}
                    {local === "Amostra" && (pe.anexo_amostra || pe.obs_amostra) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                        {pe.anexo_amostra && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: "var(--surface)", color: "var(--accent)", border: "1px solid var(--border)" }}><Paperclip size={10} /> anexo</span>}
                        {pe.obs_amostra && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: "var(--surface)", color: "var(--text-2)", border: "1px solid var(--border)" }}>obs</span>}
                      </div>
                    )}
                    {procBadges.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                        {procBadges.map((b, i) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: "var(--surface)", color: b.cor, border: "1px solid var(--border)" }}>{b.label}</span>
                        ))}
                      </div>
                    )}
                  </button>
                  );
                })}
                {cards.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 2px" }}>vazio</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 18, marginTop: 10, padding: "9px 0", borderTop: "1px solid var(--border)", flexWrap: "wrap", fontSize: 12, color: "var(--text-2)" }}>
        <span style={{ fontWeight: 600, color: "var(--text-3)" }}>Prazo do cartão:</span>
        {[["No prazo", "var(--border-strong)"], ["Vence em 2 dias", "var(--warning)"], ["Vence amanhã", "var(--orange)"], ["Vence hoje / atrasado", "var(--danger)"]].map(([txt, cor]) => (
          <span key={txt} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: cor }} />{txt}
          </span>
        ))}
      </div>

      {mover && <ModalMover dados={mover} oficinas={oficinas} remessas={remessas} movimentos={movimentos} session={session} podeEditar={podeEditar} ehMaster={ehMaster} onFechar={() => setMover(null)} onOk={(info) => { setMover(null); carregar(); setAviso(avisoDeMovimento(info)); }} />}
      <Toast aviso={aviso} onFechar={() => setAviso(null)} />
      {novoAberto && <ModalNovo clientes={clientes} oficinas={oficinas} onFechar={() => setNovoAberto(false)} onOk={() => { setNovoAberto(false); carregar(); }} />}
    </div>
  );
}

function ModalMover({ dados, oficinas, remessas, movimentos, session, podeEditar, ehMaster, onFechar, onOk }) {
  const { pedido, local, saldo, destinoInicial, cliente, parte, totalPartes } = dados;
  const destinos = LOCAIS.filter((l) => l !== local);
  const [editarGrade, setEditarGrade] = useState(false);

  const [gerandoPdf, setGerandoPdf] = useState(false);
  async function baixarPdf() {
    if (gerandoPdf) return;
    setGerandoPdf(true);
    try {
      // Busca o pedido ATUALIZADO do banco — os processos podem ter sido marcados agora,
      // e o objeto do modal ficaria desatualizado.
      const { data: fresco } = await supabase.from("pedidos").select("*").eq("id", pedido.id).single();
      const ped = fresco || pedido;

      const listaProc = local === "Corte" ? PROCESSOS_CORTE : local === "Acabamento" ? PROCESSOS_ACABAMENTO : null;
      const mapaProc = (local === "Corte" ? ped.processos_corte : ped.processos_acabamento) || {};

      // Remessas de oficina deste pedido (para o PDF da etapa Oficina).
      let remessasOficina = null;
      if (local === "Oficina") {
        const { data: rs } = await supabase.from("remessas_oficina").select("*").eq("pedido_id", ped.id).order("id");
        remessasOficina = (rs || []).map((r) => ({
          oficina: (oficinas || []).find((o) => o.id === r.oficina_id)?.nome_empresa || "—",
          saida: r.data_saida, retorno: r.data_fechamento,
          enviada: r.qtd_enviada, retornada: r.qtd_retornada,
        }));
      }

      // Imagens: foto de referência (da solicitação) e anexo da amostra.
      const imagens = [];
      if (ped.anexo_amostra) {
        const u = supabase.storage.from("anexos").getPublicUrl(ped.anexo_amostra).data.publicUrl;
        if (u) imagens.push({ url: u, rotulo: "Amostra" });
      }
      if (ped.solicitacao_id) {
        const { data: sol } = await supabase.from("solicitacoes").select("imagem_url").eq("id", ped.solicitacao_id).single();
        if (sol && sol.imagem_url) imagens.push({ url: sol.imagem_url, rotulo: "Referência" });
      }

      await gerarPdfEtapa({
        pedido: ped, cliente: cliente || ped.referencia, local, qtd: saldo,
        parte: parte || 1, totalPartes: totalPartes || 1,
        oficina: (oficinas || []).find((o) => o.id === ped.oficina_id)?.nome_empresa || null,
        processos: listaProc ? listaProc.map((n) => ({ nome: n, qtd: qtdProcesso(mapaProc[n], ped.total), grade: (mapaProc[n] && mapaProc[n].grade) || null, obs: (mapaProc[n] && mapaProc[n].obs) || "" })) : null,
        remessasOficina,
        imagens,
      });
    } finally {
      setGerandoPdf(false);
    }
  }

  const [destino, setDestino] = useState(destinoInicial && destinos.includes(destinoInicial) ? destinoInicial : "");
  const [qtd, setQtd] = useState(saldo);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [verResumo, setVerResumo] = useState(false);
  const [oficinaId, setOficinaId] = useState(pedido.oficina_id ? String(pedido.oficina_id) : "");
  const [bloqueado, setBloqueado] = useState(local === "Corte" && corteBloqueado(pedido));
  // remessas em aberto desse pedido (saída pra oficina ainda não fechada)
  const remessasAbertas = (remessas || []).filter((r) => r.pedido_id === pedido.id && !r.data_fechamento);
  const [remessaId, setRemessaId] = useState(remessasAbertas[0]?.id || "");

  async function mudarOficina(novo) {
    setOficinaId(novo);
    await supabase.from("pedidos").update({ oficina_id: novo ? Number(novo) : null }).eq("id", pedido.id);
  }

  async function excluirPedido() {
    if (!window.confirm(`Excluir o pedido ${pedido.referencia} e todo o seu histórico? Esta ação não pode ser desfeita.`)) return;
    await supabase.from("movimentos").delete().eq("pedido_id", pedido.id);
    const { error } = await supabase.from("pedidos").delete().eq("id", pedido.id);
    if (error) { window.alert("Não foi possível excluir: " + error.message); return; }
    onOk();
  }

  async function confirmar() {
    setErro(null);
    const q = parseInt(qtd, 10);
    if (!q || q < 1) return setErro("Quantidade inválida.");
    if (q > saldo) return setErro(`Só há ${saldo} peças em ${rotuloLocal(local)}.`);
    if (bloqueado) return setErro("Corte travado: o tecido está em descanso. Libere o descanso antes de mover.");
    if (!destino) return setErro("Selecione o destino.");

    // Saída pra Oficina exige uma oficina selecionada (cria nova remessa)
    if (destino === "Oficina" && !oficinaId) return setErro("Selecione a oficina responsável antes de enviar.");
    // Volta da Oficina exige escolher de qual remessa abater
    if (local === "Oficina" && remessasAbertas.length > 0 && !remessaId) return setErro("Escolha de qual remessa essas peças estão retornando.");
    if (local === "Oficina" && remessaId) {
      const r = remessasAbertas.find((x) => x.id === Number(remessaId));
      const restante = r ? r.qtd_enviada - r.qtd_retornada : 0;
      if (q > restante) return setErro(`Essa remessa tem ${restante} peça(s) em aberto.`);
    }

    setSalvando(true);

    let novaRemessaId = null;
    // 1) Saída pra Oficina: cria remessa
    if (destino === "Oficina") {
      const r = await supabase.from("remessas_oficina").insert({
        pedido_id: pedido.id, oficina_id: Number(oficinaId), qtd_enviada: q,
      }).select().single();
      if (r.error) { setSalvando(false); return setErro("Falha ao registrar a remessa: " + r.error.message); }
      novaRemessaId = r.data.id;
    }
    // 2) Volta da Oficina: abate remessa
    if (local === "Oficina" && remessaId) {
      const r = remessasAbertas.find((x) => x.id === Number(remessaId));
      const novaQtd = r.qtd_retornada + q;
      const fechada = novaQtd >= r.qtd_enviada;
      const up = await supabase.from("remessas_oficina").update({
        qtd_retornada: novaQtd,
        data_fechamento: fechada ? new Date().toISOString().slice(0, 10) : null,
      }).eq("id", r.id);
      if (up.error) { setSalvando(false); return setErro("Falha ao abater a remessa: " + up.error.message); }
      novaRemessaId = r.id;
    }

    const { error } = await supabase.from("movimentos").insert({
      pedido_id: pedido.id, de_local: local, para_local: destino, qtd: q,
      usuario_id: session.user.id, remessa_id: novaRemessaId,
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    if (destino === "Perda") await arquivarSeConcluido(pedido.id); // última peça perdida pode concluir o pedido
    onOk({ destino, qtd: q, referencia: pedido.referencia });
  }

  const rodape = podeEditar ? (
    <>
      {bloqueado && <p style={{ fontSize: 12, color: "var(--danger)", margin: "0 0 10px", fontWeight: 600 }}>Corte travado — o tecido está em descanso. Libere o descanso para mover.</p>}
      {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "0 0 10px" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={confirmar} disabled={salvando || bloqueado} style={{ ...btnPrimary, flex: 1, opacity: bloqueado ? 0.5 : 1, cursor: bloqueado ? "not-allowed" : "pointer" }}>
          {salvando ? "Movendo…" : <>Mover <ArrowRight size={15} /></>}
        </button>
      </div>
    </>
  ) : (
    <button onClick={onFechar} style={{ ...btnGhost, width: "100%" }}>Fechar</button>
  );

  return (
    <Overlay onFechar={onFechar} rodape={rodape}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Mover peças</h3>
      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 12px" }}>{pedido.referencia} · {saldo} peças em {rotuloLocal(local)}</p>
      <button type="button" onClick={baixarPdf} disabled={gerandoPdf}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16, padding: "9px 15px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", cursor: gerandoPdf ? "default" : "pointer", fontSize: 13, fontWeight: 600, opacity: gerandoPdf ? 0.7 : 1 }}>
        <FileDown size={16} style={{ color: "var(--accent)" }} /> {gerandoPdf ? "Gerando PDF…" : "Baixar PDF desta etapa"}
      </button>
      <div style={{ marginBottom: 16, padding: "12px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".4px" }}>Detalhes do pedido</span>
          {podeEditar && (
            <button type="button" onClick={() => setEditarGrade(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", fontSize: 11.5, fontWeight: 600, borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--accent)", cursor: "pointer" }}>
              <Tags size={12} /> {normalizarGrade(pedido.grade).length ? "Editar tamanhos" : "Adicionar tamanhos"}
            </button>
          )}
        </div>
        {normalizarGrade(pedido.grade).length > 0
          ? <GradeTabela grade={pedido.grade} margem="0 0 10px" />
          : <div style={{ fontSize: 12.5, color: "var(--text-3)", marginBottom: 10 }}>Sem grade de tamanhos cadastrada.</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px", fontSize: 12.5 }}>
          {pedido.cor && <span><span style={{ color: "var(--text-3)" }}>Cor:</span> {pedido.cor}</span>}
          {pedido.peso && <span><span style={{ color: "var(--text-3)" }}>Peso:</span> {pedido.peso}</span>}
            {pedido.volume && <span><span style={{ color: "var(--text-3)" }}>Volume:</span> {pedido.volume}</span>}
          </div>
          {pedido.observacoes && <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{pedido.observacoes}</p>}
        </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 }}>Oficina responsável</label>
        <select value={oficinaId} onChange={(e) => mudarOficina(e.target.value)} disabled={!podeEditar} style={inpMini}>
          <option value="">Selecionar…</option>
          {(oficinas || []).filter((o) => o.ativo).map((o) => <option key={o.id} value={String(o.id)}>{o.nome_empresa}</option>)}
        </select>
      </div>
      {local === "Amostra" && <PainelAmostra pedido={pedido} podeEditar={podeEditar} />}
      {local === "Corte" && <PainelCorte pedido={pedido} onBloqueioChange={setBloqueado} podeEditar={podeEditar} />}
      {local === "Acabamento" && <PainelAcabamento pedido={pedido} onBloqueioChange={setBloqueado} podeEditar={podeEditar} />}
      {local === "Oficina" && <PainelOficina pedido={pedido} remessas={remessas} movimentos={movimentos} oficinas={oficinas} />}
      {podeEditar ? (
        <>
          {local === "Oficina" && remessasAbertas.length > 0 && (
            <>
              <label style={lbl}>Abater de qual remessa</label>
              <select value={remessaId} onChange={(e) => setRemessaId(e.target.value)} style={inp}>
                <option value="">Selecionar…</option>
                {remessasAbertas.map((r) => {
                  const ofic = (oficinas || []).find((o) => o.id === r.oficina_id);
                  const restante = r.qtd_enviada - r.qtd_retornada;
                  return <option key={r.id} value={r.id}>{(ofic?.nome_empresa || "—")} · saiu {fmtDataResumo(r.data_saida)} · faltam {restante} de {r.qtd_enviada}</option>;
                })}
              </select>
            </>
          )}
          <label style={{ ...lbl, marginTop: 14 }}>Quantidade</label>
          <input type="number" min="1" max={saldo} value={qtd} onChange={(e) => setQtd(e.target.value)} style={inp} />
          <label style={{ ...lbl, marginTop: 14 }}>Enviar para</label>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} style={inp}>
            <option value="">Selecionar…</option>
            {destinos.map((d) => <option key={d} value={d}>{rotuloLocal(d)}</option>)}
          </select>
        </>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "4px 0 0", padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}>Você tem acesso de visualização. Mover peças e editar processos é só para chefe de setor.</p>
      )}
      {pedido.solicitacao_id && (
        <button onClick={() => setVerResumo(true)} style={{ ...btnGhost, width: "100%", marginTop: 10 }}>
          Ver ficha e histórico da pilotagem
        </button>
      )}
      {ehMaster && (
        <button onClick={excluirPedido} style={{ display: "block", width: "100%", marginTop: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--danger)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer" }}>
          Excluir pedido
        </button>
      )}
      {verResumo && <ResumoPilotagem solicitacaoId={pedido.solicitacao_id} onFechar={() => setVerResumo(false)} />}
      {editarGrade && <ModalEditarGrade pedido={pedido} onFechar={() => setEditarGrade(false)} onOk={() => { setEditarGrade(false); onOk(); }} />}
    </Overlay>
  );
}

// Editar/adicionar a grade de tamanhos de um pedido já existente.
function ModalEditarGrade({ pedido, onFechar, onOk }) {
  const [gradeVar, setGradeVar] = useState(() => {
    const n = normalizarGrade(pedido.grade);
    return n.length ? n.map((l) => ({ variante: l.variante || "", qtds: { ...l.qtds } })) : [{ variante: "", qtds: {} }];
  });
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const gradeFinal = limparGrade(gradeVar);
  const soma = totalGrade(gradeFinal || []);

  async function salvar() {
    setErro(null);
    if (soma < 1) return setErro("Informe ao menos uma quantidade.");
    setSalvando(true);
    // Atualiza a grade e o total do pedido (o total passa a refletir a soma dos tamanhos).
    const { error } = await supabase.from("pedidos").update({ grade: gradeFinal, total: soma }).eq("id", pedido.id);
    setSalvando(false);
    if (error) return setErro(error.message);
    onOk();
  }

  return (
    <Overlay onFechar={onFechar} largura={700} zIndex={115}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Tamanhos — {pedido.referencia}</h3>
      <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "0 0 14px" }}>O total do pedido passa a ser a soma dos tamanhos.</p>
      <GradeEditor valor={gradeVar} onChange={setGradeVar} />
      {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "10px 0 0" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Salvar tamanhos"}</button>
      </div>
    </Overlay>
  );
}



function ModalNovo({ clientes, oficinas, onFechar, onOk }) {
  const [clienteId, setClienteId] = useState("");
  const [oficinaId, setOficinaId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [marca, setMarca] = useState("");
  const [total, setTotal] = useState("");
  const [prazo, setPrazo] = useState("");
  const [gradeVar, setGradeVar] = useState([{ variante: "", qtds: {} }]);
  const [cor, setCor] = useState("");
  const [peso, setPeso] = useState("");
  const [volume, setVolume] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const gradeFinal = limparGrade(gradeVar);
  const somaGrade = totalGrade(gradeFinal || []);
  const usaGrade = somaGrade > 0;

  async function salvar() {
    setErro(null);
    if (!clienteId) return setErro("Escolha um cliente.");
    if (!referencia.trim()) return setErro("Informe a referência.");
    let t;
    if (usaGrade) {
      t = somaGrade;
    } else {
      t = parseInt(total, 10);
      if (!t || t < 1) return setErro("Preencha a grade de tamanhos ou informe o total de peças.");
    }
    setSalvando(true);
    const { error } = await supabase.from("pedidos").insert({
      cliente_id: clienteId, oficina_id: oficinaId || null,
      referencia: referencia.trim(), marca: marca.trim() || null, total: t, prazo: prazo || null,
      grade: gradeFinal, cor: cor.trim() || null, peso: peso.trim() || null,
      volume: volume.trim() || null, observacoes: observacoes.trim() || null,
    });
    setSalvando(false);
    if (error) return setErro(error.message + (error.message && error.message.includes("column") ? " — parece que falta rodar o SQL dos campos novos do pedido." : ""));
    onOk();
  }

  return (
    <Overlay onFechar={onFechar} rodape={
      <>
        {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "0 0 10px" }}>{erro}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Criar pedido"}</button>
        </div>
      </>
    }>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>Novo pedido</h3>
      <label style={lbl}>Cliente</label>
      <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={inp}>
        <option value="">Selecionar…</option>
        {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Referência</label>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Marca</label>
          <input value={marca} onChange={(e) => setMarca(e.target.value)} style={inp} /></div>
      </div>
      <label style={{ ...lbl, marginTop: 16 }}>Grade de tamanhos</label>
      <GradeEditor valor={gradeVar} onChange={setGradeVar} />
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Total de peças</label>
          {usaGrade
            ? <div style={{ ...inp, background: "var(--surface-2)", color: "var(--text-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}><strong style={{ color: "var(--text)" }}>{somaGrade}</strong><span style={{ fontSize: 11 }}>soma da grade</span></div>
            : <input type="number" min="1" value={total} onChange={(e) => setTotal(e.target.value)} style={inp} />}
        </div>
        <div style={{ flex: 1 }}><label style={lbl}>Prazo</label>
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={inp} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Cor</label>
          <input value={cor} onChange={(e) => setCor(e.target.value)} placeholder="ex: azul marinho" style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Peso</label>
          <input value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="ex: 120 kg" style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Volume</label>
          <input value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="ex: 8 caixas" style={inp} /></div>
      </div>
      <label style={{ ...lbl, marginTop: 14 }}>Observações</label>
      <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3}
        placeholder="Anotações gerais do pedido…" style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.45 }} />
      <label style={{ ...lbl, marginTop: 14 }}>Oficina (opcional)</label>
      <select value={oficinaId} onChange={(e) => setOficinaId(e.target.value)} style={inp}>
        <option value="">Selecionar…</option>
        {oficinas.map((o) => <option key={o.id} value={o.id}>{o.nome_empresa}</option>)}
      </select>
    </Overlay>
  );
}

const PROCESSOS_CORTE = ["Caseado", "Entretelado", "Estampado", "Travete", "Ilhós", "Estamparia", "Bordado", "Termo Colante"];
const PROCESSOS_ACABAMENTO = ["Caseado", "Estampado", "Travete", "Ilhós", "Termo Colante", "Plaquinha", "Zíper"];

// Peças com o processo concluído. Aceita grade por tamanho, total, ou o formato antigo (feito).
function qtdProcesso(entrada, total) {
  if (!entrada) return 0;
  if (entrada.grade) return Math.max(0, Math.min(total, Object.values(entrada.grade).reduce((a, b) => a + (parseInt(b, 10) || 0), 0)));
  if (typeof entrada.qtd === "number") return Math.max(0, Math.min(total, entrada.qtd));
  return entrada.feito ? total : 0;
}
const zerosDaGrade = (g) => Object.fromEntries(Object.keys(g || {}).map((t) => [t, 0]));

function corteBloqueado(pedido) {
  // Única trava do fluxo: tecido em descanso. Processos pendentes são apenas informativos.
  return !!pedido.descanso_tecido;
}

function diasAtePrazo(prazo) {
  if (!prazo) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const partes = prazo.split("-").map(Number);
  const dt = new Date(partes[0], partes[1] - 1, partes[2]); dt.setHours(0, 0, 0, 0);
  return Math.round((dt - hoje) / 86400000);
}

function fmtCurto(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || "";
  const p = d.split("-");
  return p[2] + "/" + p[1];
}

function badgesDoCard(pe, local) {
  const bs = [];
  if (local === "Corte" && pe.descanso_tecido) bs.push({ label: "Tecido descansando", cor: "var(--danger)", bg: "var(--danger-bg)" });
  if (local === "Corte") {
    const pc = pe.processos_corte || {};
    const completos = PROCESSOS_CORTE.filter((n) => qtdProcesso(pc[n], pe.total) >= pe.total).length;
    if (completos < PROCESSOS_CORTE.length) bs.push({ label: `${completos}/${PROCESSOS_CORTE.length} processos`, cor: "var(--warning)", bg: "var(--warning-bg)" });
  }
  if (local === "Acabamento") {
    const pc = pe.processos_acabamento || {};
    const completos = PROCESSOS_ACABAMENTO.filter((n) => qtdProcesso(pc[n], pe.total) >= pe.total).length;
    if (completos < PROCESSOS_ACABAMENTO.length) bs.push({ label: `${completos}/${PROCESSOS_ACABAMENTO.length} processos`, cor: "var(--warning)", bg: "var(--warning-bg)" });
  }
  return bs;
}

// Urgência pelo prazo — colore o cartão inteiro conforme a proximidade da data.
// Só vale enquanto o pedido está em produção (não em Estoque/Perda).
function urgenciaDoCard(pe, local) {
  if (local === "Estoque" || local === "Perda") return null;
  const dias = diasAtePrazo(pe.prazo);
  if (dias === null) return null;
  if (dias < 0) return { nivel: "atrasado", label: -dias === 1 ? "Atrasado há 1 dia" : `Atrasado há ${-dias} dias`, cor: "var(--danger)", bg: "var(--danger-bg)", borda: "var(--danger)", Icone: AlertTriangle };
  if (dias === 0) return { nivel: "hoje", label: "Vence hoje", cor: "var(--danger)", bg: "var(--danger-bg)", borda: "var(--danger)", Icone: AlertTriangle };
  if (dias === 1) return { nivel: "amanha", label: "Vence amanhã", cor: "var(--orange)", bg: "var(--orange-bg)", borda: "var(--orange)", Icone: Clock };
  if (dias === 2) return { nivel: "dois", label: "Vence em 2 dias", cor: "var(--warning)", bg: "var(--warning-bg)", borda: "var(--warning)", Icone: Clock };
  return null;
}

function infoRemessasOficina(pe, remessas, oficinas) {
  const abertas = (remessas || []).filter((r) => r.pedido_id === pe.id && !r.data_fechamento);
  if (abertas.length === 0) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  // remessa mais antiga em aberto
  abertas.sort((a, b) => a.data_saida.localeCompare(b.data_saida));
  const r = abertas[0];
  const ofic = (oficinas || []).find((o) => o.id === r.oficina_id);
  const partes = r.data_saida.split("-").map(Number);
  const dtSaida = new Date(partes[0], partes[1]-1, partes[2]); dtSaida.setHours(0,0,0,0);
  const dias = Math.round((hoje - dtSaida) / 86400000);
  const restante = r.qtd_enviada - r.qtd_retornada;
  return {
    nomeOficina: ofic?.nome_empresa || "—",
    dias,
    restante,
    totalAbertas: abertas.length,
    totalRestante: abertas.reduce((s, x) => s + (x.qtd_enviada - x.qtd_retornada), 0),
  };
}

function PainelOficina({ pedido, remessas, movimentos, oficinas }) {
  function fmtData(d) {
    if (!d) return "—";
    const str = String(d);
    if (!/^\d{4}-\d{2}-\d{2}/.test(str)) return str;
    const p = str.slice(0, 10).split("-");
    return p[2] + "/" + p[1];
  }
  function fmtDataHora(d) {
    if (!d) return "—";
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return String(d); }
  }
  const nomeOficina = (id) => (oficinas || []).find((o) => o.id === id)?.nome_empresa || "—";

  const remessasPedido = (remessas || [])
    .filter((r) => r && r.pedido_id === pedido.id)
    .sort((a, b) => String(b.data_saida || "").localeCompare(String(a.data_saida || "")));

  if (remessasPedido.length === 0) {
    return (
      <div style={{ marginTop: 14, padding: 12, background: "var(--surface-2)", borderRadius: 9, border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>Nenhuma remessa registrada para este pedido ainda.</div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 14 }}>
      {remessasPedido.map((r) => {
        const aberta = !r.data_fechamento;
        const restante = (r.qtd_enviada || 0) - (r.qtd_retornada || 0);
        const movs = (movimentos || []).filter((m) => m.remessa_id === r.id).sort((a, b) => {
          const da = String(a.data || a.criado_em || "");
          const db = String(b.data || b.criado_em || "");
          return da.localeCompare(db);
        });
        const totalEsperado = r.qtd_enviada || 0;
        const retornado = r.qtd_retornada || 0;
        const pct = totalEsperado > 0 ? Math.round((retornado / totalEsperado) * 100) : 0;
        return (
          <div key={r.id} style={{ padding: "14px 16px", background: "var(--surface-2)", borderRadius: 11, border: "1px solid var(--border)", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: 0.6 }}>Rastreio da remessa</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: aberta ? "var(--warning)" : "var(--success)" }}>{retornado}/{totalEsperado}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 8 }}>
              {nomeOficina(r.oficina_id)} · saiu {fmtData(r.data_saida)}{!aberta && <> · voltou {fmtData(r.data_fechamento)}</>}{aberta && restante > 0 && <> · <span style={{ color: "var(--danger)", fontWeight: 600 }}>faltam {restante}</span></>}
            </div>
            <div style={{ height: 4, background: "var(--surface)", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ width: `${pct}%`, height: "100%", background: aberta ? "var(--warning)" : "var(--success)", transition: "width .3s" }} />
            </div>
            {movs.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {movs.map((m, idx) => {
                  const ehSaida = m.para_local === "Oficina";
                  const dataMov = m.data || (m.criado_em ? m.criado_em.slice(0, 10) : "");
                  return (
                    <div key={m.id || idx} style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                      {idx < movs.length - 1 && <span style={{ position: "absolute", left: 11, top: 22, bottom: -10, width: 2, background: "var(--border)" }} />}
                      <div style={{ width: 22, height: 22, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", background: ehSaida ? "var(--accent)" : "var(--success)", flexShrink: 0, zIndex: 1 }}>
                        {ehSaida
                          ? <ArrowUpRight size={12} style={{ color: "#fff" }} />
                          : <ArrowDownLeft size={12} style={{ color: "#fff" }} />}
                      </div>
                      <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                            {ehSaida ? "Saiu para oficina" : `Retornou para ${rotuloLocal(m.para_local)}`}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-3)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <Calendar size={10} /> em {fmtDataHora(m.data ? dataMov : m.criado_em)}
                          </div>
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: ehSaida ? "var(--accent-bg)" : "var(--success-bg)", color: ehSaida ? "var(--accent)" : "var(--success)" }}>
                          {m.qtd} peça{m.qtd === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
function PainelAmostra({ pedido, podeEditar }) {
  const [obs, setObs] = useState(pedido.obs_amostra || "");
  const [anexo, setAnexo] = useState(pedido.anexo_amostra || null);
  const [anexoNome, setAnexoNome] = useState(pedido.anexo_amostra_nome || "");
  const [subindo, setSubindo] = useState(false);
  const [salvo, setSalvo] = useState(false);

  async function persist(campos) {
    const { error } = await supabase.from("pedidos").update(campos).eq("id", pedido.id);
    if (error) window.alert("Não foi possível salvar: " + error.message + (error.message && error.message.includes("column") ? "\n\nParece que falta rodar o SQL das colunas da amostra." : ""));
    return !error;
  }

  async function salvarObs() {
    if (await persist({ obs_amostra: obs.trim() || null })) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 1600);
    }
  }

  async function subirAnexo(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return window.alert("Arquivo muito grande — o limite é 15 MB.");
    setSubindo(true);
    const pronto = await comprimirImagem(file); // imagens são comprimidas; outros tipos passam direto
    const nomeSeguro = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
    const caminho = `amostras/${pedido.id}/${Date.now()}_${nomeSeguro}`;
    const up = await supabase.storage.from("anexos").upload(caminho, pronto);
    if (up.error) {
      setSubindo(false);
      return window.alert("Falha ao subir o anexo: " + up.error.message + (/bucket/i.test(up.error.message) ? "\n\nParece que falta criar o bucket 'anexos' no Supabase." : ""));
    }
    const ok = await persist({ anexo_amostra: caminho, anexo_amostra_nome: file.name });
    setSubindo(false);
    if (ok) { setAnexo(caminho); setAnexoNome(file.name); }
  }

  async function removerAnexo() {
    if (!window.confirm("Remover o anexo da amostra?")) return;
    if (anexo) await supabase.storage.from("anexos").remove([anexo]);
    if (await persist({ anexo_amostra: null, anexo_amostra_nome: null })) { setAnexo(null); setAnexoNome(""); }
  }

  const urlAnexo = anexo ? supabase.storage.from("anexos").getPublicUrl(anexo).data.publicUrl : null;

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Amostra</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={lblMini}>Observação</label>
        {salvo && <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 600 }}>salvo ✓</span>}
      </div>
      <textarea
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        onBlur={salvarObs}
        disabled={!podeEditar}
        rows={3}
        placeholder="Anotações sobre a amostra: ajustes, aprovação do cliente…"
        style={{ ...inpMini, width: "100%", resize: "vertical", fontFamily: "inherit", lineHeight: 1.45 }}
      />

      <div style={{ ...lblMini, marginTop: 12 }}>Anexo</div>
      {anexo ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9 }}>
          <Paperclip size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <a href={urlAnexo} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--accent)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {anexoNome || "Abrir anexo"}
          </a>
          {podeEditar && (
            <button onClick={removerAnexo} aria-label="Remover anexo" style={{ display: "inline-flex", padding: 5, borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer" }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ) : podeEditar ? (
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 12px", border: "1px dashed var(--border-strong, var(--border))", borderRadius: 9, fontSize: 12.5, fontWeight: 600, color: "var(--text-2)", cursor: subindo ? "wait" : "pointer", background: "var(--surface-2)" }}>
          <Paperclip size={14} />
          {subindo ? "Enviando…" : "Anexar arquivo (foto, PDF…)"}
          <input type="file" onChange={subirAnexo} disabled={subindo} style={{ display: "none" }} />
        </label>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text-3)" }}>Sem anexo.</div>
      )}
    </div>
  );
}

function PainelCorte({ pedido, onBloqueioChange, podeEditar }) {
  const [tamanho, setTamanho] = useState(pedido.tamanho || "");
  const [tecido, setTecido] = useState(pedido.tecido || "");
  const [descanso, setDescanso] = useState(!!pedido.descanso_tecido);
  const [processos, setProcessos] = useState(() => {
    const base = {};
    const saved = pedido.processos_corte || {};
    PROCESSOS_CORTE.forEach((nome) => {
      const sv = saved[nome] || {};
      base[nome] = { qtd: qtdProcesso(sv, pedido.total), grade: sv.grade ? { ...sv.grade } : undefined, obs: sv.obs || "", data: sv.data || "", feito_em: sv.feito_em || "" };
    });
    return base;
  });

  async function persist(campos) {
    const { error } = await supabase.from("pedidos").update(campos).eq("id", pedido.id);
    if (error) window.alert("Não foi possível salvar: " + error.message + (error.message && error.message.includes("column") ? "\n\nParece que falta rodar o SQL das colunas do corte." : ""));
  }

  function reportar(d, procs) {
    onBloqueioChange(d); // só o descanso trava
  }
  useEffect(() => { reportar(descanso, processos); }, []);

  function toggleDescanso() {
    const novo = !descanso;
    setDescanso(novo);
    persist({ descanso_tecido: novo });
    reportar(novo, processos);
  }
  function mudarQtd(nome, valor) {
    const q = Math.max(0, Math.min(pedido.total, parseInt(valor, 10) || 0));
    const antes = processos[nome];
    setProcessos({ ...processos, [nome]: { ...antes, qtd: q, feito_em: q >= pedido.total && antes.qtd < pedido.total ? agoraTexto() : antes.feito_em } });
  }
  function mudarQtdTam(nome, tamanho, valor) {
    const max = parseInt(gradePorTamanho(pedido.grade)[tamanho], 10) || 0;
    const q = Math.max(0, Math.min(max, parseInt(valor, 10) || 0));
    const antes = processos[nome];
    const g = { ...(antes.grade || zerosDaGrade(gradePorTamanho(pedido.grade))), [tamanho]: q };
    const soma = Object.values(g).reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
    setProcessos({ ...processos, [nome]: { ...antes, grade: g, qtd: soma, feito_em: soma >= pedido.total && antes.qtd < pedido.total ? agoraTexto() : antes.feito_em } });
  }
  function salvarQtd() { persist({ processos_corte: processos }); }
  function alternarTudo(nome) {
    const antes = processos[nome];
    const completo = antes.qtd >= pedido.total;
    const pergunta = completo
      ? `Zerar o processo "${nome}"? As ${antes.qtd} peça(s) marcadas voltarão para 0.`
      : `Marcar TODAS as ${pedido.total} peça(s) de "${nome}" como feitas?`;
    if (!window.confirm(pergunta)) return;
    const np = { ...processos, [nome]: { ...antes, qtd: completo ? 0 : pedido.total, feito_em: completo ? antes.feito_em : agoraTexto() } };
    setProcessos(np);
    persist({ processos_corte: np });
  }
  function mudarObs(nome, obs) {
    const data = obs.trim() ? (processos[nome].data || new Date().toLocaleDateString("pt-BR")) : "";
    setProcessos({ ...processos, [nome]: { ...processos[nome], obs, data } });
  }
  function salvarObs() { persist({ processos_corte: processos }); }
  function salvarInfo() { persist({ tamanho: tamanho.trim() || null, tecido: tecido.trim() || null }); }

  const pendentes = PROCESSOS_CORTE.filter((n) => processos[n].qtd < pedido.total).map((n) => `${n} (faltam ${pedido.total - processos[n].qtd})`);

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Liberação para o corte</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={lblMini}>Referência</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{pedido.referencia}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={lblMini}>Tamanho</div>
          <input value={tamanho} onChange={(e) => setTamanho(e.target.value)} onBlur={salvarInfo} disabled={!podeEditar} placeholder="P, M, G…" style={inpMini} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={lblMini}>Tecido</div>
          <input value={tecido} onChange={(e) => setTecido(e.target.value)} onBlur={salvarInfo} disabled={!podeEditar} placeholder="malha…" style={inpMini} />
        </div>
      </div>

      <button onClick={toggleDescanso} disabled={!podeEditar} style={{
        width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 14,
        border: descanso ? "1px solid var(--danger)" : "1px solid var(--border)",
        background: descanso ? "var(--danger-bg)" : "var(--surface)",
        color: descanso ? "var(--danger)" : "var(--text-2)",
      }}>
        {descanso ? "Tecido em descanso — corte travado (clique para liberar)" : "Marcar tecido em descanso"}
      </button>

      <Rastreio ordem={PROCESSOS_CORTE} processos={processos} totalPecas={pedido.total} gradePedido={gradePorTamanho(pedido.grade)} podeEditar={podeEditar} onQtd={mudarQtd} onQtdTam={mudarQtdTam} onSalvarQtd={salvarQtd} onTudo={alternarTudo} onObs={mudarObs} onSalvarObs={salvarObs} titulo="Rastreio do corte" />
      {pendentes.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)", padding: "8px 10px", background: "var(--danger-bg)", borderRadius: 8 }}>
          {pendentes.length} processo(s) pendente(s): {pendentes.join(", ")}. Registre a observação do que falta.
        </div>
      )}
    </div>
  );
}

function PainelAcabamento({ pedido, onBloqueioChange, podeEditar }) {
  const [processos, setProcessos] = useState(() => {
    const base = {};
    const saved = pedido.processos_acabamento || {};
    PROCESSOS_ACABAMENTO.forEach((nome) => {
      const sv = saved[nome] || {};
      base[nome] = { qtd: qtdProcesso(sv, pedido.total), grade: sv.grade ? { ...sv.grade } : undefined, obs: sv.obs || "", data: sv.data || "", feito_em: sv.feito_em || "" };
    });
    return base;
  });

  async function persist(campos) {
    const { error } = await supabase.from("pedidos").update(campos).eq("id", pedido.id);
    if (error) window.alert("Não foi possível salvar: " + error.message);
  }
  function reportar() { onBloqueioChange(false); } // processos pendentes não travam o acabamento
  useEffect(() => { reportar(processos); }, []);

  function mudarQtd(nome, valor) {
    const q = Math.max(0, Math.min(pedido.total, parseInt(valor, 10) || 0));
    const antes = processos[nome];
    setProcessos({ ...processos, [nome]: { ...antes, qtd: q, feito_em: q >= pedido.total && antes.qtd < pedido.total ? agoraTexto() : antes.feito_em } });
  }
  function mudarQtdTam(nome, tamanho, valor) {
    const max = parseInt(gradePorTamanho(pedido.grade)[tamanho], 10) || 0;
    const q = Math.max(0, Math.min(max, parseInt(valor, 10) || 0));
    const antes = processos[nome];
    const g = { ...(antes.grade || zerosDaGrade(gradePorTamanho(pedido.grade))), [tamanho]: q };
    const soma = Object.values(g).reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
    setProcessos({ ...processos, [nome]: { ...antes, grade: g, qtd: soma, feito_em: soma >= pedido.total && antes.qtd < pedido.total ? agoraTexto() : antes.feito_em } });
  }
  function salvarQtd() { persist({ processos_acabamento: processos }); }
  function alternarTudo(nome) {
    const antes = processos[nome];
    const completo = antes.qtd >= pedido.total;
    const pergunta = completo
      ? `Zerar o processo "${nome}"? As ${antes.qtd} peça(s) marcadas voltarão para 0.`
      : `Marcar TODAS as ${pedido.total} peça(s) de "${nome}" como feitas?`;
    if (!window.confirm(pergunta)) return;
    const np = { ...processos, [nome]: { ...antes, qtd: completo ? 0 : pedido.total, feito_em: completo ? antes.feito_em : agoraTexto() } };
    setProcessos(np);
    persist({ processos_acabamento: np });
  }
  function mudarObs(nome, obs) {
    const data = obs.trim() ? (processos[nome].data || new Date().toLocaleDateString("pt-BR")) : "";
    setProcessos({ ...processos, [nome]: { ...processos[nome], obs, data } });
  }
  function salvarObs() { persist({ processos_acabamento: processos }); }

  const pendentes = PROCESSOS_ACABAMENTO.filter((n) => processos[n].qtd < pedido.total).map((n) => `${n} (faltam ${pedido.total - processos[n].qtd})`);

  return (
    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
      <Rastreio ordem={PROCESSOS_ACABAMENTO} processos={processos} totalPecas={pedido.total} gradePedido={gradePorTamanho(pedido.grade)} podeEditar={podeEditar} onQtd={mudarQtd} onQtdTam={mudarQtdTam} onSalvarQtd={salvarQtd} onTudo={alternarTudo} onObs={mudarObs} onSalvarObs={salvarObs} titulo="Rastreio do acabamento" />
      {pendentes.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--danger)", padding: "8px 10px", background: "var(--danger-bg)", borderRadius: 8 }}>
          {pendentes.length} processo(s) pendente(s): {pendentes.join(", ")}.
        </div>
      )}
    </div>
  );
}

function agoraTexto() {
  return new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Rastreio({ ordem, processos, totalPecas, gradePedido, podeEditar, onQtd, onQtdTam, onSalvarQtd, onTudo, onObs, onSalvarObs, titulo }) {
  const [aberto, setAberto] = useState(true); // rastreio já começa aberto
  const [expandido, setExpandido] = useState(null); // processo com a grade de tamanhos aberta
  const temGrade = gradePedido && Object.keys(gradePedido).length > 0;
  const feitos = ordem.filter((n) => processos[n].qtd >= totalPecas).length;
  const total = ordem.length;
  const somaFeita = ordem.reduce((a, n) => a + processos[n].qtd, 0);
  const pct = Math.round((somaFeita / (totalPecas * total)) * 100) || 0;
  const completo = feitos === total;
  const idxAtual = ordem.findIndex((n) => processos[n].qtd < totalPecas);

  return (
    <div style={{ marginTop: 4 }}>
      <button type="button" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, padding: 0, border: "none", background: "none", cursor: "pointer" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".4px" }}>{titulo}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: completo ? "var(--success)" : "var(--text-2)" }}>{feitos}<span style={{ color: "var(--text-3)", fontWeight: 600 }}>/{total} completos</span></span>
          <ChevronDown size={15} style={{ color: "var(--text-3)", transform: aberto ? "rotate(180deg)" : "none", transition: "transform .16s ease" }} />
        </span>
      </button>
      <div style={{ height: 6, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden", marginBottom: aberto ? 16 : 4 }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: completo ? "var(--success)" : "linear-gradient(90deg,var(--accent),var(--accent-2))", transition: "width .4s cubic-bezier(.2,.7,.3,1)" }} />
      </div>

      {aberto && <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {ordem.map((nome, i) => {
          const pr = processos[nome];
          const feito = pr.qtd >= totalPecas;
          const parcial = pr.qtd > 0 && !feito;
          const atual = !feito && i === idxAtual;
          const ultimo = i === ordem.length - 1;
          const cor = feito ? "var(--success)" : parcial || atual ? "var(--accent)" : "var(--border-strong)";
          const grExp = expandido === nome;
          return (
            <div key={nome} style={{ position: "relative", display: "flex", gap: 12, paddingBottom: ultimo ? 0 : 6 }}>
              {!ultimo && <span style={{ position: "absolute", left: 12, top: 27, bottom: -4, width: 2, borderRadius: 2, background: feito ? "var(--success)" : "var(--border)" }} />}
              <button type="button" onClick={() => podeEditar && onTudo(nome)} disabled={!podeEditar}
                title={feito ? "Concluído — clique para zerar" : "Marcar todas as peças"}
                aria-label={feito ? `${nome} concluído, clique para zerar` : `Marcar todas as peças de ${nome}`}
                style={{
                  position: "relative", zIndex: 1, flexShrink: 0, width: 26, height: 26, borderRadius: 99, padding: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  border: feito ? "none" : `2px solid ${cor}`,
                  background: feito ? "var(--success)" : parcial || atual ? "var(--accent-bg)" : "var(--surface)",
                  color: "#fff", cursor: podeEditar ? "pointer" : "default",
                  boxShadow: feito ? "var(--shadow-sm)" : "none",
                }}>
                {feito ? <Check size={15} /> : <span style={{ width: 7, height: 7, borderRadius: 99, background: parcial || atual ? "var(--accent)" : "transparent" }} />}
              </button>
              <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: feito ? "var(--text-2)" : "var(--text)" }}>{nome}</span>
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5 }}>
                    {podeEditar && !feito ? (
                      <>
                        <input type="number" min="0" max={totalPecas} value={pr.qtd}
                          onChange={(e) => onQtd(nome, e.target.value)} onBlur={onSalvarQtd}
                          aria-label={`Peças com ${nome} feito`}
                          style={{ ...inpMini, width: 64, padding: "5px 7px", fontSize: 12.5, textAlign: "right" }} />
                        <span style={{ fontSize: 11.5, color: "var(--text-3)", whiteSpace: "nowrap" }}>/{totalPecas}</span>
                        <button type="button" onClick={() => onTudo(nome)}
                          style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" }}>tudo</button>
                      </>
                    ) : (
                      <span style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap",
                        color: feito ? "var(--success)" : parcial ? "var(--accent)" : "var(--text-3)" }}>
                        {pr.qtd}<span style={{ fontWeight: 600, color: "var(--text-3)" }}>/{totalPecas}</span>
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 99, background: "var(--surface-3)", overflow: "hidden", marginTop: 5 }}>
                  <div style={{ width: `${Math.round((pr.qtd / totalPecas) * 100)}%`, height: "100%", borderRadius: 99, background: feito ? "var(--success)" : "var(--accent)", transition: "width .25s ease" }} />
                </div>

                {temGrade && (
                  <button type="button" onClick={() => setExpandido(grExp ? null : nome)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, padding: 0, border: "none", background: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "var(--accent)" }}>
                    <ChevronDown size={12} style={{ transform: grExp ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                    {grExp ? "ocultar tamanhos" : "detalhar por tamanho"}
                  </button>
                )}
                {temGrade && grExp && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(74px, 1fr))", gap: 6, marginTop: 8, padding: 10, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9 }}>
                    {Object.entries(gradePedido).map(([tam, totTam]) => {
                      const feitoTam = (pr.grade || {})[tam] || 0;
                      return (
                        <div key={tam}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-2)", marginBottom: 2 }}>{tam} <span style={{ color: "var(--text-3)", fontWeight: 600 }}>({totTam})</span></div>
                          {podeEditar ? (
                            <input type="number" min="0" max={totTam} value={feitoTam}
                              onChange={(e) => onQtdTam(nome, tam, e.target.value)} onBlur={onSalvarQtd}
                              aria-label={`${nome} tamanho ${tam}`}
                              style={{ ...inpMini, width: "100%", padding: "5px 6px", fontSize: 12, textAlign: "center" }} />
                          ) : (
                            <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: "center", padding: "5px 0", color: feitoTam >= totTam ? "var(--success)" : feitoTam > 0 ? "var(--accent)" : "var(--text-3)" }}>{feitoTam}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {feito ? (
                  pr.feito_em && <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> em {pr.feito_em}</div>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    <input value={pr.obs} onChange={(e) => onObs(nome, e.target.value)} onBlur={onSalvarObs} disabled={!podeEditar} placeholder="Observação (opcional)…" style={{ ...inpMini, fontSize: 12 }} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>}
    </div>
  );
}

const lblMini = { fontSize: 11, color: "var(--text-3)", marginBottom: 3 };
const inpMini = { width: "100%", padding: "7px 9px", fontSize: 13, borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };

function fmtDataResumo(d) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const [y, m, dd] = d.split("-");
  return dd + "/" + m + "/" + y;
}

function ResumoPilotagem({ solicitacaoId, onFechar }) {
  const [ficha, setFicha] = useState(null);
  const [descricao, setDescricao] = useState("");
  const [comentarios, setComentarios] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const sol = await supabase.from("solicitacoes").select("ficha, descricao").eq("id", solicitacaoId).single();
      const com = await supabase.from("comentarios_pilotagem").select("*").eq("solicitacao_id", solicitacaoId).order("id");
      setFicha(sol.data?.ficha || null);
      setDescricao(sol.data?.descricao || "");
      setComentarios(com.data || []);
      setCarregando(false);
    })();
  }, [solicitacaoId]);

  return (
    <Overlay onFechar={onFechar} largura={520} zIndex={110}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Ficha e histórico da pilotagem</h3>
        {descricao && <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px" }}>{descricao}</p>}
        {carregando ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Carregando…</p> : (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>Ficha técnica</div>
              {ficha && Object.values(ficha).some((v) => v) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
                  {[["Referência", ficha.referencia], ["Marca", ficha.marca], ["Descrição do produto", ficha.descricao], ["Data de recebimento", fmtDataResumo(ficha.data_recebimento)], ["Prazo da peça piloto", fmtDataResumo(ficha.prazo_piloto)], ["Produto acabado", ficha.produto_acabado], ["Mão de obra", ficha.mao_de_obra]].filter(([, v]) => v).map(([rot, val]) => (
                    <div key={rot} style={{ display: "flex", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--text-3)", minWidth: 150 }}>{rot}</span>
                      <span style={{ fontSize: 13, color: "var(--text)" }}>{val}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "var(--text-3)", padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}>— sem ficha técnica —</div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>Histórico</div>
              {comentarios.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Sem registros.</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {comentarios.map((c) => {
                    const ehFabrica = c.autor === "fabrica";
                    return (
                      <div key={c.id} style={{ borderLeft: `3px solid ${ehFabrica ? "var(--accent)" : "var(--success)"}`, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: ehFabrica ? "var(--accent)" : "var(--success)" }}>{ehFabrica ? "Fábrica" : "Cliente"}</span>
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>{new Date(c.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        {c.texto && <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.texto}</div>}
                        {c.imagem_url && <a href={c.imagem_url} target="_blank" rel="noreferrer"><img src={c.imagem_url} alt="anexo" style={{ marginTop: 6, maxWidth: "100%", maxHeight: 200, borderRadius: 8, display: "block", cursor: "pointer" }} /></a>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
        <button onClick={onFechar} style={{ ...btnGhost, width: "100%", marginTop: 20 }}>Fechar</button>
      
    </Overlay>
  );
}

const coluna = { flex: "1 1 0", minWidth: 196, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 14, padding: 12, boxShadow: "var(--shadow-card)" };
const card = { textAlign: "left", width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 11, padding: "12px 13px", display: "block", cursor: "pointer", boxShadow: "var(--shadow-sm)" };
const inp = { width: "100%", padding: "9px 11px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };
const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 15px", fontSize: 13, fontWeight: 700, borderRadius: 9, border: "none", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", boxShadow: "var(--shadow-sm)", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
