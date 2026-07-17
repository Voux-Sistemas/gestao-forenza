import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient.js";
import { Search, Eye, Trash2, Archive, Package } from "lucide-react";
import Overlay from "./Gaveta.jsx";
import { calcularSaldos, rotuloLocal } from "../etapas.js";
import GradeTabela, { gradePorTamanho, TAMANHOS_GRADE } from "./GradeTabela.jsx";
import { ITENS_AVIAMENTO, itemPreenchido } from "../aviamentos.js";
import { gerarDossiePedido } from "../pdfEtapa.js";
import { FileText } from "lucide-react";

const POR_PAGINA = 50;
const PERIODOS = [
  { id: "30d", label: "Últimos 30 dias", dias: 30 },
  { id: "12m", label: "Últimos 12 meses", meses: 12 },
  { id: "tudo", label: "Todo o período" },
];

const fmtData = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

// Selos com a situação final das peças do pedido.
function selosSituacao(s) {
  const selos = [];
  if (s.Saida > 0) selos.push({ txt: `${s.Saida} expedidas`, cor: "var(--success)", bg: "var(--success-bg)" });
  if ((s.Primeira || 0) > 0) selos.push({ txt: `${s.Primeira} em 1ª qual.`, cor: "var(--accent)", bg: "var(--accent-bg)" });
  if ((s.Segunda || 0) > 0) selos.push({ txt: `${s.Segunda} em 2ª qual.`, cor: "var(--warning)", bg: "var(--warning-bg)" });
  if (s.Perda > 0) selos.push({ txt: `${s.Perda} perda`, cor: "var(--danger)", bg: "var(--danger-bg)" });
  if (selos.length === 0) selos.push({ txt: "concluído", cor: "var(--text-2)", bg: "var(--surface-2)" });
  return selos;
}

