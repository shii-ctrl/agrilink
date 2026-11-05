import { createHash } from "node:crypto";

export async function uploadCatalogImage(imageDataUrl: string): Promise<string> {
  const cloudName = process.env["CLOUDINARY_CLOUD_NAME"]?.trim();
  const apiKey = process.env["CLOUDINARY_API_KEY"]?.trim();
  const apiSecret = process.env["CLOUDINARY_API_SECRET"]?.trim();
  if (!cloudName || !/^[a-z0-9_-]+$/i.test(cloudName) || !apiKey || !apiSecret) {
    throw new Error("Product photo storage is not configured. Contact PROCY support.");
  }

  // Identical uploads reuse an immutable asset. Saved orders can keep their original photo URL.
  const imageHash = createHash("sha256").update(imageDataUrl).digest("hex");
  const form = new FormData();
  form.set("file", imageDataUrl);
  form.set("asset_folder", "agrilink/catalog");
  form.set("public_id", `agrilink/catalog/${imageHash}`);
  form.set("overwrite", "false");

  let status: number | undefined;
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
      },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });
    status = response.status;
    if (response.ok) {
      const { secure_url: secureUrl } = (await response.json()) as { secure_url?: unknown };
      if (typeof secureUrl === "string") {
        const url = new URL(secureUrl);
        if (
          url.origin === "https://res.cloudinary.com" &&
          url.pathname.startsWith(`/${cloudName}/image/upload/`)
        ) {
          return url.href;
        }
      }
    }
  } catch {
    // Do not log the request, credentials, or uploaded image.
  }

  console.error("Cloudinary catalog upload failed", { status });
  if (status === 401 || status === 403) {
    throw new Error("Product photo storage rejected the upload. Contact PROCY support.");
  }
  throw new Error("Could not upload the product photo. Please try again.");
}
