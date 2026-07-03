import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { LogOut, Moon, Sun, LayoutGrid, Users, AlertTriangle, Factory, Package, Inbox, LayoutDashboard, Receipt } from "lucide-react";
import Logo, { MarcaForenza } from "./Logo.jsx";
import { rotuloLocal } from "../etapas.js";
import Dashboard from "./Dashboard.jsx";
import Quadro from "./Quadro.jsx";
import ControleOficinas from "./ControleOficinas.jsx";
import Cadastros from "./Cadastros.jsx";
import Atrasos from "./Atrasos.jsx";
import Estoque from "./Estoque.jsx";
import Triagem from "./Triagem.jsx";
import Portal from "./Portal.jsx";
import ContasAPagar from "./ContasAPagar.jsx";

const PAPEL_LABEL = {
  funcionario: "Funcionário", chefe_setor: "Chefe de setor",
  chefe_geral: "Chefe geral", master: "Master", cliente: "Cliente",
};
const iconBtn = { border: "1px solid var(--border)", borderRadius: 8, padding: 8, color: "var(--text-2)", background: "none", display: "inline-flex", cursor: "pointer" };

// Menu superior: navegação principal, na ordem do fluxo da fábrica.
const ITENS_TOPO = [
  { id: "inicio", label: "Início", icon: LayoutDashboard },
  { id: "triagem", label: "Pilotagem", icon: Inbox },
  { id: "quadro", label: "Quadro", icon: LayoutGrid },
  { id: "oficinas", label: "Oficinas", icon: Factory },
  { id: "estoque", label: "Estoque", icon: Package },
  { id: "atrasos", label: "Alertas", icon: AlertTriangle },
  { id: "contas", label: "Contas a Pagar", icon: Receipt },
];

export default function Shell({ session }) {
  const [perfil, setPerfil] = useState(null);
  const [tema, setTema] = useState("light");
  const [pagina, setPagina] = useState("inicio");

  useEffect(() => {
    supabase.from("perfis").select("nome, papel, setor, cliente_id").eq("id", session.user.id).single()
      .then(({ data, error }) => { if (!error) setPerfil(data); });
  }, [session]);

  useEffect(() => { document.documentElement.setAttribute("data-theme", tema); }, [tema]);

  const subtitulo = perfil ? [PAPEL_LABEL[perfil.papel], perfil.setor ? rotuloLocal(perfil.setor) : null].filter(Boolean).join(" · ") : "carregando…";
  const podeAdministrar = ["master", "chefe_geral"].includes(perfil?.papel);
  const iniciais = (perfil?.nome || "U").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  function conteudo() {
    if (!perfil) return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando…</div>;
    if (perfil.papel === "cliente") return <Portal session={session} perfil={perfil} />;
    if (pagina === "inicio" && podeAdministrar) return <Dashboard perfil={perfil} onNavegar={setPagina} />;
    if (pagina === "cadastros" && podeAdministrar) return <Cadastros />;
    if (pagina === "atrasos" && podeAdministrar) return <Atrasos onNavegar={setPagina} />;
    if (pagina === "estoque" && podeAdministrar) return <Estoque session={session} perfil={perfil} />;
    if (pagina === "triagem" && podeAdministrar) return <Triagem />;
    if (pagina === "oficinas" && podeAdministrar) return <ControleOficinas session={session} perfil={perfil} />;
    if (pagina === "contas" && podeAdministrar) return <ContasAPagar />;
    return <Quadro session={session} perfil={perfil} />;
  }

  const chipUsuario = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 5px 4px 12px", borderRadius: 99, border: "1px solid var(--border)", background: "var(--surface-2)", flexShrink: 0 }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{perfil?.nome || "Usuário"}</div>
        <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.2 }}>{subtitulo}</div>
      </div>
      <div style={{ width: 32, height: 32, borderRadius: 99, background: "var(--accent-bg)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{iniciais}</div>
    </div>
  );

  // Funcionários e clientes não navegam: cabeçalho simples, sem menus.
  if (!podeAdministrar) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 22px", borderBottom: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}>
          <Logo size={32} fonte={16} legenda="Gestão de produção" />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {chipUsuario}
            <button className="tap" onClick={() => setTema((t) => (t === "light" ? "dark" : "light"))} aria-label="Mudar tema" style={iconBtn}>
              {tema === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button className="tap" onClick={() => supabase.auth.signOut()} aria-label="Sair" style={iconBtn}><LogOut size={16} /></button>
          </div>
        </header>
        <main style={{ flex: 1, minWidth: 0 }}>{conteudo()}</main>
      </div>
    );
  }

  const btnTrilho = (ativo) => ({
    width: 42, height: 42, display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: 11, border: "none", cursor: "pointer",
    color: ativo ? "var(--accent)" : "var(--text-2)",
    background: ativo ? "var(--accent-bg)" : "transparent",
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "stretch" }}>
      {/* ── Trilho lateral mínimo: marca, Cadastros e ações de sessão ── */}
      <aside style={{ width: 62, flexShrink: 0, position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "var(--surface)", borderRight: "1px solid var(--border)", padding: "14px 0", zIndex: 40 }}>
        <div style={{ marginBottom: 14 }}><MarcaForenza size={30} /></div>
        <button className={pagina === "cadastros" ? "" : "tap"} onClick={() => setPagina("cadastros")} title="Cadastros" aria-label="Cadastros" style={btnTrilho(pagina === "cadastros")}>
          <Users size={18} />
        </button>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <button className="tap" onClick={() => setTema((t) => (t === "light" ? "dark" : "light"))} title="Mudar tema" aria-label="Mudar tema" style={btnTrilho(false)}>
            {tema === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button className="tap" onClick={() => supabase.auth.signOut()} title="Sair" aria-label="Sair" style={{ ...btnTrilho(false), color: "var(--danger)" }}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* ── Coluna principal: menu superior + conteúdo ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", gap: 10, padding: "9px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}>
          <nav style={{ display: "flex", gap: 4, overflowX: "auto", flex: 1, minWidth: 0 }}>
            {ITENS_TOPO.map((item) => {
              const Icone = item.icon;
              const ativo = pagina === item.id;
              return (
                <button key={item.id} className={ativo ? "" : "tap"} onClick={() => setPagina(item.id)} style={{
                  display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 13px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", borderRadius: 9,
                  border: "none", cursor: "pointer", color: ativo ? "var(--accent)" : "var(--text-2)",
                  background: ativo ? "var(--accent-bg)" : "transparent",
                }}>
                  <Icone size={15} /> {item.label}
                </button>
              );
            })}
          </nav>
          {chipUsuario}
        </header>
        <main style={{ flex: 1, minWidth: 0 }}>{conteudo()}</main>
      </div>
    </div>
  );
}
