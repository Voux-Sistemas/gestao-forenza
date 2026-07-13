// Definição da ficha de aviamentos: itens fixos (mostrados sempre, como os processos)
// e as listas suspensas de cada campo.

// Larguras de elástico (0,03mm até 10cm).
export const LARGURAS_ELASTICO = [
  "0,03 mm", "0,05 mm", "1 cm", "1,5 cm", "2 cm", "2,5 cm", "3 cm", "3,5 cm",
  "4 cm", "4,5 cm", "5 cm", "5,5 cm", "6 cm", "6,5 cm", "7 cm", "7,5 cm",
  "8 cm", "8,5 cm", "9 cm", "9,5 cm", "10 cm",
];

// Tipos de zíper.
export const TIPOS_ZIPER = [
  "Nylon fixo", "Nylon destacável", "Invertido fixo", "Invertido destacável",
  "Metal fixo", "Metal destacável", "Vislon fixo", "Vislon destacável",
];

// Tamanhos de zíper (10 a 80 cm).
export const TAMANHOS_ZIPER = Array.from({ length: 15 }, (_, i) => `${10 + i * 5} cm`); // 10,15,...,80

// Tamanhos de etiqueta (mesmos tamanhos numerados da grade).
export const TAMANHOS_ETIQUETA = ["PP/36", "P/38", "M/40", "G/42", "GG/44", "EG/46", "EGG/48", "EXG/50"];

// Tipos de campo:
//   "largura+consumo"  → lista de largura + consumo + qtd enviada
//   "ziper"            → tipo (lista) + tamanho (lista) + qtd enviada
//   "consumo"          → consumo + qtd enviada
//   "tamanho+qtd"      → tamanho (lista) + qtd enviada
//   "qtd"              → só quantidade
export const ITENS_AVIAMENTO = [
  { id: "elastico", nome: "Elástico", tipo: "largura+consumo" },
  { id: "elastico_mexico", nome: "Elástico México", tipo: "largura+consumo" },
  { id: "rabo_de_rato", nome: "Rabo de rato", tipo: "consumo" },
  { id: "ziper", nome: "Zíper", tipo: "ziper" },
  { id: "etiqueta_composicao", nome: "Etiqueta composição", tipo: "qtd" },
  { id: "etiqueta_personalizada", nome: "Etiqueta personalizada", tipo: "qtd" },
  { id: "etiqueta_tamanhos", nome: "Etiqueta de tamanhos", tipo: "tamanho+qtd" },
  { id: "regulador", nome: "Regulador", tipo: "qtd" },
  { id: "colchete", nome: "Colchete", tipo: "qtd" },
  { id: "ilhos", nome: "Ilhós", tipo: "qtd" },
  { id: "botoes", nome: "Botões", tipo: "qtd" },
  { id: "cordao", nome: "Cordão", tipo: "qtd" },
  { id: "vivo_vies", nome: "Vivo/Viés", tipo: "consumo" },
  { id: "fita_cetim", nome: "Fita de cetim", tipo: "consumo" },
  { id: "gorgurao", nome: "Gorgurão", tipo: "consumo" },
  { id: "velcro", nome: "Velcro", tipo: "consumo" },
];

// Um item está "preenchido" se tem qualquer valor relevante.
export function itemPreenchido(dados) {
  if (!dados) return false;
  return ["largura", "tipo", "tamanho", "consumo", "qtd"].some((k) => dados[k] !== undefined && dados[k] !== "" && dados[k] !== null);
}

// Conta quantos itens da ficha foram preenchidos.
export function contarAviamentos(ficha) {
  if (!ficha) return 0;
  return ITENS_AVIAMENTO.filter((it) => itemPreenchido(ficha[it.id])).length;
}
