import type { SerializableCandidate } from "../../shared/types";

export type PreparedImage = {
  dataUrl: string;
  base64: string;
  mediaType: string;
};

const MAX_IMAGE_DIMENSION = 768;

function inferMimeType(blob: Blob): string {
  return blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function maybeDownscale(blob: Blob): Promise<Blob> {
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap !== "function") {
    return blob;
  }

  const bitmap = await createImageBitmap(blob);
  try {
    const largestEdge = Math.max(bitmap.width, bitmap.height);
    if (largestEdge <= MAX_IMAGE_DIMENSION) {
      return blob;
    }

    const scale = MAX_IMAGE_DIMENSION / largestEdge;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) {
      return blob;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
  } finally {
    bitmap.close();
  }
}

async function fetchPreparedImage(src: string): Promise<PreparedImage | null> {
  try {
    const response = await fetch(src, { credentials: "omit" });
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      return null;
    }

    const preparedBlob = await maybeDownscale(blob);
    const mediaType = inferMimeType(preparedBlob);
    const base64 = await blobToBase64(preparedBlob);

    return {
      mediaType,
      base64,
      dataUrl: `data:${mediaType};base64,${base64}`
    };
  } catch {
    return null;
  }
}

export async function prepareCandidateImages(candidate: SerializableCandidate): Promise<PreparedImage[]> {
  if (candidate.mediaType !== "image" || !candidate.images?.length) {
    return [];
  }

  const uniqueSources = Array.from(new Set(candidate.images.map((image) => image.src).filter(Boolean))).slice(0, 2);
  const prepared = await Promise.all(uniqueSources.map((src) => fetchPreparedImage(src)));
  return prepared.filter((image): image is PreparedImage => Boolean(image));
}
