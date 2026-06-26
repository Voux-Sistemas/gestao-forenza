// Comprime uma imagem no navegador antes de subir.
// Redimensiona para no máximo `maxLado` px no maior lado e salva como JPEG.
// Se algo falhar ou não ajudar, devolve o arquivo original.
export async function comprimirImagem(file, maxLado = 1280, qualidade = 0.7) {
  if (!file || !file.type || !file.type.startsWith("image/")) return file;
  try {
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });

    let width = img.width;
    let height = img.height;
    if (width > maxLado || height > maxLado) {
      if (width >= height) {
        height = Math.round((height * maxLado) / width);
        width = maxLado;
      } else {
        width = Math.round((width * maxLado) / height);
        height = maxLado;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", qualidade));
    if (!blob || blob.size >= file.size) return file;

    const nome = (file.name || "imagem").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
