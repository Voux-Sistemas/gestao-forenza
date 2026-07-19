import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { Package, Boxes, CheckCircle2, Award, ArrowRight, Trash2, FileText, Plus, X } from "lucide-react";
import StatCard from "./StatCard.jsx";
import { calcularSaldos as saldos } from "../etapas.js";
import { arquivarSeConcluido } from "../arquivamento.js";
import GradeTabela, { normalizarGrade, gradePorTamanho, totalGrade, TAMANHOS_GRADE } from "./GradeTabela.jsx";
import { gerarPdfEtapa } from "../pdfEtapa.js";
import Overlay, { Bloco } from "./Gaveta.jsx";

export default function Estoque({ session, perfil }) {
  const [aba, setAba] = useState("espera");
  const [pedidos, setPedidos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [inspecionar, setInspecionar] = useState(null);
  const [detalhesId, setDetalhesId] = useState(null); // id do pedido aberto na gaveta de detalhes
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

  // Consolida, por pedido, os tamanhos que foram classificados como 1ª/2ª qualidade
  // (a partir da grade gravada em cada movimento de inspeção).
  const classificacaoDe = (pedidoId) => {
    const acc = { primeira: {}, segunda: {} };
    movimentos.forEach((m) => {
      if (m.pedido_id !== pedidoId || !m.grade) return;
      const alvo = m.para_local === "Primeira" ? "primeira" : m.para_local === "Segunda" ? "segunda" : null;
      if (!alvo) return;
      Object.entries(gradePorTamanho(m.grade)).forEach(([t, q]) => { acc[alvo][t] = (acc[alvo][t] || 0) + q; });
    });
    const vazio = (o) => Object.keys(o).length === 0;
    if (vazio(acc.primeira) && vazio(acc.segunda)) return null;
    return acc;
  };

  const [pdfId, setPdfId] = useState(null); // id do pedido gerando PDF
  async function baixarPdf(pe, qtd, classificacao = null) {
    if (pdfId) return;
    setPdfId(pe.id);
    try {
      const imagens = [];
      if (pe.anexo_amostra) {
        const u = supabase.storage.from("anexos").getPublicUrl(pe.anexo_amostra).data.publicUrl;
        if (u) imagens.push({ url: u, rotulo: "Amostra" });
      }
      if (pe.solicitacao_id) {
        const { data: sol } = await supabase.from("solicitacoes").select("imagem_url").eq("id", pe.solicitacao_id).single();
        if (sol && sol.imagem_url) imagens.push({ url: sol.imagem_url, rotulo: "Referência" });
      }
      await gerarPdfEtapa({
        pedido: pe, cliente: nomeCliente(pe.cliente_id), local: "Estoque", qtd,
        parte: 1, totalPartes: 1, oficina: null, processos: null, imagens, classificacao,
      });
    } finally {
      setPdfId(null);
    }
  }

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
                  <button onClick={() => setDetalhesId(pe.id)} style={{ ...btnPrimary, width: "100%" }}>
                    Ver detalhes <ArrowRight size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {inspecionar && <ModalInspecao dados={inspecionar} session={session} pdfId={pdfId} onPdf={(pe, qtd) => baixarPdf(pe, qtd)} onFechar={() => setInspecionar(null)} onOk={() => { setInspecionar(null); carregar(); }} />}
      {(() => {
        const alvo = detalhesId ? prontos.find(({ pe }) => pe.id === detalhesId) : null;
        if (!alvo) return null;
        return (
          <ModalDetalhes
            pe={alvo.pe} s={alvo.s} cls={classificacaoDe(alvo.pe.id)}
            nomeCliente={nomeCliente} podeBaixar={podeBaixar} pdfId={pdfId} session={session}
            onPdf={() => baixarPdf(alvo.pe, (alvo.s.Primeira || 0) + (alvo.s.Segunda || 0), classificacaoDe(alvo.pe.id))}
            onOk={carregar}
            onFechar={() => setDetalhesId(null)}
          />
        );
      })()}
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

function ModalInspecao({ dados, session, pdfId, onPdf, onFechar, onOk }) {
  const { pe, disponivel } = dados;

  // Tamanhos do pedido (pela grade). Se o pedido não tem grade, cai no modo de dois totais.
  const porTam = gradePorTamanho(pe.grade);
  const tamanhos = TAMANHOS_GRADE.filter((t) => (porTam[t] || 0) > 0);
  Object.keys(porTam).forEach((t) => { if (!tamanhos.includes(t) && (porTam[t] || 0) > 0) tamanhos.push(t); });
  const temGrade = tamanhos.length > 0;

  // Padrão: tudo em 1ª qualidade (puxa a grade do pedido); 2ª começa zerada.
  const [g1, setG1] = useState(() => (temGrade ? Object.fromEntries(tamanhos.map((t) => [t, String(porTam[t] || 0)])) : {}));
  const [g2, setG2] = useState(() => (temGrade ? Object.fromEntries(tamanhos.map((t) => [t, "0"])) : {}));
  // Fallback (sem grade): dois totais simples, como antes.
  const [q1, setQ1] = useState(String(disponivel));
  const [q2, setQ2] = useState("0");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [notaFiscal, setNotaFiscal] = useState(pe.nota_fiscal || "");

  const somaObj = (o) => Object.values(o).reduce((a, v) => a + (parseInt(v, 10) || 0), 0);
  const n1 = temGrade ? somaObj(g1) : (parseInt(q1, 10) || 0);
  const n2 = temGrade ? somaObj(g2) : (parseInt(q2, 10) || 0);
  const soma = n1 + n2;
  const restante = disponivel - soma;
  const p1 = soma ? (n1 / soma) * 100 : 0;

  const setSize = (setter) => (t, val) => setter((o) => ({ ...o, [t]: val }));
  const limpaGrade = (o) => {
    const out = {};
    Object.entries(o).forEach(([t, v]) => { const n = parseInt(v, 10) || 0; if (n > 0) out[t] = n; });
    return Object.keys(out).length ? out : null;
  };

  async function confirmar() {
    setErro(null);
    if (soma < 1) return setErro("Informe ao menos 1 peça.");
    if (soma > disponivel) return setErro(`Só há ${disponivel} peças em espera.`);
    setSalvando(true);
    try {
      if (n1 > 0) {
        const r = await supabase.from("movimentos").insert({ pedido_id: pe.id, de_local: "Estoque", para_local: "Primeira", qtd: n1, grade: temGrade ? limpaGrade(g1) : null, usuario_id: session.user.id });
        if (r.error) throw r.error;
      }
      if (n2 > 0) {
        const r = await supabase.from("movimentos").insert({ pedido_id: pe.id, de_local: "Estoque", para_local: "Segunda", qtd: n2, grade: temGrade ? limpaGrade(g2) : null, usuario_id: session.user.id });
        if (r.error) throw r.error;
      }
      // Nota fiscal (opcional) — guardada no pedido.
      if ((notaFiscal.trim() || "") !== (pe.nota_fiscal || "")) {
        const rnf = await supabase.from("pedidos").update({ nota_fiscal: notaFiscal.trim() || null }).eq("id", pe.id);
        if (rnf.error) throw rnf.error;
      }
      onOk();
    } catch (e) {
      setErro(e.message || "Erro ao salvar.");
      setSalvando(false);
    }
  }

  const gradeVisivel = pe.grade && normalizarGrade(pe.grade).length > 0;
  const celI = { border: "1px solid var(--border)", padding: "4px 6px", textAlign: "center", fontSize: 11.5, whiteSpace: "nowrap" };
  const thI = { ...celI, background: "var(--surface-2)", fontSize: 9.5, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".3px" };
  const celInputI = { border: "1px solid var(--border)", padding: 0, textAlign: "center", whiteSpace: "nowrap" };
  const inpCelI = { width: "100%", boxSizing: "border-box", border: "none", background: "transparent", textAlign: "center", fontSize: 12.5, padding: "6px 4px", color: "var(--text)", fontFamily: "inherit", outline: "none" };

  return (
    <Overlay onFechar={onFechar}
      titulo={`Inspecionar — ${pe.referencia}`}
      subtitulo={`${disponivel} peças aguardando classificação`}
      acaoTopo={onPdf && (
        <button onClick={() => onPdf(pe, disponivel)} disabled={pdfId === pe.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
          <FileText size={14} style={{ color: "var(--accent)" }} /> {pdfId === pe.id ? "…" : "PDF"}
        </button>
      )}
      rodape={
        <>
          {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "0 0 8px" }}>{erro}</p>}
          <div style={{ fontSize: 12, color: restante < 0 ? "var(--danger)" : "var(--text-3)", marginBottom: 10 }}>
            {soma} de {disponivel} classificadas · {restante >= 0 ? `${restante} ficam em espera` : "passou do disponível"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={confirmar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Confirmar"}</button>
          </div>
        </>
      }>
      <Bloco>
        <label style={lbl}>Número da nota fiscal <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opcional)</span></label>
        <input value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} placeholder="Ex.: 12345" style={{ ...inp, marginBottom: gradeVisivel ? 16 : 0 }} />
        {gradeVisivel && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>Grade do pedido</div>
            <GradeTabela grade={pe.grade} margem="0" />
          </>
        )}
      </Bloco>

      <Bloco>
        {temGrade ? (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>Enviar para 1ª / 2ª qualidade</div>
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 9 }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ ...thI, textAlign: "left", minWidth: 96 }}>QUALIDADE</th>
                    {tamanhos.map((t) => <th key={t} style={thI}>{t}</th>)}
                    <th style={{ ...thI, background: "var(--surface-3)", color: "var(--text-2)" }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...celI, textAlign: "left", fontWeight: 700, color: "var(--success)" }}>1ª qualidade</td>
                    {tamanhos.map((t) => <td key={t} style={celInputI}><input type="number" min="0" value={g1[t] ?? "0"} onChange={(e) => setSize(setG1)(t, e.target.value)} style={{ ...inpCelI, color: "var(--success)", fontWeight: 600 }} /></td>)}
                    <td style={{ ...celI, background: "var(--surface-2)", fontWeight: 800, color: "var(--success)" }}>{n1}</td>
                  </tr>
                  <tr>
                    <td style={{ ...celI, textAlign: "left", fontWeight: 700, color: "var(--orange)" }}>2ª qualidade</td>
                    {tamanhos.map((t) => <td key={t} style={celInputI}><input type="number" min="0" value={g2[t] ?? "0"} onChange={(e) => setSize(setG2)(t, e.target.value)} style={{ ...inpCelI, color: "var(--orange)", fontWeight: 600 }} /></td>)}
                    <td style={{ ...celI, background: "var(--surface-2)", fontWeight: 800, color: "var(--orange)" }}>{n2}</td>
                  </tr>
                  <tr>
                    <td style={{ ...celI, textAlign: "left", fontWeight: 700, background: "var(--surface-2)", color: "var(--text-2)" }}>TOTAL</td>
                    {tamanhos.map((t) => { const soma = (parseInt(g1[t], 10) || 0) + (parseInt(g2[t], 10) || 0); return <td key={t} style={{ ...celI, background: "var(--surface-2)", fontWeight: 700, color: soma ? "var(--accent)" : "var(--text-3)" }}>{soma || "·"}</td>; })}
                    <td style={{ ...celI, background: "var(--accent-bg)", fontWeight: 800, color: "var(--accent)" }}>{n1 + n2}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
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
        )}
        {soma > 0 && (
          <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", background: "var(--surface-3)", marginTop: 12 }}>
            {n1 > 0 && <div style={{ width: `${p1}%`, background: "var(--success)" }} />}
            {n2 > 0 && <div style={{ width: `${100 - p1}%`, background: "var(--orange)" }} />}
          </div>
        )}
      </Bloco>
    </Overlay>
  );
}

