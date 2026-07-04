import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";
import { LogOut, Moon, Sun, LayoutGrid, Users, Bell, Factory, Package, Inbox, Home, Receipt, Archive, Menu, X } from "lucide-react";
import Logo from "./Logo.jsx";
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
import Historico from "./Historico.jsx";

const PAPEL_LABEL = {
  funcionario: "Funcionário", chefe_setor: "Chefe de setor",
  chefe_geral: "Chefe geral", master: "Master", cliente: "Cliente",
};
const iconBtn = { border: "1px solid var(--border)", borderRadius: 8, padding: 8, color: "var(--text-2)", background: "none", display: "inline-flex", cursor: "pointer" };

// Menu superior: as páginas da operação (Quadro também mora na lateral).
const ITENS_TOPO = [
  { id: "triagem", label: "Pilotagem", icon: Inbox },
  { id: "quadro", label: "Quadro", icon: LayoutGrid },
  { id: "oficinas", label: "Oficinas", icon: Factory },
  { id: "estoque", label: "Estoque", icon: Package },
];
// Lateral premium: acesso fixo + sessão.
const ITENS_LATERAL = [
  { id: "inicio", label: "Início", icon: Home },
  { id: "atrasos", label: "Notificações", icon: Bell },
  { id: "contas", label: "Contas a Pagar", icon: Receipt },
  { id: "historico", label: "Histórico", icon: Archive },
];

// Paleta da lateral — família do verde da marca.
const VERDE = {
  fundo: "linear-gradient(180deg, #0A4A3C 0%, #04342C 55%, #02231E 100%)",
  ativoBg: "#9FE1CB", ativoTexto: "#04342C",
  texto: "#CFEBE0", apagado: "#5DCAA5",
  divisa: "rgba(159,225,203,0.18)", sair: "#F09595",
};

export default function Shell({ session }) {
  const [perfil, setPerfil] = useState(null);
  const [tema, setTema] = useState("light");
  const [pagina, setPagina] = useState("inicio");
  const [lateralAberta, setLateralAberta] = useState(() => localStorage.getItem("forenza-lateral") === "1");

  useEffect(() => {
    supabase.from("perfis").select("nome, papel, setor, cliente_id").eq("id", session.user.id).single()
      .then(({ data, error }) => { if (!error) setPerfil(data); });
  }, [session]);

  useEffect(() => { document.documentElement.setAttribute("data-theme", tema); }, [tema]);
  useEffect(() => { localStorage.setItem("forenza-lateral", lateralAberta ? "1" : "0"); }, [lateralAberta]);

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
    if (pagina === "historico" && podeAdministrar) return <Historico />;
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

  const botaoTema = (
    <button className="tap" onClick={() => setTema((t) => (t === "light" ? "dark" : "light"))} aria-label="Mudar tema" style={iconBtn}>
      {tema === "light" ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );

  // Funcionários e clientes não navegam: cabeçalho simples, sem menus.
  if (!podeAdministrar) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 22px", borderBottom: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-sm)" }}>
          <Logo size={32} fonte={16} legenda="Gestão de produção" />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {chipUsuario}
            {botaoTema}
            <button className="tap" onClick={() => supabase.auth.signOut()} aria-label="Sair" style={iconBtn}><LogOut size={16} /></button>
          </div>
        </header>
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{conteudo()}</main>
      </div>
    );
  }

  const itemLateral = ({ id, label, icon: Icone }, extras = {}) => {
    const ativo = pagina === id;
    return (
      <button key={id} onClick={extras.onClick || (() => setPagina(id))} title={!lateralAberta ? label : undefined} aria-label={label} style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%",
        padding: lateralAberta ? "10px 12px" : "10px 0", justifyContent: lateralAberta ? "flex-start" : "center",
        fontSize: 13, fontWeight: 600, letterSpacing: ".2px", borderRadius: 10, border: "none", cursor: "pointer", whiteSpace: "nowrap",
        color: extras.cor || (ativo ? VERDE.ativoTexto : VERDE.texto),
        background: ativo && !extras.cor ? VERDE.ativoBg : "transparent",
      }}>
        <Icone size={17} style={{ flexShrink: 0 }} /> {lateralAberta && label}
      </button>
    );
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "stretch", overflow: "hidden" }}>
        {/* ── Lateral premium em altura total (verde da marca) ── */}
        <aside style={{ width: lateralAberta ? 200 : 58, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4, background: VERDE.fundo, padding: "12px 9px", transition: "width .18s ease", overflowY: "auto", overflowX: "hidden" }}>
          {itemLateral({ id: "_toggle", label: lateralAberta ? "Recolher" : "Expandir menu", icon: lateralAberta ? X : Menu }, { onClick: () => setLateralAberta((a) => !a), cor: VERDE.apagado })}
          <div style={{ height: 1, background: VERDE.divisa, margin: "5px 3px 8px", flexShrink: 0 }} />
          {ITENS_LATERAL.map((i) => itemLateral(i))}
          <div style={{ marginTop: "auto", flexShrink: 0 }}>
            <div style={{ height: 1, background: VERDE.divisa, margin: "0 3px 6px" }} />
            {itemLateral({ id: "cadastros", label: "Cadastros", icon: Users })}
            {itemLateral({ id: "_sair", label: "Sair", icon: LogOut }, { onClick: () => supabase.auth.signOut(), cor: VERDE.sair })}
            {lateralAberta && <div style={{ fontSize: 10.5, color: VERDE.apagado, letterSpacing: ".8px", padding: "4px 12px 2px" }}>FORENZA · {new Date().getFullYear()}</div>}
          </div>
        </aside>

      {/* ── Coluna principal: faixa da logo + menu de páginas + conteúdo ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      {/* ── Faixa da logo (ao lado da lateral) ── */}
      <header style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 22px", borderBottom: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-sm)", zIndex: 30 }}>
        <Logo size={32} fonte={16} legenda="Gestão de produção" />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {chipUsuario}
          {botaoTema}
        </div>
      </header>

          <nav style={{ flexShrink: 0, display: "flex", gap: 4, padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface)", overflowX: "auto" }}>
            {ITENS_TOPO.map((item) => {
              const Icone = item.icon;
              const ativo = pagina === item.id;
              return (
                <button key={item.id} className={ativo ? "" : "tap"} onClick={() => setPagina(item.id)} style={{
                  display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", borderRadius: 9,
                  border: "none", cursor: "pointer", color: ativo ? "var(--accent)" : "var(--text-2)",
                  background: ativo ? "var(--accent-bg)" : "transparent",
                }}>
                  <Icone size={15} /> {item.label}
                </button>
              );
            })}
          </nav>
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{conteudo()}</main>
      </div>
    </div>
  );
}
