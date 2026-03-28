function isMissingModuleError(error, specifier) {
  return (
    error?.code === "ERR_MODULE_NOT_FOUND" &&
    typeof error.message === "string" &&
    error.message.includes(specifier)
  );
}

function pickApp(candidate) {
  if (candidate && typeof candidate.listen === "function") {
    return candidate;
  }

  if (candidate?.app && typeof candidate.app.listen === "function") {
    return candidate.app;
  }

  return null;
}

async function loadAppFrom(specifier, exportName) {
  try {
    const module = await import(specifier);
    if (typeof module[exportName] !== "function") {
      return null;
    }

    return pickApp(module[exportName]());
  } catch (error) {
    if (isMissingModuleError(error, specifier)) {
      return null;
    }

    throw error;
  }
}

async function resolveApp() {
  const bootstrappers = [
    { specifier: "./server/createServer.js", exportName: "createServer" },
    { specifier: "./app.js", exportName: "createApp" }
  ];

  for (const bootstrapper of bootstrappers) {
    const app = await loadAppFrom(bootstrapper.specifier, bootstrapper.exportName);
    if (app) {
      return app;
    }
  }

  throw new Error(
    "Unable to bootstrap server: expected createServer() or createApp() in known entry modules."
  );
}

const app = await resolveApp();
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`AI Goal Coach API listening on port ${port}`);
});
