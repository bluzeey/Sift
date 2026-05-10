import type { CandidateImage, CandidateMediaType } from "../../shared/types";
import { readNodeText, isElementVisible } from "./textExtractor";

export type ExtractedMedia = {
  mediaType: CandidateMediaType;
  images: CandidateImage[];
  mediaSummary: string;
};

type MediaExtractionOptions = {
  ignoredSelector?: string;
  imageSelector?: string;
  videoSelector?: string;
  maxImages?: number;
  minWidth?: number;
  minHeight?: number;
};

const UI_IMAGE_PATTERN = /avatar|profile|logo|icon|emoji|reaction|badge|favicon|sprite/i;

function normalizeLine(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function readDimension(element: HTMLElement, axis: "width" | "height"): number {
  const attributeValue = element.getAttribute(axis);
  if (attributeValue) {
    const parsed = Number(attributeValue);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const propertyValue = axis === "width" ? (element as HTMLImageElement).width : (element as HTMLImageElement).height;
  if (Number.isFinite(propertyValue) && propertyValue > 0) {
    return propertyValue;
  }

  const rect = element.getBoundingClientRect();
  return axis === "width" ? rect.width : rect.height;
}

function isMeaningfulSize(element: HTMLElement, minWidth: number, minHeight: number): boolean {
  return readDimension(element, "width") >= minWidth && readDimension(element, "height") >= minHeight;
}

function isLikelyUiImage(image: HTMLImageElement, ignoredSelector?: string): boolean {
  if (ignoredSelector && image.closest(ignoredSelector)) {
    return true;
  }

  const combinedText = [
    image.alt,
    image.getAttribute("aria-label"),
    image.getAttribute("data-testid"),
    image.className,
    image.id,
    image.src
  ]
    .map((value) => normalizeLine(typeof value === "string" ? value : ""))
    .join(" ");

  return UI_IMAGE_PATTERN.test(combinedText);
}

function extractCaption(image: HTMLImageElement): string {
  const figure = image.closest("figure");
  if (figure) {
    const figcaption = figure.querySelector("figcaption");
    const caption = normalizeLine(readNodeText(figcaption));
    if (caption) {
      return caption;
    }
  }

  const describedBy = image.getAttribute("aria-describedby");
  if (!describedBy) {
    return "";
  }

  const describedNode = image.ownerDocument.getElementById(describedBy);
  return normalizeLine(readNodeText(describedNode));
}

function buildImageDescriptor(image: HTMLImageElement): CandidateImage {
  const width = readDimension(image, "width");
  const height = readDimension(image, "height");
  const descriptor: CandidateImage = {
    src: image.currentSrc || image.src,
    width: width > 0 ? width : undefined,
    height: height > 0 ? height : undefined
  };
  const alt = normalizeLine(image.alt);
  const ariaLabel = normalizeLine(image.getAttribute("aria-label"));
  const caption = extractCaption(image);

  if (alt) {
    descriptor.alt = alt;
  }
  if (ariaLabel) {
    descriptor.ariaLabel = ariaLabel;
  }
  if (caption) {
    descriptor.caption = caption;
  }

  return descriptor;
}

function buildMediaSummary(images: CandidateImage[], hasVideo: boolean): string {
  const lines: string[] = [];

  if (images.length > 0) {
    lines.push(`Media type: ${hasVideo ? "video+image" : "image"}`);
  } else if (hasVideo) {
    lines.push("Media type: video");
  }

  images.forEach((image, index) => {
    const prefix = `Image ${index + 1}`;
    if (image.alt) {
      lines.push(`${prefix} alt: ${image.alt}`);
    }
    if (image.ariaLabel) {
      lines.push(`${prefix} aria-label: ${image.ariaLabel}`);
    }
    if (image.caption) {
      lines.push(`${prefix} caption: ${image.caption}`);
    }
  });

  return lines.join("\n");
}

export function extractPostMedia(root: HTMLElement, options: MediaExtractionOptions = {}): ExtractedMedia {
  const {
    ignoredSelector,
    imageSelector = "img",
    videoSelector = "video",
    maxImages = 2,
    minWidth = 180,
    minHeight = 120
  } = options;

  const images = (Array.from(root.querySelectorAll(imageSelector)) as HTMLImageElement[])
    .filter((image) => isElementVisible(image))
    .filter((image) => !isLikelyUiImage(image, ignoredSelector))
    .filter((image) => isMeaningfulSize(image, minWidth, minHeight))
    .map((image) => buildImageDescriptor(image))
    .filter((image) => Boolean(image.src))
    .slice(0, maxImages);

  const hasVideo = (Array.from(root.querySelectorAll(videoSelector)) as HTMLElement[])
    .filter((video) => isElementVisible(video))
    .filter((video) => !(ignoredSelector && video.closest(ignoredSelector)))
    .some((video) => isMeaningfulSize(video, minWidth, minHeight));

  const mediaType: CandidateMediaType = images.length > 0 ? "image" : hasVideo ? "video" : "none";

  return {
    mediaType,
    images,
    mediaSummary: buildMediaSummary(images, hasVideo)
  };
}
