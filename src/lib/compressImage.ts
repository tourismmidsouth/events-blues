// Client-side image compression using the browser's built-in Canvas API —
// no external service or paid API involved. Downscales large dimensions and
// re-encodes as JPEG at decreasing quality until the file fits under
// targetBytes, so a submitter's oversized photo gets shrunk automatically
// instead of failing at Vercel's request body limit. Returns the original
// file unchanged if it's already small enough, or if compression can't get
// it under the target (caller should still validate size after calling this).
const MAX_DIMENSION = 2400;
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image for compression."));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function compressImageIfNeeded(file: File, targetBytes: number): Promise<File> {
  if (file.size <= targetBytes) return file;

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    // Not something the browser can decode into a canvas (shouldn't happen
    // given the accept="image/jpeg,image/png,image/webp" restriction, but
    // fail safe by handing back the original — server-side validation is
    // still the source of truth).
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let best: Blob | null = null;
  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, quality);
    if (!blob) continue;
    best = blob;
    if (blob.size <= targetBytes) break;
  }

  if (!best) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([best], newName, { type: "image/jpeg" });
}