// Gaveta lateral "Ver detalhes" do card Em estoque: resumo, classificação e ações.
// Gaveta "Ver detalhes" do card Em estoque: resumo da inspeção + grade de
// faturamento editável (a própria tela), com PDF no topo e Dar baixa no rodapé.
function ModalDetalhes({ pe, s, cls, nomeCliente, podeBaixar, pdfId, session, onPdf, onFechar, onOk }) {
  const d1 = s.Primeira || 0;
  const d2 = s.Segunda || 0;

  const salva = Array.isArray(pe.grade_faturamento) && pe.grade_faturamento.length
    ? pe.grade_faturamento
    : [{ variante: "", qtds: {} }];
  const [linhas, setLinhas] = useState(salva.map((l) => ({ variante: l.variante || "", qtds: { ...(l.qtds || {}) } })));
  const [peso, setPeso] = useState(pe.fat_peso || "");
  const [volume, setVolume] = useState(pe.fat_volume || "");
  const [obs, setObs] = useState(pe.fat_obs || "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState(null);

  // Baixa inline (sem abrir outra gaveta).
  const [baixaAberta, setBaixaAberta] = useState(false);
  const [bq1, setBq1] = useState(String(d1));
  const [bq2, setBq2] = useState(String(d2));
  const [bmotivo, setBmotivo] = useState("");
  const [baixando, setBaixando] = useState(false);
  const [berro, setBerro] = useState(null);
  const bn1 = Math.max(0, parseInt(bq1, 10) || 0);
  const bn2 = Math.max(0, parseInt(bq2, 10) || 0);
  const totalBaixa = bn1 + bn2;

  const abrirBaixa = () => { setBq1(String(d1)); setBq2(String(d2)); setBmotivo(""); setBerro(null); setBaixaAberta(true); };

  async function confirmarBaixa() {
    setBerro(null);
    if (bn1 > d1) return setBerro(`Só há ${d1} peça(s) de 1ª qualidade.`);
    if (bn2 > d2) return setBerro(`Só há ${d2} peça(s) de 2ª qualidade.`);
    if (totalBaixa < 1) return setBerro("Informe ao menos 1 peça para dar baixa.");
    setBaixando(true);
    for (const [tipo, q] of [["Primeira", bn1], ["Segunda", bn2]]) {
      if (q < 1) continue;
      const { error } = await supabase.from("movimentos").insert({
        pedido_id: pe.id, de_local: tipo, para_local: "Saida", qtd: q,
        usuario_id: session.user.id, observacao: bmotivo.trim() || null,
      });
      if (error) { setBaixando(false); return setBerro(error.message); }
    }
    await arquivarSeConcluido(pe.id); // se foi a última peça sob gestão, o pedido é arquivado
    setBaixando(false);
    setBaixaAberta(false);
    onOk?.(); // recarrega; se concluído, a gaveta fecha sozinha (o pedido sai da lista)
  }

  const mudarQtd = (i, t, v) => { setSalvo(false); setLinhas((ls) => ls.map((l, j) => j === i ? { ...l, qtds: { ...l.qtds, [t]: v } } : l)); };
  const mudarVar = (i, v) => { setSalvo(false); setLinhas((ls) => ls.map((l, j) => j === i ? { ...l, variante: v } : l)); };
  const addLinha = () => setLinhas((ls) => [...ls, { variante: "", qtds: {} }]);
  const removerLinha = (i) => setLinhas((ls) => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls);
  const totalPorTam = (t) => linhas.reduce((a, l) => a + (parseInt(l.qtds[t], 10) || 0), 0);
  const totalGeral = linhas.reduce((a, l) => a + somaLinha(l), 0);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const limpa = linhas
      .map((l) => ({ variante: l.variante.trim(), qtds: Object.fromEntries(TAMANHOS_FAT.map((t) => [t, parseInt(l.qtds[t], 10) || 0]).filter(([, q]) => q > 0)) }))
      .filter((l) => l.variante || Object.keys(l.qtds).length);
    const { error } = await supabase.from("pedidos").update({
      grade_faturamento: limpa.length ? limpa : null,
      fat_peso: peso.trim() || null,
      fat_volume: volume.trim() || null,
      fat_obs: obs.trim() || null,
    }).eq("id", pe.id);
    setSalvando(false);
    if (error) return setErro(error.message);
    setSalvo(true);
    onOk?.(); // recarrega os dados; a gaveta continua aberta
  }

  const cel = { border: "1px solid var(--border)", padding: 0, textAlign: "center" };
  const inpCel = { width: "100%", border: "none", background: "transparent", textAlign: "center", fontSize: 12.5, padding: "6px 2px", color: "var(--text)", fontFamily: "inherit", outline: "none" };

  return (
    <Overlay onFechar={onFechar} largura={720}
      titulo={pe.referencia}
      subtitulo={
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-2)" }}>{nomeCliente(pe.cliente_id)}</span>
          {pe.marca && <span style={tag}>{pe.marca}</span>}
          {pe.nota_fiscal && <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)", background: "var(--surface)", borderRadius: 99, padding: "2px 8px" }}>NF {pe.nota_fiscal}</span>}
        </div>
      }
      acaoTopo={
        <button onClick={onPdf} disabled={pdfId === pe.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
          <FileText size={14} style={{ color: "var(--accent)" }} /> {pdfId === pe.id ? "…" : "PDF"}
        </button>
      }
      rodape={
      baixaAberta ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setBaixaAberta(false)} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
          <button onClick={confirmarBaixa} disabled={baixando || totalBaixa < 1} style={{ ...btnDanger, flex: 1, opacity: totalBaixa < 1 ? 0.55 : 1 }}>
            {baixando ? "Baixando…" : `Confirmar baixa de ${totalBaixa}`}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {podeBaixar && (
            <button onClick={abrirBaixa} style={{ ...btnDanger, width: "100%" }}><Trash2 size={14} /> Dar baixa</button>
          )}
          <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, width: "100%" }}>{salvando ? "Salvando…" : salvo ? "Grade salva ✓" : "Salvar grade de faturamento"}</button>
        </div>
      )
    }>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: "9px 12px", borderRadius: 9, background: "var(--success-bg)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".4px", color: "var(--success)" }}>1ª QUALIDADE</div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, color: d1 > 0 ? "var(--success)" : "var(--text-3)" }}>{d1}</div>
        </div>
        <div style={{ flex: 1, padding: "9px 12px", borderRadius: 9, background: "var(--orange-bg)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".4px", color: "var(--orange)" }}>2ª QUALIDADE</div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, color: d2 > 0 ? "var(--orange)" : "var(--text-3)" }}>{d2}</div>
        </div>
      </div>

      {baixaAberta && (
        <div style={{ border: "1px solid var(--danger)", background: "rgba(220,60,55,.05)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)", marginBottom: 3 }}>Dar baixa</div>
          <p style={{ fontSize: 12, color: "var(--text-2)", margin: "0 0 12px" }}>Quantas peças saem de cada qualidade. Baixando tudo, o pedido conclui e vai para o Histórico.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--success)", display: "inline-block", marginRight: 6 }} />1ª qualidade <span style={{ color: "var(--text-3)" }}>({d1} disp.)</span></label>
              <input type="number" min="0" max={d1} value={bq1} disabled={d1 === 0} onChange={(e) => setBq1(e.target.value)} style={{ ...inp, opacity: d1 === 0 ? 0.5 : 1 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}><span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--orange)", display: "inline-block", marginRight: 6 }} />2ª qualidade <span style={{ color: "var(--text-3)" }}>({d2} disp.)</span></label>
              <input type="number" min="0" max={d2} value={bq2} disabled={d2 === 0} onChange={(e) => setBq2(e.target.value)} style={{ ...inp, opacity: d2 === 0 ? 0.5 : 1 }} />
            </div>
          </div>
          <label style={{ ...lbl, marginTop: 12 }}>Motivo / destino (opcional)</label>
          <input value={bmotivo} onChange={(e) => setBmotivo(e.target.value)} placeholder="Venda, envio ao cliente, avaria…" style={inp} />
          {berro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "10px 0 0" }}>{berro}</p>}
        </div>
      )}

      {cls && <Bloco><TabelaClassificacao cls={cls} /></Bloco>}

      <Bloco>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".4px", margin: "0 0 8px" }}>Grade de faturamento</div>
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
        <div style={{ flex: 1 }}><label style={lbl}>Peso</label><input value={peso} onChange={(e) => { setSalvo(false); setPeso(e.target.value); }} style={inp} /></div>
        <div style={{ flex: 1 }}><label style={lbl}>Volume</label><input value={volume} onChange={(e) => { setSalvo(false); setVolume(e.target.value); }} placeholder="ex: 8 volumes" style={inp} /></div>
      </div>
      <label style={{ ...lbl, marginTop: 14 }}>Observações</label>
      <textarea value={obs} onChange={(e) => { setSalvo(false); setObs(e.target.value); }} rows={3} placeholder="ex: 1 pç p/ showroom, falta 2 pçs da oficina…" style={{ ...inp, resize: "vertical" }} />

      {erro && <p style={{ fontSize: 12, color: "var(--danger)", margin: "10px 0 0" }}>{erro}</p>}
      </Bloco>
    </Overlay>
  );
}

