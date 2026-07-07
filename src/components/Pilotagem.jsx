import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import Gaveta from "./Gaveta.jsx";
import { comprimirImagem } from "../comprimirImagem.js";
import GradeEditor, { limparGrade } from "./GradeEditor.jsx";
import { totalGrade } from "./GradeTabela.jsx";
import { X, Send, ImagePlus } from "lucide-react";

function dataHora(iso) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

const lblF = { fontSize: 11, color: "var(--text-2)", marginBottom: 4 };

export default function Pilotagem({ solicitacao, clientes, oficinas, onFechar, onMudou }) {
  const sol = solicitacao;
  const nomeCliente = clientes.find((c) => c.id === sol.cliente_id)?.nome || "—";

  const [comentarios, setComentarios] = useState([]);
  const [ficha, setFicha] = useState(() => {
    const f = sol.ficha || {};
    return {
      referencia: f.referencia || "",
      marca: f.marca || "",
      descricao: f.descricao || sol.descricao || "",
      data_recebimento: f.data_recebimento || "",
      produto_acabado: f.produto_acabado || "",
      mao_de_obra: f.mao_de_obra || "",
      prazo_piloto: f.prazo_piloto || "",
    };
  });
  const aprovada = sol.status === "aprovada";
  const setF = (k) => (e) => setFicha((c) => ({ ...c, [k]: e.target.value }));
  const [novoComent, setNovoComent] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvandoFicha, setSalvandoFicha] = useState(false);
  const [fichaSalva, setFichaSalva] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [imgComent, setImgComent] = useState(null);

  const carregarComentarios = useCallback(async () => {
    const { data } = await supabase.from("comentarios_pilotagem").select("*").eq("solicitacao_id", sol.id).order("id");
    setComentarios(data || []);
    setCarregando(false);
  }, [sol.id]);
  useEffect(() => { carregarComentarios(); }, [carregarComentarios]);

  useEffect(() => {
    const canal = supabase.channel("pilotagem-" + sol.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "comentarios_pilotagem", filter: `solicitacao_id=eq.${sol.id}` }, carregarComentarios)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [sol.id, carregarComentarios]);

  async function salvarFicha() {
    setSalvandoFicha(true);
    await supabase.from("solicitacoes").update({ ficha }).eq("id", sol.id);
    setSalvandoFicha(false);
    setFichaSalva(true);
    setTimeout(() => setFichaSalva(false), 2000);
  }

  async function enviarComentario() {
    if (!novoComent.trim() && !imgComent) return;
    setEnviando(true);
    let imagem_url = null;
    if (imgComent) {
      const ext = (imgComent.name.split(".").pop() || "jpg").toLowerCase();
      const path = `conv-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("referencias").upload(path, await comprimirImagem(imgComent));
      if (up.error) { setEnviando(false); window.alert("Falha ao enviar a imagem: " + up.error.message); return; }
      imagem_url = supabase.storage.from("referencias").getPublicUrl(path).data.publicUrl;
    }
    await supabase.from("comentarios_pilotagem").insert({ solicitacao_id: sol.id, autor: "fabrica", texto: novoComent.trim(), imagem_url });
    setNovoComent(""); setImgComent(null);
    setEnviando(false);
    carregarComentarios();
  }

  async function aprovarDireto() {
    if (gerando) return;
    if (!sol.quantidade || sol.quantidade < 1) {
      window.alert("Esta solicitação não tem quantidade definida. Peça a quantidade ao cliente antes de aprovar.");
      return;
    }
    setGerando(true);
    const { data: peds } = await supabase.from("pedidos").select("referencia");
    let max = 0;
    (peds || []).forEach((pp) => { const m = /^PED-(\d+)$/.exec(pp.referencia || ""); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    const refAuto = `PED-${String(max + 1).padStart(3, "0")}`;
    const ped = await supabase.from("pedidos").insert({
      cliente_id: sol.cliente_id,
      solicitacao_id: sol.id,
      referencia: (ficha.referencia && ficha.referencia.trim()) || refAuto,
      marca: ficha.marca && ficha.marca.trim() ? ficha.marca.trim() : null,
      total: sol.quantidade,
      prazo: sol.prazo_desejado || null,
    });
    if (ped.error) { setGerando(false); window.alert("Erro ao gerar pedido: " + ped.error.message); return; }
    await supabase.from("solicitacoes").update({ status: "aprovada", ficha }).eq("id", sol.id);
    setGerando(false);
    onMudou();
    onFechar();
  }

  return (
    <Gaveta onFechar={onFechar} largura={640} zIndex={105}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "18px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {sol.imagem_url && <img src={sol.imagem_url} alt="Referência" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />}
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Pilotagem — {nomeCliente}</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>{sol.descricao}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "18px 20px", overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-2)" }}>Ficha técnica</label>
              {!aprovada && (
                <button onClick={salvarFicha} disabled={salvandoFicha} style={btnMini}>
                  {salvandoFicha ? "Salvando…" : fichaSalva ? "Salvo ✓" : "Salvar ficha"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><div style={lblF}>Referência</div><input value={ficha.referencia} onChange={setF("referencia")} disabled={aprovada} style={inp} /></div>
                <div style={{ flex: 1 }}><div style={lblF}>Marca</div><input value={ficha.marca} onChange={setF("marca")} disabled={aprovada} style={inp} /></div>
              </div>
              <div><div style={lblF}>Descrição do produto</div><input value={ficha.descricao} onChange={setF("descricao")} disabled={aprovada} style={inp} /></div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}><div style={lblF}>Data de recebimento</div><input type="date" value={ficha.data_recebimento} onChange={setF("data_recebimento")} disabled={aprovada} style={inp} /></div>
                <div style={{ flex: 1 }}><div style={lblF}>Prazo da peça piloto</div><input type="date" value={ficha.prazo_piloto} onChange={setF("prazo_piloto")} disabled={aprovada} style={inp} /></div>
              </div>
              <div><div style={lblF}>Produto acabado</div><input value={ficha.produto_acabado} onChange={setF("produto_acabado")} disabled={aprovada} style={inp} /></div>
              <div><div style={lblF}>Mão de obra</div><input value={ficha.mao_de_obra} onChange={setF("mao_de_obra")} disabled={aprovada} style={inp} /></div>
            </div>
            {aprovada && <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>Solicitação aprovada — ficha em modo leitura.</p>}
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-2)", display: "block", marginBottom: 10 }}>Histórico de pilotagem</label>
            {carregando ? <p style={{ fontSize: 13, color: "var(--text-3)" }}>Carregando…</p> :
              comentarios.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-3)", margin: "0 0 12px" }}>Nenhum registro ainda. Escreva o primeiro abaixo.</p> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                  {comentarios.map((c) => {
                    const ehFabrica = c.autor === "fabrica";
                    return (
                      <div key={c.id} style={{ borderLeft: `3px solid ${ehFabrica ? "var(--accent)" : "var(--success)"}`, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: ehFabrica ? "var(--accent)" : "var(--success)" }}>{ehFabrica ? "Fábrica" : "Cliente"}</span>
                          <span style={{ fontSize: 11, color: "var(--text-3)" }}>{dataHora(c.criado_em)}</span>
                        </div>
                        {c.texto && <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.texto}</div>}
                        {c.imagem_url && <a href={c.imagem_url} target="_blank" rel="noreferrer"><img src={c.imagem_url} alt="anexo" style={{ marginTop: 6, maxWidth: "100%", maxHeight: 200, borderRadius: 8, display: "block", cursor: "pointer" }} /></a>}
                      </div>
                    );
                  })}
                </div>
              )}
            {imgComent && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "var(--text-2)" }}>
                <img src={URL.createObjectURL(imgComent)} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />
                <span style={{ flex: 1 }}>{imgComent.name}</span>
                <button onClick={() => setImgComent(null)} style={{ ...btnGhost, padding: "4px 8px" }}>Remover</button>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ ...btnGhost, cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "8px 12px" }}>
                <ImagePlus size={16} />
                <input type="file" accept="image/*" onChange={(e) => setImgComent(e.target.files[0] || null)} style={{ display: "none" }} />
              </label>
              <input value={novoComent} onChange={(e) => setNovoComent(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviarComentario(); }} placeholder="Escrever no histórico (ex: piloto enviado, ajuste pedido…)" style={{ ...inp, flex: 1 }} />
              <button onClick={enviarComentario} disabled={enviando} style={btnPrimary}><Send size={15} /></button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--border)" }}>
          <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Fechar</button>
          <button onClick={aprovarDireto} disabled={gerando} style={{ ...btnSuccess, flex: 1 }}>{gerando ? "Gerando pedido…" : "Aprovar piloto → gerar pedido"}</button>
        </div>
      

    </Gaveta>
  );
}

function ModalAprovar({ sol, oficinas, onFechar, onAprovado }) {
  const [referencia, setReferencia] = useState("");
  const [marca, setMarca] = useState("");
  const [total, setTotal] = useState(sol.quantidade ? String(sol.quantidade) : "");
  const [gradeVar, setGradeVar] = useState([{ variante: "", qtds: {} }]);
  const [prazo, setPrazo] = useState(sol.prazo_desejado || "");
  const [oficinaId, setOficinaId] = useState("");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const gradeFinal = limparGrade(gradeVar);
  const somaGrade = totalGrade(gradeFinal || []);
  const usaGrade = somaGrade > 0;

  async function confirmar() {
    setErro(null);
    if (!referencia.trim()) return setErro("Informe a referência do pedido.");
    const t = usaGrade ? somaGrade : parseInt(total, 10);
    if (!t || t < 1) return setErro("Preencha a grade de tamanhos ou informe o total de peças.");
    setSalvando(true);
    const ped = await supabase.from("pedidos").insert({
      cliente_id: sol.cliente_id,
      solicitacao_id: sol.id,
      oficina_id: oficinaId || null,
      referencia: referencia.trim(),
      marca: marca.trim() || null,
      total: t,
      grade: gradeFinal,
      prazo: prazo || null,
    });
    if (ped.error) { setSalvando(false); return setErro(ped.error.message); }
    await supabase.from("solicitacoes").update({ status: "aprovada", ficha }).eq("id", sol.id);
    setSalvando(false);
    onAprovado();
  }

  return (
    <Gaveta onFechar={onFechar} largura={680} zIndex={110}>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>Aprovar e gerar pedido</h3>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 16px" }}>Confirme os dados do pedido que vai entrar na produção.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Referência</label><input value={referencia} onChange={(e) => setReferencia(e.target.value)} autoFocus style={inp} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Marca</label><input value={marca} onChange={(e) => setMarca(e.target.value)} style={inp} /></div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Prazo</label><input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} style={inp} /></div>
        </div>

        <label style={{ ...lbl, marginTop: 14 }}>Grade de tamanhos</label>
        <GradeEditor valor={gradeVar} onChange={setGradeVar} />
        {!usaGrade && (
          <div style={{ marginTop: 10 }}>
            <label style={lbl}>Ou informe só o total de peças</label>
            <input type="number" min="1" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Total de peças" style={inp} />
          </div>
        )}
        <label style={{ ...lbl, marginTop: 14 }}>Oficina (opcional)</label>
        <select value={oficinaId} onChange={(e) => setOficinaId(e.target.value)} style={inp}>
          <option value="">Selecionar…</option>
          {oficinas.map((o) => <option key={o.id} value={o.id}>{o.nome_empresa}</option>)}
        </select>
        {erro && <p style={erroTxt}>{erro}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
          <button onClick={confirmar} disabled={salvando} style={{ ...btnSuccess, flex: 1 }}>{salvando ? "Gerando…" : "Gerar pedido"}</button>
        </div>
      
    </Gaveta>
  );
}


const inp = { width: "100%", padding: "9px 11px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "inherit" };
const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 };
const erroTxt = { fontSize: 12, color: "var(--danger)", margin: "12px 0 0" };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 13px", fontSize: 13, fontWeight: 700, borderRadius: 9, border: "none", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", color: "#fff", boxShadow: "var(--shadow-sm)", cursor: "pointer" };
const btnSuccess = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", fontSize: 13, fontWeight: 700, borderRadius: 9, border: "none", background: "var(--success)", color: "#fff", boxShadow: "var(--shadow-sm)", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnMini = { fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