export default function Historico({ ehMaster }) {
  const [clientes, setClientes] = useState([]);
  const [linhas, setLinhas] = useState([]); // { pe, s }
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState("12m");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const timerBusca = useRef(null);

  useEffect(() => {
    supabase.from("clientes").select("id, nome").then(({ data }) => setClientes(data || []));
  }, []);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || "—";

  // Busca e paginação acontecem NO BANCO: a tela só recebe uma página por vez,
  // então o Histórico continua leve com 20 mil (ou 200 mil) pedidos guardados.
  const carregar = useCallback(async (pag, textoBusca, per, listaClientes) => {
    setCarregando(true); setErro(null);
    let q = supabase.from("pedidos").select("*", { count: "exact" }).eq("arquivado", true);

    const termo = (textoBusca || "").trim().replace(/[,()%]/g, "");
    if (termo) {
      const idsCli = listaClientes.filter((c) => (c.nome || "").toLowerCase().includes(termo.toLowerCase())).map((c) => c.id);
      q = idsCli.length
        ? q.or(`referencia.ilike.%${termo}%,cliente_id.in.(${idsCli.join(",")})`)
        : q.ilike("referencia", `%${termo}%`);
    }

    const p = PERIODOS.find((x) => x.id === per);
    if (p && (p.meses || p.dias)) {
      const d = new Date();
      if (p.meses) d.setMonth(d.getMonth() - p.meses);
      if (p.dias) d.setDate(d.getDate() - p.dias);
      q = q.gte("arquivado_em", d.toISOString());
    }

    const { data, count, error } = await q
      .order("arquivado_em", { ascending: false })
      .range(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA - 1);
    if (error) { setErro(error.message); setLinhas([]); setTotal(0); setCarregando(false); return; }

    const pedidos = data || [];
    const ids = pedidos.map((x) => x.id);
    const m = ids.length
      ? await supabase.from("movimentos").select("pedido_id, de_local, para_local, qtd").in("pedido_id", ids)
      : { data: [] };
    setLinhas(pedidos.map((pe) => ({ pe, s: calcularSaldos(pe.id, pe.total, m.data || []) })));
    setTotal(count || 0);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(pagina, busca, periodo, clientes); }, [pagina, periodo, clientes]); // eslint-disable-line

  function aoBuscar(v) {
    setBusca(v);
    clearTimeout(timerBusca.current);
    timerBusca.current = setTimeout(() => { setPagina(0); carregar(0, v, periodo, clientes); }, 400);
  }

  async function excluir(pe) {
    if (!window.confirm(`Excluir permanentemente o pedido ${pe.referencia}? Esta ação NÃO pode ser desfeita e apaga o pedido e todo o seu histórico.`)) return;
    // Remove os movimentos primeiro (vínculo), depois o pedido.
    await supabase.from("movimentos").delete().eq("pedido_id", pe.id);
    const { error } = await supabase.from("pedidos").delete().eq("id", pe.id);
    if (error) return window.alert("Não foi possível excluir: " + error.message);
    carregar(pagina, busca, periodo, clientes);
  }

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const de = total === 0 ? 0 : pagina * POR_PAGINA + 1;
  const ate = Math.min(total, (pagina + 1) * POR_PAGINA);

  return (
    <div className="fade-in" style={{ padding: "24px 26px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Histórico de pedidos</h2>
          <p style={{ fontSize: 13, color: "var(--text-2)", margin: "3px 0 0" }}>Pedidos concluídos são arquivados automaticamente e ficam guardados aqui.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)" }}>
            <Search size={14} style={{ color: "var(--text-3)" }} />
            <input value={busca} onChange={(e) => aoBuscar(e.target.value)} placeholder="Buscar referência ou cliente…"
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, padding: "9px 0", width: 210, color: "var(--text)" }} />
          </div>
          <select value={periodo} onChange={(e) => { setPagina(0); setPeriodo(e.target.value); }}
            style={{ fontSize: 13, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
            {PERIODOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr .7fr .9fr 1.3fr 90px", padding: "10px 16px", fontSize: 10.5, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".5px", textTransform: "uppercase", background: "var(--surface-2)" }}>
          <span>Referência</span><span>Cliente</span><span>Peças</span><span>Concluído</span><span>Situação</span><span style={{ textAlign: "right" }}>Ações</span>
        </div>

        {carregando && <div style={{ padding: 26, textAlign: "center", fontSize: 13, color: "var(--text-3)" }}>Carregando…</div>}
        {erro && <div style={{ padding: 20, fontSize: 12.5, color: "var(--danger)" }}>{erro}{erro.includes("arquivado") ? " — parece que falta rodar o SQL do arquivamento." : ""}</div>}
        {!carregando && !erro && linhas.length === 0 && (
          <div style={{ padding: 34, textAlign: "center", color: "var(--text-3)" }}>
            <Archive size={22} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>{busca ? "Nenhum pedido encontrado para essa busca." : "Nenhum pedido arquivado ainda — quando um pedido for concluído, ele aparece aqui."}</div>
          </div>
        )}

        {!carregando && linhas.map(({ pe, s }) => (
          <div key={pe.id} style={{ display: "grid", gridTemplateColumns: "1.1fr 1.4fr .7fr .9fr 1.3fr 90px", alignItems: "center", padding: "11px 16px", borderTop: "1px solid var(--border)", fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{pe.referencia}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nomeCliente(pe.cliente_id)}</span>
            <span>{(pe.total || 0).toLocaleString("pt-BR")}</span>
            <span style={{ color: "var(--text-2)" }}>{fmtData(pe.arquivado_em)}</span>
            <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {selosSituacao(s).map((b) => (
                <span key={b.txt} style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: b.cor, background: b.bg, whiteSpace: "nowrap" }}>{b.txt}</span>
              ))}
            </span>
            <span style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button className="tap" onClick={() => setDetalhe(pe)} title="Ver detalhes" aria-label={`Ver detalhes de ${pe.referencia}`}
                style={{ display: "inline-flex", padding: 6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" }}>
                <Eye size={14} />
              </button>
              {ehMaster && (
                <button className="tap" onClick={() => excluir(pe)} title="Excluir permanentemente" aria-label={`Excluir ${pe.referencia}`}
                  style={{ display: "inline-flex", padding: 6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer" }}>
                  <Trash2 size={14} />
                </button>
              )}
            </span>
          </div>
        ))}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", fontSize: 12, color: "var(--text-2)" }}>
          <span>Mostrando <strong>{de}–{ate}</strong> de <strong>{total.toLocaleString("pt-BR")}</strong> pedido(s) arquivado(s)</span>
          <span style={{ display: "inline-flex", gap: 6 }}>
            <button className="tap" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: pagina === 0 ? "not-allowed" : "pointer", opacity: pagina === 0 ? 0.5 : 1 }}>Anterior</button>
            <button className="tap" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina((p) => p + 1)}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: pagina >= totalPaginas - 1 ? "not-allowed" : "pointer", opacity: pagina >= totalPaginas - 1 ? 0.5 : 1 }}>Próxima</button>
          </span>
        </div>
      </div>

      {detalhe && <DetalhePedido pedido={detalhe} nomeCliente={nomeCliente(detalhe.cliente_id)} onFechar={() => setDetalhe(null)} />}
    </div>
  );
}