// Classificação por tamanho no mesmo estilo das outras grades do sistema:
// qualidades nas linhas, tamanhos nas colunas, com coluna e linha de TOTAL.
function TabelaClassificacao({ cls }) {
  const g1 = cls.primeira || {}, g2 = cls.segunda || {};
  const tams = TAMANHOS_GRADE.filter((t) => (g1[t] || 0) > 0 || (g2[t] || 0) > 0);
  [...Object.keys(g1), ...Object.keys(g2)].forEach((t) => { if (!tams.includes(t) && ((g1[t] || 0) > 0 || (g2[t] || 0) > 0)) tams.push(t); });
  if (tams.length === 0) return null;
  const t1 = tams.reduce((a, t) => a + (g1[t] || 0), 0);
  const t2 = tams.reduce((a, t) => a + (g2[t] || 0), 0);

  const cel = { border: "1px solid var(--border)", padding: "4px 6px", textAlign: "center", fontSize: 11.5, whiteSpace: "nowrap" };
  const th = { ...cel, background: "var(--surface-2)", fontSize: 9.5, fontWeight: 700, color: "var(--text-3)", letterSpacing: ".3px" };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>Classificação por tamanho</div>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 9 }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left", minWidth: 96 }}>QUALIDADE</th>
              {tams.map((t) => <th key={t} style={th}>{t}</th>)}
              <th style={{ ...th, background: "var(--surface-3)", color: "var(--text-2)" }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...cel, textAlign: "left", fontWeight: 700, color: "var(--success)" }}>1ª qualidade</td>
              {tams.map((t) => { const q = g1[t] || 0; return <td key={t} style={{ ...cel, color: q ? "var(--success)" : "var(--text-3)", fontWeight: q ? 700 : 400 }}>{q || "·"}</td>; })}
              <td style={{ ...cel, background: "var(--surface-2)", fontWeight: 700, color: "var(--success)" }}>{t1}</td>
            </tr>
            <tr>
              <td style={{ ...cel, textAlign: "left", fontWeight: 700, color: "var(--orange)" }}>2ª qualidade</td>
              {tams.map((t) => { const q = g2[t] || 0; return <td key={t} style={{ ...cel, color: q ? "var(--orange)" : "var(--text-3)", fontWeight: q ? 700 : 400 }}>{q || "·"}</td>; })}
              <td style={{ ...cel, background: "var(--surface-2)", fontWeight: 700, color: "var(--orange)" }}>{t2}</td>
            </tr>
            <tr>
              <td style={{ ...cel, textAlign: "left", fontWeight: 700, background: "var(--surface-2)", color: "var(--text-2)" }}>TOTAL</td>
              {tams.map((t) => { const soma = (g1[t] || 0) + (g2[t] || 0); return <td key={t} style={{ ...cel, fontWeight: 700, background: "var(--surface-2)", color: soma ? "var(--accent)" : "var(--text-3)" }}>{soma || "·"}</td>; })}
              <td style={{ ...cel, background: "var(--accent-bg)", color: "var(--accent)", fontWeight: 800 }}>{t1 + t2}</td>
            </tr>
          </tbody>
        </table>
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
const btnDanger = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--danger)", background: "var(--surface)", color: "var(--danger)", cursor: "pointer", transition: "background .15s" };

const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", fontSize: 13, fontWeight: 700, borderRadius: 9, border: "none", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", boxShadow: "var(--shadow-sm)", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
