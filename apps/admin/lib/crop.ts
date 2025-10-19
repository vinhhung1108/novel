export async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await new Promise((res, rej) => {
      img.onload = () => res(null);
      img.onerror = rej;
    });
    return img;
  } finally {
    // không revoke ngay, vì Cropper còn dùng .src; sẽ được GC sau
  }
}

export async function cropToWebp(
  image: HTMLImageElement,
  area: { x: number; y: number; width: number; height: number },
  outW: number,
  outH: number,
  quality = 0.86
): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    outW,
    outH
  );
  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b!), "image/webp", quality)
  );
  const dataUrl = URL.createObjectURL(blob);
  return { blob, dataUrl };
}
