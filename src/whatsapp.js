// Monta um link "click-to-chat" oficial do WhatsApp (wa.me).
// Aceita o número em qualquer formato — "(11) 98888-7777", "11988887777" etc. —
// e normaliza para o padrão internacional com o 55 do Brasil.
export function linkWhatsApp(numero, mensagem) {
  if (!numero) return null;
  let digitos = String(numero).replace(/\D/g, "");
  if (!digitos) return null;
  digitos = digitos.replace(/^0+/, "");           // remove zeros à esquerda (0xx)
  if (!digitos.startsWith("55")) digitos = "55" + digitos; // DDI do Brasil, se faltar
  if (digitos.length < 12) return null;           // 55 + DDD + número = mínimo 12 dígitos
  const texto = mensagem ? `?text=${encodeURIComponent(mensagem)}` : "";
  return `https://wa.me/${digitos}${texto}`;
}
