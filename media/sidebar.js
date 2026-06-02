const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);

const setSecretStatus = (el, label, ok) => {
  el.textContent = label + (ok ? "：設定済み" : "：未設定");
  el.className = "status " + (ok ? "ok" : "ng");
};

window.addEventListener("message", (event) => {
  const msg = event.data;
  if (msg.type === "state") {
    $("zennRepoPath").value = msg.settings.zennRepoPath || "";
    $("openAiModel").value = msg.settings.openAiModel || "";
    $("defaultBasename").value = msg.settings.defaultAnalysisBasename || "";
    $("converterConfig").value = JSON.stringify(msg.settings.converterConfig || {}, null, 2);
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
    basename: $("basename").value.trim()
  });
});

$("saveSettingsBtn").addEventListener("click", () => {
  vscode.postMessage({
    type: "saveSettings",
    zennRepoPath: $("zennRepoPath").value.trim(),
    openAiModel: $("openAiModel").value.trim(),
    defaultAnalysisBasename: $("defaultBasename").value.trim(),
    converterConfigText: $("converterConfig").value
  });
});

$("openSettingsBtn").addEventListener("click", () => {
  vscode.postMessage({ type: "openSettings" });
});

document.querySelectorAll("[data-secret]").forEach((btn) => {
  btn.addEventListener("click", () => {
    vscode.postMessage({ type: "setSecret", secret: btn.getAttribute("data-secret") });
  });
});

vscode.postMessage({ type: "ready" });
