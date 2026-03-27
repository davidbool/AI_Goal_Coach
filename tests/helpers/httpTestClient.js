import { once } from "node:events";

async function parseResponseBody(response) {
  const rawBody = await response.text();

  if (rawBody.length === 0) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return rawBody;
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error.message}`);
  }
}

export async function startServer(server) {
  server.listen(0);
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Could not resolve server address");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function request(path, { method = "GET", body } = {}) {
    const headers = {};
    const payload =
      body === undefined || body === null ? undefined : JSON.stringify(body);

    if (payload !== undefined) {
      headers["content-type"] = "application/json";
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: payload
    });

    return {
      status: response.status,
      body: await parseResponseBody(response)
    };
  }

  async function stop() {
    if (!server.listening) {
      return;
    }

    server.close();
    await once(server, "close");
  }

  return {
    baseUrl,
    request,
    stop
  };
}
