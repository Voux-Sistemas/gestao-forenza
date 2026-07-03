import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { LogOut, Moon, Sun, LayoutGrid, Users, AlertTriangle, Factory, Package, Inbox, LayoutDashboard } from "lucide-react";
import Logo from "./Logo.jsx";
import Dashboard from "./Dashboard.jsx";
import Quadro from "./Quadro.jsx";
import ControleOficinas from "./ControleOficinas.jsx";
import Cadastros from "./Cadastros.jsx";
import Atrasos from "./Atrasos.jsx";
import Estoque from "./Estoque.jsx";
import Triagem from "./Triagem.jsx";
import Portal from "./Portal.jsx";

const PAPEL_LABEL = {
  funcionario: "Funcionário", chefe_setor: "Chefe de setor",
  chefe_geral: "Chefe geral", master: "Master", cliente: "Cliente",
};
const iconBtn = { border: "1px solid var(--border)", borderRadius: 8, padding: 8, color: "var(--text-2)", background: "none", display: "inline-flex" };

export default function Shell({ session }) {
  const [perfil, setPerfil] = useState(null);
  const [tema, setTema] = useState("light");
  const [pagina, setPagina] = useState("inicio");

  useEffect(() => {
    supabase.from("perfis").select("nome, papel, setor, cliente_id").eq("id", session.user.id).single()
      .then(({ data, error }) => { if (!error) setPerfil(data); });
  }, [session]);

  useEffect(() => { document.documentElement.setAttribute("data-theme", tema); }, [tema]);

  const subtitulo = perfil ? [PAPEL_LABEL[perfil.papel], perfil.setor].filter(Boolean).join(" · ") : "carregando…";
  const podeAdministrar = ["master", "chefe_geral"].includes(perfil?.papel);
  const iniciais = (perfil?.nome || "U").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  // Ordem segue o fluxo real da fábrica: entrada → produção → saída, depois monitoramento e admin.
  const navItens = [
    { id: "inicio", label: "Início", icon: LayoutDashboard },
    { id: "triagem", label: "Pilotagem", icon: Inbox },
    { id: "quadro", label: "Quadro", icon: LayoutGrid },
    { id: "oficinas", label: "Oficinas", icon: Factory },
    { id: "estoque", label: "Estoque", icon: Package },
    { id: "atrasos", label: "Alertas", icon: AlertTriangle },
    { id: "cadastros", label: "Cadastros", icon: Users, separado: true },
  ];

  function conteudo() {
    if (!perfil) return <div style={{ padding: 28, color: "var(--text-2)" }}>Carregando…</div>;
    if (perfil.papel === "cliente") return <Portal session={session} perfil={perfil} />;
    if (pagina === "inicio" && podeAdministrar) return <Dashboard perfil={perfil} onNavegar={setPagina} />;
    if (pagina === "cadastros" && podeAdministrar) return <Cadastros />;
    if (pagina === "atrasos" && podeAdministrar) return <Atrasos onNavegar={setPagina} />;
    if (pagina === "estoque" && podeAdministrar) return <Estoque session={session} perfil={perfil} />;
    if (pagina === "triagem" && podeAdministrar) return <Triagem />;
    if (pagina === "oficinas" && podeAdministrar) return <ControleOficinas session={session} perfil={perfil} />;
    return <Quadro session={session} perfil={perfil} />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 30 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 22px", borderBottom: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}>
          <Logo size={32} fonte={16} legenda="Gestão de produção" />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 5px 4px 12px", borderRadius: 99, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{perfil?.nome || "Usuário"}</div>
                <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.2 }}>{subtitulo}</div>
              </div>
              <div style={{ width: 32, height: 32, borderRadius: 99, background: "var(--accent-bg)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{iniciais}</div>
            </div>
            <button className="tap" onClick={() => setTema((t) => (t === "light" ? "dark" : "light"))} aria-label="Mudar tema" style={iconBtn}>
              {tema === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button className="tap" onClick={() => supabase.auth.signOut()} aria-label="Sair" style={iconBtn}><LogOut size={16} /></button>
          </div>
        </header>

        {podeAdministrar && (
          <nav style={{ display: "flex", gap: 4, padding: "8px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface)", overflowX: "auto" }}>
            {navItens.map((item) => {
              const Icone = item.icon;
              const ativo = pagina === item.id;
              return (
                <React.Fragment key={item.id}>
                  {item.separado && <span aria-hidden="true" style={{ width: 1, alignSelf: "stretch", margin: "6px 6px", background: "var(--border)", flexShrink: 0 }} />}
                  <button className={ativo ? "" : "tap"} onClick={() => setPagina(item.id)} style={{
                    display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", borderRadius: 9,
                    border: "none", cursor: "pointer", color: ativo ? "var(--accent)" : "var(--text-2)",
                    background: ativo ? "var(--accent-bg)" : "transparent",
                  }}>
                    <Icone size={15} /> {item.label}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        )}
      </div>

      <main style={{ flex: 1, minWidth: 0 }}>{conteudo()}</main>
    </div>
  );
}
