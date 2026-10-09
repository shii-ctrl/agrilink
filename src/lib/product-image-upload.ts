const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumDataUrlLength = 2_400_000;

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected image could not be read."));
    image.src = source;
  });
}

/**
 * Keeps prototype product photos small enough to store safely with the product record.
 * A later production-scale deployment can replace this with object storage without
 * changing the Marketer file-picker experience.
 */
export async function prepareProductImage(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const largestSide = 1400;
    const scale = Math.min(1, largestSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = 0.84;
    let imageDataUrl = canvas.toDataURL("image/jpeg", quality);
    while (imageDataUrl.length > maximumDataUrlLength && quality > 0.5) {
      quality -= 0.08;
      imageDataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (imageDataUrl.length > maximumDataUrlLength) {
      throw new Error("Choose a smaller image. It could not be compressed enough to save.");
    }
    return imageDataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
