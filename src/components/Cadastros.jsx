import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient.js";
import { Plus, Pencil, Eye } from "lucide-react";

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
            <span style={{ width: 150, textAlign: "right" }}></span>
          </div>
          {lista.map((c) => (
            <div key={c.id} onClick={() => setSelecionado(c)} style={{ ...linha, cursor: "pointer" }}>
              <span style={{ flex: 2, fontWeight: 500 }}>{c.nome}</span>
              <span style={{ flex: 2, color: "var(--text-2)" }}>{c.contato || "—"}</span>
              <span style={{ flex: 1 }}><Badge ativo={c.ativo} /></span>
              <span style={{ width: 150, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); setSelecionado(c); }} style={btnIcon} aria-label="Ver detalhes"><Eye size={15} /></button>
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
            <span style={{ width: 150, textAlign: "right" }}></span>
          </div>
          {lista.map((o) => (
            <div key={o.id} onClick={() => setSelecionado(o)} style={{ ...linha, cursor: "pointer" }}>
              <span style={{ flex: 2, fontWeight: 500 }}>{o.nome_empresa}</span>
              <span style={{ flex: 1, color: "var(--text-2)" }}>{o.cidade || "—"}</span>
              <span style={{ flex: 1, color: "var(--text-2)"
