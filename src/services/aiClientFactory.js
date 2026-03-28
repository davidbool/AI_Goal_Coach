import { MockAiClient } from "./mockAiClient.js";

const AVAILABLE_AI_PROVIDERS = ["mock", "real"];
const DEFAULT_AI_PROVIDER = "mock";

function normalizeProvider(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function buildInvalidProviderError(provider) {
  return new Error(
    `Unsupported AI provider "${provider}". Expected one of: ${AVAILABLE_AI_PROVIDERS.join(", ")}.`
  );
}

function buildUnavailableProviderError(provider) {
  return new Error(
    `AI provider "${provider}" is not wired yet. Keep AI_PROVIDER=mock for local UI testing until the real provider is implemented.`
  );
}

export function resolveAiProvider(options = {}) {
  const provider = normalizeProvider(
    options.aiProvider ??
      process.env.AI_PROVIDER ??
      process.env.GOAL_COACH_AI_PROVIDER ??
      DEFAULT_AI_PROVIDER
  );

  if (!AVAILABLE_AI_PROVIDERS.includes(provider)) {
    throw buildInvalidProviderError(provider || "<empty>");
  }

  return provider;
}

export function createConfiguredAiClient(options = {}) {
  const provider = resolveAiProvider(options);

  if (provider === "mock") {
    return new MockAiClient();
  }

  throw buildUnavailableProviderError(provider);
}

export const AiProviderConfig = {
  available: AVAILABLE_AI_PROVIDERS,
  defaultProvider: DEFAULT_AI_PROVIDER
};
