import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { Package, Boxes, CheckCircle2, Award, ArrowRight } from "lucide-react";
import StatCard from "./StatCard.jsx";

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

  let totEspera = 0, totPrim = 0, totSeg = 0;
  computados.forEach(({ s }) => { totEspera += s.Estoque; totPrim += s.Primeira; totSeg += s.Segunda; });
  const totConcl = totPrim + totSeg;
  const aprov = totConcl > 0 ? Math.round((totPrim / totConcl) * 100) : null;

  const kpis = [
    { label: "Aguardando inspeção", valor: totEspera, sub: `em ${emEspera.length} pedido(s)`, Icon: Boxes, cor: "var(--warning)", bg: "var(--warning-bg)" },
    { label: "1ª qualidade", valor: totPrim, sub: "peças aprovadas", Icon: CheckCircle2, cor: "var(--success)", bg: "var(--success-bg)" },
    { label: "2ª qualidade", valor: totSeg, sub: "peças com ressalva", Icon: Package, cor: "var(--orange)", bg: "var(--orange-bg)" },
    { label: "Aproveitamento", valor: aprov == null ? "—" : `${aprov}%`, sub: `${totConcl} inspecionadas`, Icon: Award, cor: "var(--accent)", bg: "var(--accent-bg)" },
  ];

  return (
    <div className="fade-in" style={{ padding: "20px 22px" }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 16px" }}>Estoque</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))", gap: 12, marginBottom: 22 }}>
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} valor={k.valor} sub={k.sub} cor={k.cor} Icon={k.Icon} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => setAba("espera")} style={subTab(aba === "espera")}>Em espera ({emEspera.length})</button>
        <button onClick={() => setAba("concluido")} style={subTab(aba === "concluido")}>Concluído ({concluidos.length})</button>
      </div>

      {aba === "espera" ? (
        emEspera.length === 0 ? <Vazio texto="Nenhuma peça aguardando inspeção." /> : (
          <div style={grade}>
            {emEspera.map(({ pe, s }) => (
              <div key={pe.id} className="lift" style={cartao}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pe.referencia}</span>
                      {pe.marca && <span style={tag}>{pe.marca}</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 3 }}>{nomeCliente(pe.cliente_id)}</div>
                  </div>
                  <Package size={17} strokeWidth={2} style={{ color: "var(--text-3)", flexShrink: 0, marginTop: 2 }} />
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 7, margin: "15px 0 15px", paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 30, fontWeight: 800, color: "var(--warning)", lineHeight: 1, letterSpacing: "-.02em" }}>{s.Estoque}</span>
                  <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>de {pe.total} aguardando inspeção</span>
                </div>

                <button onClick={() => setInspecionar({ pe, disponivel: s.Estoque })} style={{ ...btnPrimary, width: "100%" }}>
                  Inspecionar <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        concluidos.length === 0 ? <Vazio texto="Nenhuma peça inspecionada ainda." /> : (
          <div style={grade}>
            {concluidos.map(({ pe, s }) => {
              const tot = s.Primeira + s.Segunda;
              const p1 = tot ? (s.Primeira / tot) * 100 : 0;
              const ap = tot ? Math.round((s.Primeira / tot) * 100) : 0;
              return (
                <div key={pe.id} className="lift" style={cartao}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pe.referencia}</span>
                        {pe.marca && <span style={tag}>{pe.marca}</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 2 }}>{nomeCliente(pe.cliente_id)}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{tot}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>peças</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", height: 9, borderRadius: 99, overflow: "hidden", background: "var(--surface-3)", marginBottom: 10 }}>
                    {s.Primeira > 0 && <div style={{ width: `${p1}%`, background: "var(--success)" }} />}
                    {s.Segunda > 0 && <div style={{ width: `${100 - p1}%`, background: "var(--orange)" }} />}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 14 }}>
                      <Legenda cor="var(--success)" rotulo="1ª" valor={s.Primeira} />
                      <Legenda cor="var(--orange)" rotulo="2ª" valor={s.Segunda} />
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)", background: "var(--accent-bg)", padding: "3px 9px", borderRadius: 99 }}>{ap}% aprov.</span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {inspecionar && <ModalInspecao dados={inspecionar} session={session} onFechar={() => setInspecionar(null)} onOk={() => { setInspecionar(null); carregar(); }} />}
    </div>
  );
}

function Legenda({ cor, rotulo, valor }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 9, height: 9, borderRadius: 99, background: cor }} />
      <span style={{ fontSize: 13, color: "var(--text-2)" }}>{rotulo}</span>
      <strong style={{ fontSize: 13, color: "var(--text)" }}>{valor}</strong>
    </span>
  );
}

function Vazio({ texto }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "48px 0", color: "var(--text-3)" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Boxes size={26} style={{ color: "var(--text-3)" }} />
      </div>
      <span style={{ fontSize: 14 }}>{texto}</span>
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
  const p1 = soma ? (n1 / soma) * 100 : 0;

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
          <label style={lbl}><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--success)", display: "inline-block", marginRight: 6 }} />1ª qualidade</label>
          <input type="number" min="0" max={disponivel} value={q1} onChange={(e) => setQ1(e.target.value)} autoFocus style={inp} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--orange)", display: "inline-block", marginRight: 6 }} />2ª qualidade</label>
          <input type="number" min="0" max={disponivel} value={q2} onChange={(e) => setQ2(e.target.value)} style={inp} />
        </div>
      </div>

      {soma > 0 && (
        <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: "var(--surface-3)", marginTop: 14 }}>
          {n1 > 0 && <div style={{ width: `${p1}%`, background: "var(--success)" }} />}
          {n2 > 0 && <div style={{ width: `${100 - p1}%`, background: "var(--orange)" }} />}
        </div>
      )}

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
      <div onClick={(e) => e.stopPropagation()} className="pop" style={{ width: "100%", maxWidth: 420, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22, boxShadow: "var(--shadow-lg)" }}>
        {children}
      </div>
    </div>
  );
}

const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 290px), 1fr))", gap: 14 };
const subTab = (ativo) => ({
  padding: "9px 14px", fontSize: 13, fontWeight: 500, border: "none", background: "none", cursor: "pointer",
  color: ativo ? "var(--accent)" : "var(--text-2)",
  borderBottom: ativo ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1,
});
const cartao = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px", boxShadow: "var(--shadow-card)" };
const tag = { fontSize: 10.5, fontWeight: 600, borderRadius: 99, padding: "2px 8px", color: "var(--accent)", background: "var(--accent-bg)", whiteSpace: "nowrap" };
const inp = { width: "100%", padding: "9px 11px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };
const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
