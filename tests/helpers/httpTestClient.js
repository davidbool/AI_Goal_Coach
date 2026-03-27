import { once } from "node:events";

export async function startServer(server) {
  server.listen(0);
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Could not resolve server address");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function request(path, { method = "GET", body } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const payload = await response.json();

    return {
      status: response.status,
      body: payload
    };
  }

  async function stop() {
    server.close();
    await once(server, "close");
  }

  return {
    baseUrl,
    request,
    stop
  };
}
