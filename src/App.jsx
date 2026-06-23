import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import Login from "./components/Login.jsx";
import Shell from "./components/Shell.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (carregando) return <div className="center-screen">Carregando…</div>;
  if (!session) return <Login />;
  return <Shell session={session} />;
}