// Gaveta com os dados completos e a linha do tempo do pedido arquivado.
const somaObjNum = (o) => Object.values(o || {}).reduce((a, v) => a + (parseInt(v, 10) || 0), 0);

// Converte o mapa de processos salvo no pedido numa lista com qtd resolvida.
function listaProcessos(mapa) {
  return Object.entries(mapa || {})
    .map(([nome, d]) => {
      const dd = d || {};
      const qtd = dd.qtd != null ? dd.qtd : (dd.grade ? somaObjNum(dd.grade) : 0);
      return { nome, qtd, grade: dd.grade || null, obs: dd.obs || "", feito_em: dd.feito_em || "" };
    })
    .filter((p) => p.feito_em || p.qtd > 0 || p.obs);
}

function DetalhePedido({ pedido, nomeCliente, onFechar }) {
  const [movs, setMovs] = useState(null);
  const [remessas, setRemessas] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const [mv, rm, of] = await Promise.all([
        supabase.from("movimentos").select("*").eq("pedido_id", pedido.id).order("id"),
        supabase.from("remessas_oficina").select("*").eq("pedido_id", pedido.id).order("id"),
        supabase.from("oficinas").select("id, nome_empresa"),
      ]);
      if (!vivo) return;
      setMovs(mv.data || []);
      setRemessas(rm.data || []);
      setOficinas(of.data || []);
    })();
    return () => { vivo = false; };
  }, [pedido.id]);

  const nomeOficina = (id) => oficinas.find((o) => o.id === id)?.nome_empresa || "—";

  // Classificação 1ª/2ª a partir dos movimentos.
  const cls = { primeira: {}, segunda: {} };
  (movs || []).forEach((m) => {
    if (!m.grade) return;
    const alvo = m.para_local === "Primeira" ? "primeira" : m.para_local === "Segunda" ? "segunda" : null;
    if (!alvo) return;
    Object.entries(gradePorTamanho(m.grade)).forEach(([t, q]) => { cls[alvo][t] = (cls[alvo][t] || 0) + q; });
  });
  const temCls = Object.keys(cls.primeira).length > 0 || Object.keys(cls.segunda).length > 0;

  const procCorte = listaProcessos(pedido.processos_corte);
  const procAcab = listaProcessos(pedido.processos_acabamento);
  const avi = ITENS_AVIAMENTO
    .filter((it) => itemPreenchido(pedido.ficha_aviamentos?.[it.id]))
    .map((it) => ({ nome: it.nome, tipoCampo: it.tipo, ...pedido.ficha_aviamentos[it.id] }));

  async function baixarDossie() {
    setGerando(true);
    try {
      await gerarDossiePedido({
        pedido,
        cliente: nomeCliente,
        classificacao: temCls ? cls : null,
        processosCorte: procCorte.length ? procCorte : null,
        processosAcabamento: procAcab.length ? procAcab : null,
        aviamentos: avi.length ? avi : null,
        remessasOficina: remessas.length
          ? remessas.map((r) => ({ oficina: nomeOficina(r.oficina_id), saida: r.data_saida, retorno: r.data_fechamento, enviada: r.qtd_enviada, retornada: r.qtd_retornada, motivo: r.motivo_fechamento || "" }))
          : null,
        movimentos: movs || [],
      });
    } finally { setGerando(false); }
  }

  const info = (rotulo, valor) => valor ? (
    <div style={{ display: "flex", gap: 8, fontSize: 12.5, marginBottom: 4 }}>
      <span style={{ color: "var(--text-3)", minWidth: 82 }}>{rotulo}</span>
      <span style={{ fontWeight: 600 }}>{valor}</span>
    </div>
  ) : null;
  const secTit = (txt) => <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".4px", margin: "18px 0 10px" }}>{txt}</div>;
  const fmtDT = (d) => d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const tams = TAMANHOS_GRADE.filter((t) => (cls.primeira[t] || 0) > 0 || (cls.segunda[t] || 0) > 0);

  const especAvi = (a) => {
    const p = [];
    if (a.largura) p.push(`largura ${a.largura}`);
    if (a.tipoCampo === "ziper") { if (a.tipo) p.push(a.tipo); if (a.tamanho) p.push(a.tamanho); }
    else if (a.tamanho) p.push(`tam. ${a.tamanho}`);
    return p.join(" · ");
  };

  return (
    <Overlay onFechar={onFechar} largura={560}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingRight: 30 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>{pedido.referencia}</h3>
          <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0 }}>{nomeCliente} · {(pedido.total || 0).toLocaleString("pt-BR")} peças · arquivado em {fmtData(pedido.arquivado_em)}</p>
        </div>
        <button onClick={baixarDossie} disabled={gerando || movs === null} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 12.5, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: gerando ? "wait" : "pointer" }}>
          <FileText size={14} /> {gerando ? "Gerando…" : "PDF completo"}
        </button>
      </div>

      <div style={{ padding: "12px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, marginTop: 16 }}>
        <GradeTabela grade={pedido.grade} margem="0 0 10px" />
        {info("Marca", pedido.marca)}
        {info("ID de corte", pedido.corte_id)}
        {info("Nota fiscal", pedido.nota_fiscal)}
        {info("Cor", pedido.cor)}
        {info("Tamanho", pedido.tamanho)}
        {info("Tecido", pedido.tecido)}
        {info("Peso", pedido.peso)}
        {info("Volume", pedido.volume)}
        {info("Prazo", pedido.prazo ? fmtData(pedido.prazo) : null)}
        {pedido.observacoes && <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{pedido.observacoes}</p>}
      </div>

      {temCls && (
        <>
          {secTit("Grade de qualidade")}
          <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 9 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11.5 }}>
              <thead><tr style={{ background: "var(--surface-2)" }}>
                <th style={{ border: "1px solid var(--border)", padding: "4px 6px", textAlign: "left", fontSize: 9.5, color: "var(--text-3)" }}>QUALIDADE</th>
                {tams.map((t) => <th key={t} style={{ border: "1px solid var(--border)", padding: "4px 6px", fontSize: 9.5, color: "var(--text-3)" }}>{t}</th>)}
                <th style={{ border: "1px solid var(--border)", padding: "4px 6px", fontSize: 9.5, color: "var(--text-2)", background: "var(--surface-3)" }}>TOTAL</th>
              </tr></thead>
              <tbody>
                {[["1ª qualidade", "primeira", "var(--success)"], ["2ª qualidade", "segunda", "var(--orange)"]].map(([rot, k, cor]) => (
                  <tr key={k}>
                    <td style={{ border: "1px solid var(--border)", padding: "4px 6px", textAlign: "left", fontWeight: 700, color: cor }}>{rot}</td>
                    {tams.map((t) => <td key={t} style={{ border: "1px solid var(--border)", padding: "4px 6px", textAlign: "center", color: (cls[k][t] || 0) ? cor : "var(--text-3)", fontWeight: (cls[k][t] || 0) ? 700 : 400 }}>{cls[k][t] || "·"}</td>)}
                    <td style={{ border: "1px solid var(--border)", padding: "4px 6px", textAlign: "center", fontWeight: 700, background: "var(--surface-2)", color: cor }}>{somaObjNum(cls[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {[["Processos do corte", procCorte], ["Processos do acabamento", procAcab]].map(([titulo, lista]) => lista.length > 0 && (
        <React.Fragment key={titulo}>
          {secTit(titulo)}
          {lista.map((p) => (
            <div key={p.nome} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, marginTop: 4, flexShrink: 0, background: p.qtd >= pedido.total ? "var(--success)" : p.qtd > 0 ? "var(--warning)" : "var(--border)" }} />
              <div style={{ flex: 1 }}>
                <div><strong>{p.nome}</strong> <span style={{ color: "var(--text-3)" }}>· {p.qtd}/{pedido.total}</span></div>
                {p.feito_em && <div style={{ fontSize: 11, color: "var(--text-3)" }}>finalizado em {p.feito_em}</div>}
                {p.obs && <div style={{ fontSize: 11.5, color: "var(--text-2)", fontStyle: "italic" }}>Obs: {p.obs}</div>}
              </div>
            </div>
          ))}
        </React.Fragment>
      ))}

      {avi.length > 0 && (
        <>
          {secTit("Aviamentos")}
          {avi.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12.5, alignItems: "baseline" }}>
              <strong style={{ minWidth: 120 }}>{a.nome}</strong>
              <span style={{ flex: 1, color: "var(--text-2)" }}>{especAvi(a) || "—"}{a.consumo ? ` · consumo ${a.consumo}` : ""}</span>
              {a.qtd && <span style={{ color: "var(--text-3)" }}>{a.qtd}</span>}
            </div>
          ))}
        </>
      )}

      {remessas.length > 0 && (
        <>
          {secTit("Remessas de oficina")}
          {remessas.map((r) => (
            <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
              <div><strong>{nomeOficina(r.oficina_id)}</strong> <span style={{ color: "var(--text-3)" }}>· {r.qtd_retornada}/{r.qtd_enviada}</span></div>
              <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>saiu {fmtData(r.data_saida)}{r.data_fechamento ? ` · voltou ${fmtData(r.data_fechamento)}` : " · em aberto"}</div>
              {r.motivo_fechamento && <div style={{ fontSize: 11.5, color: "var(--text-2)", fontStyle: "italic" }}>Motivo do fechamento: {r.motivo_fechamento}</div>}
            </div>
          ))}
        </>
      )}

      {secTit("Linha do tempo")}
      {movs === null && <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Carregando…</div>}
      {movs && movs.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Sem movimentações registradas.</div>}
      {movs && movs.map((m) => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
          <Package size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
          <span><strong>{m.qtd}</strong> peças: {rotuloLocal(m.de_local)} → <strong>{rotuloLocal(m.para_local)}</strong></span>
          {(m.criado_em || m.data) && <span style={{ marginLeft: "auto", color: "var(--text-3)", fontSize: 11.5, whiteSpace: "nowrap" }}>{fmtDT(m.criado_em || m.data)}</span>}
        </div>
      ))}
    </Overlay>
  );
}
