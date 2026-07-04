import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient.js";
import { Search, Eye, ArchiveRestore, Archive, Package } from "lucide-react";
import Overlay from "./Gaveta.jsx";
import { calcularSaldos, rotuloLocal } from "../etapas.js";

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

export default function Historico() {
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

  async function desarquivar(pe) {
    if (!window.confirm(`Desarquivar o pedido ${pe.referencia}? Ele volta a aparecer nas telas do dia a dia.`)) return;
    const { error } = await supabase.from("pedidos").update({ arquivado: false, arquivado_em: null }).eq("id", pe.id);
    if (error) return window.alert("Não foi possível desarquivar: " + error.message);
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
              <button className="tap" onClick={() => desarquivar(pe)} title="Desarquivar" aria-label={`Desarquivar ${pe.referencia}`}
                style={{ display: "inline-flex", padding: 6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" }}>
                <ArchiveRestore size={14} />
              </button>
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
function DetalhePedido({ pedido, nomeCliente, onFechar }) {
  const [movs, setMovs] = useState(null);

  useEffect(() => {
    supabase.from("movimentos").select("*").eq("pedido_id", pedido.id).order("id")
      .then(({ data }) => setMovs(data || []));
  }, [pedido.id]);

  const info = (rotulo, valor) => valor ? (
    <div style={{ display: "flex", gap: 8, fontSize: 12.5, marginBottom: 4 }}>
      <span style={{ color: "var(--text-3)", minWidth: 78 }}>{rotulo}</span>
      <span style={{ fontWeight: 600 }}>{valor}</span>
    </div>
  ) : null;

  return (
    <Overlay onFechar={onFechar} largura={520}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>{pedido.referencia}</h3>
      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px" }}>{nomeCliente} · {(pedido.total || 0).toLocaleString("pt-BR")} peças · arquivado em {fmtData(pedido.arquivado_em)}</p>

      <div style={{ padding: "12px 14px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 16 }}>
        {pedido.grade && Object.keys(pedido.grade).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {Object.entries(pedido.grade).map(([t, q]) => (
              <span key={t} style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: "var(--surface)", border: "1px solid var(--border)" }}>{t} <span style={{ color: "var(--accent)" }}>{q}</span></span>
            ))}
          </div>
        )}
        {info("Marca", pedido.marca)}
        {info("Cor", pedido.cor)}
        {info("Peso", pedido.peso)}
        {info("Volume", pedido.volume)}
        {info("Prazo", pedido.prazo ? fmtData(pedido.prazo) : null)}
        {pedido.observacoes && <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{pedido.observacoes}</p>}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 10 }}>Linha do tempo</div>
      {movs === null && <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Carregando…</div>}
      {movs && movs.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Sem movimentações registradas.</div>}
      {movs && movs.map((m) => (
        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
          <Package size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
          <span><strong>{m.qtd}</strong> peças: {rotuloLocal(m.de_local)} → <strong>{rotuloLocal(m.para_local)}</strong></span>
          {m.criado_em && <span style={{ marginLeft: "auto", color: "var(--text-3)", fontSize: 11.5, whiteSpace: "nowrap" }}>{new Date(m.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
        </div>
      ))}
    </Overlay>
  );
}
