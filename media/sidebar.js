const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);

const AXIS_IDS = [
  "logical_density",
  "technical_focus",
  "emotional_retention",
  "politeness_level"
];

const setSecretStatus = (el, label, ok) => {
  el.textContent = label + (ok ? "：設定済み" : "：未設定");
  el.className = "status " + (ok ? "ok" : "ng");
};

const sliderPercentToValue = (percent) => Math.min(1, Math.max(0, percent / 100));

const valueToSliderPercent = (value) => Math.round(Math.min(1, Math.max(0, value)) * 100);

const updateSliderLabel = (axisId) => {
  const slider = $(axisId);
  const label = $(`${axisId}Val`);
  if (!slider || !label) {
    return;
  }
  label.textContent = sliderPercentToValue(Number(slider.value)).toFixed(2);
};

const applyConverterForm = (converter) => {
  for (const axisId of AXIS_IDS) {
    const slider = $(axisId);
    if (!slider) {
      continue;
    }
    const value = converter?.[axisId] ?? 0.5;
    slider.value = String(valueToSliderPercent(value));
    updateSliderLabel(axisId);
  }
  $("freeInstruction").value = converter?.free_instruction ?? "";
};

const readConverterForm = () => ({
  logical_density: sliderPercentToValue(Number($("logical_density").value)),
  technical_focus: sliderPercentToValue(Number($("technical_focus").value)),
  emotional_retention: sliderPercentToValue(Number($("emotional_retention").value)),
  politeness_level: sliderPercentToValue(Number($("politeness_level").value)),
  free_instruction: $("freeInstruction").value.trim()
});

for (const axisId of AXIS_IDS) {
  const slider = $(axisId);
  if (!slider) {
    continue;
  }
  slider.addEventListener("input", () => updateSliderLabel(axisId));
}

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg.type === "state") {
    $("zennRepoPath").value = msg.settings.zennRepoPath || "";
    $("openAiModel").value = msg.settings.openAiModel || "";
    $("defaultBasename").value = msg.settings.defaultAnalysisBasename || "";
    applyConverterForm(msg.converterForm);
    if (!$("basename").value && msg.settings.defaultAnalysisBasename) {
      $("basename").value = msg.settings.defaultAnalysisBasename;
    }
    setSecretStatus($("secretOpenAi"), "OpenAI API Key", msg.secrets.openAiApiKey);
    setSecretStatus($("secretGithub"), "GitHub Token", msg.secrets.githubToken);
    setSecretStatus($("secretGitName"), "Git Author Name", msg.secrets.gitAuthorName);
    setSecretStatus($("secretGitEmail"), "Git Author Email", msg.secrets.gitAuthorEmail);
    $("runBtn").disabled = !msg.canRun;
    $("secretsError").textContent = msg.secretsError || "";
  }
  if (msg.type === "log") {
    $("log").textContent = msg.message;
  }
});

$("runBtn").addEventListener("click", () => {
  vscode.postMessage({
    type: "run",
    noteUrl: $("noteUrl").value.trim(),
    basename: $("basename").value.trim(),
    settingsDraft: {
      zennRepoPath: $("zennRepoPath").value.trim(),
      openAiModel: $("openAiModel").value.trim(),
      defaultAnalysisBasename: $("defaultBasename").value.trim(),
      converter: readConverterForm()
    }
  });
});

document.querySelectorAll("[data-secret]").forEach((btn) => {
  btn.addEventListener("click", () => {
    vscode.postMessage({ type: "setSecret", secret: btn.getAttribute("data-secret") });
  });
});

for (const axisId of AXIS_IDS) {
  updateSliderLabel(axisId);
}

vscode.postMessage({ type: "ready" });
