import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { Plus, ArrowRight, Package } from "lucide-react";

const LOCAIS = ["Entrada", "Corte", "Oficina", "Acabamento", "Estoque", "Perda"];
const COLUNAS = ["Entrada", "Corte", "Oficina", "Acabamento", "Estoque"];
const CORES = {
  Entrada: "var(--text-2)", Corte: "var(--accent)", Oficina: "var(--warning)",
  Acabamento: "var(--accent)", Estoque: "var(--success)", Perda: "var(--danger)",
};

function calcularSaldos(pedidoId, total, movimentos) {
  const s = { Entrada: total, Corte: 0, Oficina: 0, Acabamento: 0, Estoque: 0, Perda: 0 };
  for (const m of movimentos) {
    if (m.pedido_id !== pedidoId) continue;
    s[m.de_local] -= m.qtd;
    s[m.para_local] += m.qtd;
  }
  return s;
}

export default function Quadro({ session, perfil }) {
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mover, setMover] = useState(null);
  const [novoAberto, setNovoAberto] = useState(false);

  const carregar = useCallback(async () => {
    const [p, m, c, o] = await Promise.all([
      supabase.from("pedidos").select("*").order("id"),
      supabase.from("movimentos").select("*").order("id"),
      supabase.from("clientes").select("*").order("nome"),
      supabase.from("oficinas").select("*").order("nome_empresa"),
    ]);
    setPedidos(p.data || []); setMovimentos(m.data || []);
    setClientes(c.data || []); setOficinas(o.data || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

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
    <div style={{ padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h2 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>Quadro de produção</h2>
        {podeVerTudo && (
          <button onClick={() => setNovoAberto(true)} style={btnPrimary}><Plus size={16} /> Novo pedido</button>
        )}
      </div>

      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
        {colunas.map((local) => {
          const cards = pedidos
            .map((pe) => ({ pe, saldo: calcularSaldos(pe.id, pe.total, movimentos) }))
            .filter(({ saldo }) => saldo[local] > 0);
          return (
            <div key={local} style={coluna}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: CORES[local] }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{local}</span>
                <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>{cards.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cards.map(({ pe, saldo }) => (
                  <button key={pe.id} onClick={() => setMover({ pedido: pe, local, saldo: saldo[local] })} style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{pe.referencia}</span>
                      <span style={{ fontSize: 12, color: "var(--text-2)" }}>{pe.marca || ""}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", margin: "3px 0 6px" }}>{nomeCliente(pe.cliente_id)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Package size={13} style={{ color: CORES[local] }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: CORES[local] }}>{saldo[local]}</span>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>de {pe.total}</span>
                    </div>
                  </button>
                ))}
                {cards.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 2px" }}>vazio</div>}
              </div>
            </div>
          );
        })}
      </div>

      {mover && <ModalMover dados={mover} session={session} onFechar={() => setMover(null)} onOk={() => { setMover(null); carregar(); }} />}
      {novoAberto && <ModalNovo clientes={clientes} oficinas={oficinas} onFechar={() => setNovoAberto(false)} onOk={() => { setNovoAberto(false); carregar(); }} />}
    </div>
  );
}

function ModalMover({ dados, session, onFechar, onOk }) {
  const { pedido, local, saldo } = dados;
  const destinos = LOCAIS.filter((l) => l !== local);
  const [destino, setDestino] = useState(destinos[0]);
  const [qtd, setQtd] = useState(saldo);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [verResumo, setVerResumo] = useState(false);

  async function confirmar() {
    setErro(null);
    const q = parseInt(qtd, 10);
    if (!q || q < 1) return setErro("Quantidade inválida.");
    if (q > saldo) return setErro(`Só há ${saldo} peças em ${local}.`);
    setSalvando(true);
    const { error } = await supabase.from("movimentos").insert({
      pedido_id: pedido.id, de_local: local, para_local: destino, qtd: q, usuario_id: session.user.id,
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    onOk();
  }

  return (
    <Overlay onFechar={onFechar}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Mover peças</h3>
      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px" }}>{pedido.referencia} · {saldo} peças em {local}</p>
      <label style={lbl}>Quantidade</label>
      <input type="number" min="1" max={saldo} value={qtd} onChange={(e) => setQtd(e.target.value)} style={inp} />
      <label style={{ ...lbl, marginTop: 14 }}>Enviar para</label>
      <select value={destino} onChange={(e) => setDestino(e.target.value)} style={inp}>
        {destinos.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "12px 0 0" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={confirmar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>
          {salvando ? "Movendo…" : <>Mover <ArrowRight size={15} /></>}
        </button>
      </div>
      {pedido.solicitacao_id && (
        <button onClick={() => setVerResumo(true)} style={{ ...btnGhost, width: "100%", marginTop: 10 }}>
          Ver ficha e histórico da pilotagem
        </button>
      )}
      {verResumo && <ResumoPilotagem solicitacaoId={pedido.solicitacao_id} onFechar={() => setVerResumo(false)} />}
    </Overlay>
  );
}

function ModalNovo({ clientes, oficinas, onFechar, onOk }) {
  const [clienteId, setClienteId] = useState(clientes[0]?.id || "");
  const [oficinaId, setOficinaId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [marca, setMarca] = useState("");
  const [total, setTotal] = useState("");
  const [prazo, setPrazo] = useState("");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!clienteId) return setErro("Escolha um cliente.");
    if (!referencia.trim()) return setErro("Informe a referência.");
    const t = parseInt(total, 10);
    if (!t || t < 1) return setErro("Total de peças inválido.");
    setSalvando(true);
    const { error } = await supabase.from("pedidos").insert({
      cliente_id: clienteId, oficina_id: oficinaId || null,
      referencia: referencia.trim(), marca: marca.trim() || null, total: t, prazo: prazo || null,
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    onOk();
  }

  return (
    <Overlay onFechar={onFechar}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>Novo pedido</h3>
      <label style={lbl}>Cliente</label>
      <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={inp}>
        {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Referência</label>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Marca</label>
          <input value={marca} onChange={(e) => setMarca(e.target.value)} style={inp} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Total de peças</label>
          <input type="number" min="1" value={total} onChange={(e) => setTotal(e.target.value)} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Prazo</label>
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={inp} /></div>
      </div>
      <label style={{ ...lbl, marginTop: 14 }}>Oficina (opcional)</label>
      <select value={oficinaId} onChange={(e) => setOficinaId(e.target.value)} style={inp}>
        <option value="">— nenhuma —</option>
        {oficinas.map((o) => <option key={o.id} value={o.id}>{o.nome_empresa}</option>)}
      </select>
      {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "12px 0 0" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Criar pedido"}</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onFechar }) {
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
        {children}
      </div>
    </div>
  );
}

function ResumoPilotagem({ solicitacaoId, onFechar }) {
  const [ficha, setFicha] = useState("");
  const [descricao, setDescricao] = useState("");
  const [comentarios, setComentarios] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      const sol = await supabase.from("solicitacoes").select("ficha_tecnica, descricao").eq("id", solicitacaoId).single();
      const com = await supabase.from("comentarios_pilotagem").select("*").eq("solicitacao_id", solicitacaoId).order("id");
      setFicha(sol.data?.ficha_tecnica || "");
      setDescricao(sol.data?.descricao || "");
      setComentarios(com.data || []);
      setCarregando(false);
    })();
  }, [solicitacaoId]);

  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 70 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Ficha e histórico da pilotagem</h3>
        {descricao && <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px" }}>{descricao}</p>}
        {carregando ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Carregando…</p> : (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>Ficha técnica</div>
              <div style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap", lineHeight: 1.5, padding: "10px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
                {ficha || "— sem ficha técnica —"}
              </div>
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
                        <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.texto}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
        <button onClick={onFechar} style={{ ...btnGhost, width: "100%", marginTop: 20 }}>Fechar</button>
      </div>
    </div>
  );
}

const coluna = { minWidth: 220, width: 220, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 };
const card = { textAlign: "left", width: "100%", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 11px", display: "block", cursor: "pointer" };
const inp = { width: "100%", padding: "9px 11px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };
const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
