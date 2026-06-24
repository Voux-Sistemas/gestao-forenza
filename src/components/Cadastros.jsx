import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { Plus, Pencil } from "lucide-react";

export default function Cadastros() {
  const [aba, setAba] = useState("clientes");
  return (
    <div style={{ padding: "20px 22px" }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 16px" }}>Cadastros</h2>
      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
        {[["clientes", "Clientes"], ["oficinas", "Oficinas"]].map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)} style={subTab(aba === id)}>{label}</button>
        ))}
      </div>
      {aba === "clientes" ? <Clientes /> : <Oficinas />}
    </div>
  );
}

function Clientes() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(false);
  const [selecionado, setSelecionado] = useState(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("clientes").select("*").order("nome");
    setLista(data || []);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function alternar(e, c) {
    e.stopPropagation();
    await supabase.from("clientes").update({ ativo: !c.ativo }).eq("id", c.id);
    carregar();
  }

  if (carregando) return <p style={txtVazio}>Carregando…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => setNovo(true)} style={btnPrimary}><Plus size={16} /> Novo cliente</button>
      </div>
      {lista.length === 0 ? <p style={txtVazio}>Nenhum cliente cadastrado.</p> : (
        <div style={tabela}>
          <div style={{ ...linha, ...cabecalho }}>
            <span style={{ flex: 2 }}>Nome</span>
            <span style={{ flex: 2 }}>Contato</span>
            <span style={{ flex: 1 }}>Status</span>
            <span style={{ width: 110, textAlign: "right" }}></span>
          </div>
          {lista.map((c) => (
            <div key={c.id} onClick={() => setSelecionado(c)} style={{ ...linha, cursor: "pointer" }}>
              <span style={{ flex: 2, fontWeight: 500 }}>{c.nome}</span>
              <span style={{ flex: 2, color: "var(--text-2)" }}>{c.contato || "—"}</span>
              <span style={{ flex: 1 }}><Badge ativo={c.ativo} /></span>
              <span style={{ width: 110, textAlign: "right" }}>
                <button onClick={(e) => alternar(e, c)} style={btnMini}>{c.ativo ? "Desativar" : "Ativar"}</button>
              </span>
            </div>
          ))}
        </div>
      )}
      {novo && <DetalheCliente registro={null} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); carregar(); }} />}
      {selecionado && <DetalheCliente registro={selecionado} onFechar={() => setSelecionado(null)} onSalvo={() => { setSelecionado(null); carregar(); }} />}
    </div>
  );
}

function Oficinas() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novo, setNovo] = useState(false);
  const [selecionado, setSelecionado] = useState(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("oficinas").select("*").order("nome_empresa");
    setLista(data || []);
    setCarregando(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function alternar(e, o) {
    e.stopPropagation();
    await supabase.from("oficinas").update({ ativo: !o.ativo }).eq("id", o.id);
    carregar();
  }

  if (carregando) return <p style={txtVazio}>Carregando…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => setNovo(true)} style={btnPrimary}><Plus size={16} /> Nova oficina</button>
      </div>
      {lista.length === 0 ? <p style={txtVazio}>Nenhuma oficina cadastrada.</p> : (
        <div style={tabela}>
          <div style={{ ...linha, ...cabecalho }}>
            <span style={{ flex: 2 }}>Empresa</span>
            <span style={{ flex: 1 }}>Cidade</span>
            <span style={{ flex: 1 }}>Telefone</span>
            <span style={{ flex: 1 }}>Pessoas</span>
            <span style={{ flex: 1 }}>Status</span>
            <span style={{ width: 110, textAlign: "right" }}></span>
          </div>
          {lista.map((o) => (
            <div key={o.id} onClick={() => setSelecionado(o)} style={{ ...linha, cursor: "pointer" }}>
              <span style={{ flex: 2, fontWeight: 500 }}>{o.nome_empresa}</span>
              <span style={{ flex: 1, color: "var(--text-2)" }}>{o.cidade || "—"}</span>
              <span style={{ flex: 1, color: "var(--text-2)" }}>{o.telefone || "—"}</span>
              <span style={{ flex: 1, color: "var(--text-2)" }}>{o.qtd_pessoas ?? "—"}</span>
              <span style={{ flex: 1 }}><Badge ativo={o.ativo} /></span>
              <span style={{ width: 110, textAlign: "right" }}>
                <button onClick={(e) => alternar(e, o)} style={btnMini}>{o.ativo ? "Desativar" : "Ativar"}</button>
              </span>
            </div>
          ))}
        </div>
      )}
      {novo && <DetalheOficina registro={null} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); carregar(); }} />}
      {selecionado && <DetalheOficina registro={selecionado} onFechar={() => setSelecionado(null)} onSalvo={() => { setSelecionado(null); carregar(); }} />}
    </div>
  );
}

