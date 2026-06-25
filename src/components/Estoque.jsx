import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { Package } from "lucide-react";

function saldos(pedidoId, total, movimentos) {
  const s = { Entrada: total, Corte: 0, Oficina: 0, Acabamento: 0, Estoque: 0, Perda: 0, Primeira: 0, Segunda: 0 };
  for (const m of movimentos) {
    if (m.pedido_id !== pedidoId) continue;
    if (s[m.de_local] === undefined) s[m.de_local] = 0;
    if (s[m.para_local] === undefined) s[m.para_local] = 0;
    s[m.de_local] -= m.qtd;
    s[m.para_local] += m.qtd;
  }
  return s;
}

export default function Estoque({ session }) {
  const [aba, setAba] = useState("espera");
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [inspecionar, setInspecionar] = useState(null);

  const carregar = useCallback(async () => {
    const [p, m, c] = await Promise.all([
      supabase.from("pedidos").select("*").order("id"),
      supabase.from("movimentos").select("*").order("id"),
      supabase.from("clientes").select("*"),
    ]);
    setPedidos(p.data || []); setMovimentos(m.data || []); setClientes(c.data || []);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const canal = supabase.channel("estoque")
      .on("postgres_changes", { event: "*", schema: "public", table: "movimentos" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [carregar]);

  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || "—";

  if (carregando) return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando…</div>;

  const computados = pedidos.map((pe) => ({ pe, s: saldos(pe.id, pe.total, movimentos) }));
  const emEspera = computados.filter(({ s }) => s.Estoque > 0);
  const concluidos = computados.filter(({ s }) => s.Primeira > 0 || s.Segunda > 0);

  return (
    <div style={{ padding: "20px 22px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 16px" }}>Estoque</h2>
      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => setAba("espera")} style={subTab(aba === "espera")}>Em espera ({emEspera.length})</button>
        <button onClick={() => setAba("concluido")} style={subTab(aba === "concluido")}>Concluído ({concluidos.length})</button>
      </div>

      {aba === "espera" ? (
        emEspera.length === 0 ? <p style={txtVazio}>Nenhuma peça aguardando inspeção.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {emEspera.map(({ pe, s }) => (
              <div key={pe.id} style={cartao}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{pe.referencia}</span>
                      {pe.marca && <span style={{ fontSize: 12, color: "var(--text-2)" }}>{pe.marca}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{nomeCliente(pe.cliente_id)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                      <Package size={14} style={{ color: "var(--warning)" }} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--warning)" }}>{s.Estoque}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>aguardando</div>
                  </div>
                </div>
                <button onClick={() => setInspecionar({ pe, disponivel: s.Estoque })} style={{ ...btnPrimary, width: "100%", marginTop: 12 }}>
                  Inspecionar
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        concluidos.length === 0 ? <p style={txtVazio}>Nenhuma peça inspecionada ainda.</p> : (
          <div style={tabela}>
            <div style={{ ...linha, ...cabecalho }}>
              <span style={{ flex: 2 }}>Referência</span>
              <span style={{ flex: 2 }}>Cliente</span>
              <span style={{ flex: 1, textAlign: "right" }}>1ª qual.</span>
              <span style={{ flex: 1, textAlign: "right" }}>2ª qual.</span>
              <span style={{ flex: 1, textAlign: "right" }}>Total</span>
            </div>
            {concluidos.map(({ pe, s }) => (
              <div key={pe.id} style={linha}>
                <span style={{ flex: 2, fontWeight: 500 }}>{pe.referencia}{pe.marca ? ` · ${pe.marca}` : ""}</span>
                <span style={{ flex: 2, color: "var(--text-2)" }}>{nomeCliente(pe.cliente_id)}</span>
                <span style={{ flex: 1, textAlign: "right", color: "var(--success)", fontWeight: 600 }}>{s.Primeira}</span>
                <span style={{ flex: 1, textAlign: "right", color: "var(--warning)", fontWeight: 600 }}>{s.Segunda}</span>
                <span style={{ flex: 1, textAlign: "right", fontWeight: 600 }}>{s.Primeira + s.Segunda}</span>
              </div>
            ))}
          </div>
        )
      )}

      {inspecionar && <ModalInspecao dados={inspecionar} session={session} onFechar={() => setInspecionar(null)} onOk={() => { setInspecionar(null); carregar(); }} />}
    </div>
  );
}

function ModalInspecao({ dados, session, onFechar, onOk }) {
  const { pe, disponivel } = dados;
  const [q1, setQ1] = useState(String(disponivel));
  const [q2, setQ2] = useState("0");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const n1 = parseInt(q1, 10) || 0;
  const n2 = parseInt(q2, 10) || 0;
  const soma = n1 + n2;
  const restante = disponivel - soma;

  async function confirmar() {
    setErro(null);
    if (soma < 1) return setErro("Informe ao menos 1 peça.");
    if (soma > disponivel) return setErro(`Só há ${disponivel} peças em espera.`);
    setSalvando(true);
    try {
      if (n1 > 0) {
        const r = await supabase.from("movimentos").insert({ pedido_id: pe.id, de_local: "Estoque", para_local: "Primeira", qtd: n1, usuario_id: session.user.id });
        if (r.error) throw r.error;
      }
      if (n2 > 0) {
        const r = await supabase.from("movimentos").insert({ pedido_id: pe.id, de_local: "Estoque", para_local: "Segunda", qtd: n2, usuario_id: session.user.id });
        if (r.error) throw r.error;
      }
      onOk();
    } catch (e) {
      setErro(e.message || "Erro ao salvar.");
      setSalvando(false);
    }
  }

  return (
    <Overlay onFechar={onFechar}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Inspecionar — {pe.referencia}</h3>
      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px" }}>{disponivel} peças aguardando classificação</p>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>1ª qualidade</label>
          <input type="number" min="0" max={disponivel} value={q1} onChange={(e) => setQ1(e.target.value)} autoFocus style={inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>2ª qualidade</label>
          <input type="number" min="0" max={disponivel} value={q2} onChange={(e) => setQ2(e.target.value)} style={inp} />
        </div>
      </div>

      <div style={{ fontSize: 12, color: restante < 0 ? "var(--danger)" : "var(--text-2)", marginTop: 10 }}>
        {soma} de {disponivel} classificadas · {restante >= 0 ? `${restante} ficam em espera` : "passou do disponível"}
      </div>

      {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "12px 0 0" }}>{erro}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={confirmar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Confirmar"}</button>
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

const subTab = (ativo) => ({
  padding: "9px 14px", fontSize: 13, fontWeight: 500, border: "none", background: "none", cursor: "pointer",
  color: ativo ? "var(--accent)" : "var(--text-2)",
  borderBottom: ativo ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1,
});
const tabela = { border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" };
const linha = { display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: "1px solid var(--border)", fontSize: 13 };
const cabecalho = { background: "var(--surface-2)", fontSize: 12, color: "var(--text-2)", fontWeight: 600 };
const txtVazio = { fontSize: 13, color: "var(--text-3)", padding: "16px 2px" };
const cartao = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" };
const inp = { width: "100%", padding: "9px 11px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };
const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
