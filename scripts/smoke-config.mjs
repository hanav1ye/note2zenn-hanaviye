import { loadConverterConfig, loadRuntimeConfig } from "../dist/services/configService.js";

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runtime = loadRuntimeConfig({
  zennRepoPath: "C:\\git\\zenn-contents",
  openAiApiKey: "test-key",
  openAiModel: "gpt-4.1-mini"
});
assert(runtime.openAiApiKey === "test-key", "runtime openAiApiKey");
assert(runtime.openAiModel === "gpt-4.1-mini", "runtime openAiModel");

const converter = loadConverterConfig({
  logical_density: { value: 1.2 },
  technical_focus: { value: -0.1 },
  emotional_retention: { value: 0.5 },
  politeness_level: { value: 0.5 }
});
assert(converter.logical_density.value === 1, "logical_density clamped to 1");
assert(converter.technical_focus.value === 0, "technical_focus clamped to 0");

try {
  loadRuntimeConfig({ zennRepoPath: "", openAiApiKey: "x" });
  throw new Error("expected zennRepoPath validation error");
} catch (error) {
  assert(error instanceof Error && error.message.includes("zennRepoPath"), "zennRepoPath validation");
}

console.log("smoke-config: OK");