function DetalheCliente({ registro, onFechar, onSalvo }) {
  const novo = !registro;
  const [editando, setEditando] = useState(novo);
  const [nome, setNome] = useState(registro?.nome || "");
  const [contato, setContato] = useState(registro?.contato || "");
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!nome.trim()) return setErro("Informe o nome do cliente.");
    setSalvando(true);
    const dados = { nome: nome.trim(), contato: contato.trim() || null };
    const resp = novo
      ? await supabase.from("clientes").insert(dados)
      : await supabase.from("clientes").update(dados).eq("id", registro.id);
    setSalvando(false);
    if (resp.error) return setErro(resp.error.message);
    onSalvo();
  }

  return (
    <Overlay onFechar={onFechar}>
      <div style={headerModal}>
        <h3 style={tituloModal}>{novo ? "Novo cliente" : registro.nome}</h3>
        {!novo && !editando && <button onClick={() => setEditando(true)} style={btnMini}><Pencil size={13} /> Editar</button>}
      </div>

      {editando ? (
        <>
          <label style={lbl}>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus style={inp} />
          <label style={{ ...lbl, marginTop: 14 }}>Contato</label>
          <input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="telefone, e-mail, responsável…" style={inp} />
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Campo rotulo="Contato" valor={registro.contato} />
          <Campo rotulo="Status" valor={registro.ativo ? "Ativo" : "Inativo"} />
        </div>
      )}

      {erro && <p style={erroTxt}>{erro}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        {editando ? (
          <>
            <button onClick={novo ? onFechar : () => setEditando(false)} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
          </>
        ) : (
          <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Fechar</button>
        )}
      </div>
    </Overlay>
  );
}

function DetalheOficina({ registro, onFechar, onSalvo }) {
  const novo = !registro;
  const [editando, setEditando] = useState(novo);
  const [campos, setCampos] = useState({
    nome_empresa: registro?.nome_empresa || "",
    cidade: registro?.cidade || "",
    telefone: registro?.telefone || "",
    documento: registro?.documento || "",
    maquinario: registro?.maquinario || "",
    qtd_pessoas: registro?.qtd_pessoas != null ? String(registro.qtd_pessoas) : "",
  });
  const set = (k) => (e) => setCampos((c) => ({ ...c, [k]: e.target.value }));
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!campos.nome_empresa.trim()) return setErro("Informe o nome da empresa.");
    setSalvando(true);
    const dados = {
      nome_empresa: campos.nome_empresa.trim(),
      cidade: campos.cidade.trim() || null,
      telefone: campos.telefone.trim() || null,
      documento: campos.documento.trim() || null,
      maquinario: campos.maquinario.trim() || null,
      qtd_pessoas: campos.qtd_pessoas ? parseInt(campos.qtd_pessoas, 10) : null,
    };
    const resp = novo
      ? await supabase.from("oficinas").insert(dados)
      : await supabase.from("oficinas").update(dados).eq("id", registro.id);
    setSalvando(false);
    if (resp.error) return setErro(resp.error.message);
    onSalvo();
  }

  return (
    <Overlay onFechar={onFechar}>
      <div style={headerModal}>
        <h3 style={tituloModal}>{novo ? "Nova oficina" : registro.nome_empresa}</h3>
        {!novo && !editando && <button onClick={() => setEditando(true)} style={btnMini}><Pencil size={13} /> Editar</button>}
      </div>

      {editando ? (
        <>
          <label style={lbl}>Nome da empresa</label>
          <input value={campos.nome_empresa} onChange={set("nome_empresa")} autoFocus style={inp} />
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1 }}><label style={lbl}>Cidade</label><input value={campos.cidade} onChange={set("cidade")} style={inp} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Telefone</label><input value={campos.telefone} onChange={set("telefone")} style={inp} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1 }}><label style={lbl}>Documento (CNPJ/CPF)</label><input value={campos.documento} onChange={set("documento")} style={inp} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Qtd. de pessoas</label><input type="number" min="0" value={campos.qtd_pessoas} onChange={set("qtd_pessoas")} style={inp} /></div>
          </div>
          <label style={{ ...lbl, marginTop: 14 }}>Maquinário</label>
          <input value={campos.maquinario} onChange={set("maquinario")} placeholder="ex: 5 retas, 2 overlocks…" style={inp} />
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 24 }}>
            <Campo rotulo="Cidade" valor={registro.cidade} />
            <Campo rotulo="Telefone" valor={registro.telefone} />
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <Campo rotulo="Documento" valor={registro.documento} />
            <Campo rotulo="Qtd. de pessoas" valor={registro.qtd_pessoas != null ? String(registro.qtd_pessoas) : null} />
          </div>
          <Campo rotulo="Maquinário" valor={registro.maquinario} />
          <Campo rotulo="Status" valor={registro.ativo ? "Ativo" : "Inativo"} />
        </div>
      )}

      {erro && <p style={erroTxt}>{erro}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        {editando ? (
          <>
            <button onClick={novo ? onFechar : () => setEditando(false)} style={{ ...btnGhost, flex: 1 }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={{ ...btnPrimary, flex: 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
          </>
        ) : (
          <button onClick={onFechar} style={{ ...btnGhost, flex: 1 }}>Fechar</button>
        )}
      </div>
    </Overlay>
  );
}

function Campo({ rotulo, valor }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>{rotulo}</div>
      <div style={{ fontSize: 14, color: "var(--text)" }}>{valor || "—"}</div>
    </div>
  );
}

function Badge({ ativo }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
      background: ativo ? "var(--success-bg)" : "var(--surface-3)",
      color: ativo ? "var(--success)" : "var(--text-3)",
    }}>{ativo ? "Ativo" : "Inativo"}</span>
  );
}

function Overlay({ children, onFechar }) {
  return (
    <div onClick={onFechar} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22 }}>
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
const cabecalho = { background: "var(--surface-2)", fontSize: 12, color: "var(--text-2)", fontWeight: 600, cursor: "default" };
const txtVazio = { fontSize: 13, color: "var(--text-3)", padding: "16px 2px" };
const headerModal = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 };
const tituloModal = { fontSize: 16, fontWeight: 600, margin: 0 };
const erroTxt = { fontSize: 12, color: "var(--danger)", margin: "12px 0 0" };
const inp = { width: "100%", padding: "9px 11px", fontSize: 14, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };
const lbl = { fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 5 };
const btnPrimary = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
const btnMini = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", cursor: "pointer" };
