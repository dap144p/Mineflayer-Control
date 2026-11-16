import { defineHandler } from "nitro";

export default defineHandler(async (event) => {
  const hash = String(event.context.params.hash || "");
  if (!/^[0-9a-f]{1,128}$/i.test(hash)) {
    return new Response("Invalid texture hash", { status: 400 });
  }

  try {
    const response = await fetch("https://textures.minecraft.net/texture/" + hash, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return new Response(null, { status: response.status === 404 ? 404 : 502 });
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
});
