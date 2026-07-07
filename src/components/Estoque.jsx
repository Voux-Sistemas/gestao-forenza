import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { Package, Boxes, CheckCircle2, Award, ArrowRight, Trash2, FileText, Plus, X } from "lucide-react";
import StatCard from "./StatCard.jsx";
import { calcularSaldos as saldos } from "../etapas.js";
import { arquivarSeConcluido } from "../arquivamento.js";
import GradeTabela, { normalizarGrade } from "./GradeTabela.jsx";
import Overlay from "./Gaveta.jsx";

export default function Estoque({ session, perfil }) {
  const [aba, setAba] = useState("espera");
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [inspecionar, setInspecionar] = useState(null);
  const [darBaixa, setDarBaixa] = useState(null);
  const [faturamento, setFaturamento] = useState(null);
  const podeBaixar = ["master", "chefe_geral"].includes(perfil?.papel);

  const carregar = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from("pedidos").select("*").eq("arquivado", false).order("id"),
      supabase.from("clientes").select("*"),
    ]);
    const ids = (p.data || []).map((x) => x.id);
    const m = ids.length ? await supabase.from("movimentos").select("*").in("pedido_id", ids).order("id") : { data: [] };
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
  // Um pedido = um card: quem tem peças em 1ª ou 2ª qualidade aparece uma única vez.
  const prontos = computados.filter(({ s }) => (s.Primeira || 0) + (s.Segunda || 0) > 0);

  let totEspera = 0, totPrim = 0, totSeg = 0;
  computados.forEach(({ s }) => { totEspera += s.Estoque; totPrim += s.Primeira || 0; totSeg += s.Segunda || 0; });
  const totConcl = totPrim + totSeg;
  const aprov = totConcl > 0 ? Math.round((totPrim / totConcl) * 100) : null;

  const kpis = [
    { label: "Aguardando inspeção", valor: totEspera, sub: `em ${emEspera.length} pedido(s)`, Icon: Boxes, cor: "var(--warning)", bg: "var(--warning-bg)" },
    { label: "1ª qualidade", valor: totPrim, sub: "peças aprovadas", Icon: CheckCircle2, cor: "var(--success)", bg: "var(--success-bg)" },
    { label: "2ª qualidade", valor: totSeg, sub: "peças com ressalva", Icon: Package, cor: "var(--orange)", bg: "var(--orange-bg)" },
    { label: "Aproveitamento", valor: aprov == null ? "—" : `${aprov}%`, sub: `${totConcl} inspecionadas`, Icon: Award, cor: "var(--accent)", bg: "var(--accent-bg)" },
  ];

  return (
    <div className="fade-in" style={{ padding: "24px 26px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Estoque</h2>
        <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 3 }}>Inspecione as peças que chegam e acompanhe o que está pronto.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))", gap: 12, marginBottom: 22 }}>
        {kpis.map((k) => (
          <StatCard key={k.label} label={k.label} valor={k.valor} sub={k.sub} cor={k.cor} Icon={k.Icon} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => setAba("espera")} style={subTab(aba === "espera")}>Em espera ({emEspera.length})</button>
        <button onClick={() => setAba("estoque")} style={subTab(aba === "estoque")}>Em estoque ({prontos.length})</button>
      </div>

      {aba === "espera" && (
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
                <GradeTabela grade={pe.grade} />
                <button onClick={() => setInspecionar({ pe, disponivel: s.Estoque })} style={{ ...btnPrimary, width: "100%" }}>
                  Inspecionar <ArrowRight size={15} />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {aba === "estoque" && (
        prontos.length === 0 ? <Vazio texto="Nenhuma peça em estoque no momento." /> : (
          <div style={grade}>
            {prontos.map(({ pe, s }) => {
              const d1 = s.Primeira || 0;
              const d2 = s.Segunda || 0;
              return (
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
                  <div style={{ display: "flex", gap: 8, margin: "14px 0", paddingTop: 13, borderTop: "1px solid var(--border)" }}>
                    <div style={{ flex: 1, padding: "8px 11px", borderRadius: 9, background: "var(--success-bg)" }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".4px", color: "var(--success)" }}>1ª QUALIDADE</div>
                      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, color: d1 > 0 ? "var(--success)" : "var(--text-3)" }}>{d1}</div>
                    </div>
                    <div style={{ flex: 1, padding: "8px 11px", borderRadius: 9, background: "var(--orange-bg)" }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".4px", color: "var(--orange)" }}>2ª QUALIDADE</div>
                      <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, color: d2 > 0 ? "var(--orange)" : "var(--text-3)" }}>{d2}</div>
                    </div>
                  </div>
                  <GradeTabela grade={pe.grade} />
                  {podeBaixar && (
                    <button onClick={() => setDarBaixa({ pe, disp1: d1, disp2: d2 })} style={{ ...btnDanger, width: "100%", marginBottom: 8 }}>
                      <Trash2 size={14} /> Dar baixa
                    </button>
                  )}
                  <button onClick={() => setFaturamento(pe)} style={{ ...btnGhost, width: "100%" }}>
                    <FileText size={14} /> Grade de faturamento
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {faturamento && <ModalFaturamento pedido={faturamento} onFechar={() => setFaturamento(null)} onOk={() => { setFaturamento(null); carregar(); }} />}
      {inspecionar && <ModalInspecao dados={inspecionar} session={session} onFechar={() => setInspecionar(null)} onOk={() => { setInspecionar(null); carregar(); }} />}
      {darBaixa && <ModalBaixa dados={darBaixa} session={session} onFechar={() => setDarBaixa(null)} onOk={() => { setDarBaixa(null); carregar(); }} />}
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

// Tamanhos numerados da grade de faturamento (como na ficha física).
const TAMANHOS_FAT = ["PP/36", "P/38", "M/40", "G/42", "GG/44", "EG/46", "EGG/48", "EXG/50"];
const somaLinha = (linha) => TAMANHOS_FAT.reduce((a, t) => a + (parseInt(linha.qtds[t], 10) || 0), 0);

// Grade de faturamento: editável, com variantes (linhas) × tamanhos. Espelha a ficha de papel.
function ModalFaturamento({ pedido, onFechar, onOk }) {
  const salva = Array.isArray(pedido.grade_faturamento) && pedido.grade_faturamento.length
    ? pedido.grade_faturamento
    : [{ variante: "", qtds: {} }];
  const [linhas, setLinhas] = useState(salva.map((l) => ({ variante: l.variante || "", qtds: { ...(l.qtds || {}) } })));
  const [peso, setPeso] = useState(pedido.fat_peso || "");
  const [volume, setVolume] = useState(pedido.fat_volume || "");
  const [obs, setObs] = useState(pedido.fat_obs || "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const mudarQtd = (i, t, v) => setLinhas((ls) => ls.map((l, j) => j === i ? { ...l, qtds: { ...l.qtds, [t]: v } } : l));
  const mudarVar = (i, v) => setLinhas((ls) => ls.map((l, j) => j === i ? { ...l, variante: v } : l));
  const addLinha = () => setLinhas((ls) => [...ls, { variante: "", qtds: {} }]);
  const removerLinha = (i) => setLinhas((ls) => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls);

  const totalPorTam = (t) => linhas.reduce((a, l) => a + (parseInt(l.qtds[t], 10) || 0), 0);
  const totalGeral = linhas.reduce((a, l) => a + somaLinha(l), 0);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    // Guarda só as linhas com algum dado.
    const limpa = linhas
      .map((l) => ({ variante: l.variante.trim(), qtds: Object.fromEntries(TAMANHOS_FAT.map((t) => [t, parseInt(l.qtds[t], 10) || 0]).filter(([, q]) => q > 0)) }))
      .filter((l) => l.variante || Object.keys(l.qtds).length);
    const { error } = await supabase.from("pedidos").update({
      grade_faturamento: limpa.length ? limpa : null,
      fat_peso: peso.trim() || null,
      fat_volume: volume.trim() || null,
      fat_obs: obs.trim() || null,
    }).eq("id", pedido.id);
    setSalvando(false);
    if (error) return setErro(error.message);
    onOk();
  }

  const cel = { border: "1px solid var(--border)", padding: 0, textAlign: "center" };
  const inpCel = { width: "100%", border: "none", background: "transparent", textAlign: "center", fontSize: 12.5, padding: "6px 2px", color: "var(--text)", fontFamily: "inherit", outline: "none" };

  return (
    <Overlay onFechar={onFechar} largura={720} zIndex={106}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Faturamento — {pedido.referencia}</h3>
      <p style={{ fontSize: 12.5, color: "var(--text-2)", margin: "0 0 18px" }}>Compare o que foi pedido com o que realmente faturou.</p>

      {pedido.grade && normalizarGrade(pedido.grade).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>Grade do pedido (referência)</div>
          <GradeTabela grade={pedido.grade} margem="0" />
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>Grade de faturamento</div>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)" }}>
              <th style={{ ...cel, textAlign: "left", padding: "7px 10px", fontSize: 10.5, color: "var(--text-3)", letterSpacing: ".3px", minWidth: 120 }}>VARIANTE</th>
              {TAMANHOS_FAT.map((t) => <th key={t} style={{ ...cel, padding: "7px 4px", fontSize: 10, color: "var(--text-3)", minWidth: 52 }}>{t}</th>)}
              <th style={{ ...cel, padding: "7px 6px", fontSize: 10.5, color: "var(--text-2)", background: "var(--surface-3)" }}>TOTAL</th>
              <th style={{ ...cel, width: 34, background: "var(--surface-2)" }}></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                <td style={{ ...cel, textAlign: "left" }}>
                  <input value={l.variante} onChange={(e) => mudarVar(i, e.target.value)} placeholder="cor / variante" style={{ ...inpCel, textAlign: "left", padding: "6px 10px", fontWeight: 600 }} />
                </td>
                {TAMANHOS_FAT.map((t) => (
                  <td key={t} style={cel}>
                    <input type="number" min="0" value={l.qtds[t] ?? ""} onChange={(e) => mudarQtd(i, t, e.target.value)} placeholder="—" style={inpCel} />
                  </td>
                ))}
                <td style={{ ...cel, background: "var(--surface-2)", fontWeight: 700, fontSize: 13 }}>{somaLinha(l)}</td>
                <td style={cel}>
                  <button onClick={() => removerLinha(i)} disabled={linhas.length === 1} aria-label="Remover linha" style={{ display: "inline-flex", border: "none", background: "none", color: "var(--text-3)", cursor: linhas.length === 1 ? "not-allowed" : "pointer", padding: 5, opacity: linhas.length === 1 ? 0.4 : 1 }}><X size={13} /></button>
                </td>
              </tr>
            ))}
            <tr style={{ background: "var(--surface-2)", fontWeight: 700 }}>
              <td style={{ ...cel, textAlign: "left", padding: "7px 10px", fontSize: 12 }}>TOTAL</td>
              {TAMANHOS_FAT.map((t) => <td key={t} style={{ ...cel, fontSize: 12.5, color: totalPorTam(t) > 0 ? "var(--accent)" : "var(--text-3)" }}>{totalPorTam(t) || ""}</td>)}
              <td style={{ ...cel, background: "var(--accent-bg)", color: "var(--accent)", fontSize: 14 }}>{totalGeral}</td>
              <td style={cel}></td>
            </tr>
          </tbody>
        </table>
      </div>

      <button onClick={addLinha} style={{ ...btnGhost, marginTop: 10 }}><Plus size={14} /> Adicionar variante</button>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <div style={{ flex: 1 }}><label style={lbl}>Peso</label><input value={peso} onChange={(e) => setPeso(e.target.value)} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Volume</label><input value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="ex: 8 volumes" style={inp} /></div>
      </div>
      <label style={{ ...lbl, marginTop: 14 }}>Observações</label>
      <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="ex: 1 pç p/ showroom, falta 2 pçs da oficina…" style={{ ...inp, resize: "vertical" }} />

      {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "10px 0 0" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
        <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Salvar grade"}</button>
      </div>
    </Overlay>
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

function ModalBaixa({ dados, session, onFechar, onOk }) {
  const { pe, disp1, disp2 } = dados;
  const [q1, setQ1] = useState(String(disp1));
  const [q2, setQ2] = useState(String(disp2));
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const n1 = Math.max(0, parseInt(q1, 10) || 0);
  const n2 = Math.max(0, parseInt(q2, 10) || 0);
  const totalBaixa = n1 + n2;

  async function confirmar() {
    setErro(null);
    if (n1 > disp1) return setErro(`Só há ${disp1} peça(s) de 1ª qualidade.`);
    if (n2 > disp2) return setErro(`Só há ${disp2} peça(s) de 2ª qualidade.`);
    if (totalBaixa < 1) return setErro("Informe ao menos 1 peça para dar baixa.");
    if (!window.confirm(`Confirmar baixa de ${totalBaixa} peça(s)? Esta ação não pode ser desfeita.`)) return;
    setSalvando(true);
    for (const [tipo, q] of [["Primeira", n1], ["Segunda", n2]]) {
      if (q < 1) continue;
      const { error } = await supabase.from("movimentos").insert({
        pedido_id: pe.id, de_local: tipo, para_local: "Saida", qtd: q,
        usuario_id: session.user.id, observacao: motivo.trim() || null,
      });
      if (error) { setSalvando(false); return setErro(error.message); }
    }
    setSalvando(false);
    await arquivarSeConcluido(pe.id); // se foi a última peça sob gestão, o pedido é arquivado
    onOk();
  }

  const linhaQualidade = (rotulo, cor, disponivel, valor, aoMudar) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, opacity: disponivel > 0 ? 1 : 0.45 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: cor }}>{rotulo}</div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{disponivel} disponível(is)</div>
      </div>
      <input type="number" min="0" max={disponivel} value={valor} disabled={disponivel === 0} onChange={(e) => aoMudar(e.target.value)}
        style={{ width: 100, padding: "9px 11px", fontSize: 14, textAlign: "right", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", boxSizing: "border-box" }} />
    </div>
  );

  return (
    <Overlay onFechar={onFechar} largura={440} zIndex={105}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Dar baixa — {pe.referencia}</h3>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 14px" }}>Informe quantas peças saem de cada qualidade.</p>
        <GradeTabela grade={pe.grade} margem="0 0 16px" />
        {linhaQualidade("1ª qualidade", "var(--success)", disp1, q1, setQ1)}
        {linhaQualidade("2ª qualidade", "var(--orange)", disp2, q2, setQ2)}
        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", margin: "6px 0 5px", fontWeight: 500 }}>Motivo / destino (opcional)</label>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Venda, envio ao cliente, avaria…" style={{ width: "100%", padding: "10px 12px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", boxSizing: "border-box" }} />
        {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "10px 0 0" }}>{erro}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
          <button onClick={confirmar} disabled={salvando || totalBaixa < 1} style={{ ...btnDanger, flex: 1, opacity: totalBaixa < 1 ? 0.55 : 1 }}>
            {salvando ? "Salvando…" : `Confirmar baixa de ${totalBaixa}`}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", margin: "12px 0 0" }}>Baixando todas as peças, o pedido é concluído e vai para o Histórico.</p>
    </Overlay>
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
      <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 14px" }}>{disponivel} peças aguardando classificação</p>
      <GradeTabela grade={pe.grade} margem="0 0 16px" />

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
const btnDanger = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--danger)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer", transition: "background .15s" };

const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", fontSize: 13, fontWeight: 700, borderRadius: 9, border: "none", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", boxShadow: "var(--shadow-sm)", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
