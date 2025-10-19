export async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // không revoke ngay; để component dùng xong hãy revoke nếu cần
  }
}

export async function cropToWebp(
  img: HTMLImageElement,
  area: { x: number; y: number; width: number; height: number },
  targetW: number,
  targetH: number,
  quality = 0.86
): Promise<{ blob: Blob; dataUrl: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;
  // vẽ phần crop vào canvas đích (scale về targetW x targetH)
  ctx.drawImage(
    img,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    targetW,
    targetH
  );
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), "image/webp", quality)
  );
  const dataUrl = canvas.toDataURL("image/webp", quality);
  return { blob, dataUrl };
}
