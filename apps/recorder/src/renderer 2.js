const byId = (id) => document.getElementById(id)

let environment = null
let settingsOpen = false

function setSettingsOpen(nextValue) {
  settingsOpen = nextValue
  byId("settingsPanel").classList.toggle("hidden", !settingsOpen)
}

function renderStatus(status) {
  const mode = status.recording ? "recording" : status.paused ? "paused" : "idle"
  const label = mode === "recording" ? "Recording" : mode === "paused" ? "Paused" : "Idle"
  const detail = mode === "recording"
    ? "Capture is active in the background."
    : mode === "paused"
      ? "Capture is paused and can be resumed."
      : "Recorder is waiting for the next task."

  byId("statusLabel").textContent = label
  byId("statusDetail").textContent = detail
  byId("statusPill").textContent = label
  byId("statusPill").className = `status-pill ${mode}`
  byId("sessionValue").textContent = status.remoteSessionId || status.sessionRef || "No session"
  byId("apiValue").textContent = status.apiConnected ? "Connected" : "Buffering"

  byId("startButton").textContent = status.paused ? "Resume" : "Start"
  byId("startButton").disabled = status.recording
  byId("pauseButton").disabled = !status.recording
  byId("stopButton").disabled = !status.recording && !status.paused
}

async function loadConfig() {
  const config = await window.recorderAPI.getConfig()
  byId("apiBaseUrl").value = config.apiBaseUrl
  byId("captureScreenshots").checked = config.captureScreenshots
  byId("screenshotIntervalSeconds").value = String(config.screenshotIntervalSeconds)
}

async function saveConfig() {
  const payload = {
    apiBaseUrl: byId("apiBaseUrl").value.trim(),
    captureScreenshots: byId("captureScreenshots").checked,
    screenshotIntervalSeconds: Number(byId("screenshotIntervalSeconds").value || "5"),
    excludedApps: [],
    excludedDomains: [],
  }
  await window.recorderAPI.saveConfig(payload)
}

async function bootstrap() {
  environment = await window.recorderAPI.getEnvironment()
  await loadConfig()

  byId("settingsToggle").addEventListener("click", () => {
    setSettingsOpen(!settingsOpen)
  })

  byId("saveConfigButton").addEventListener("click", async () => {
    await saveConfig()
    setSettingsOpen(false)
  })

  byId("startButton").addEventListener("click", async () => {
    await saveConfig()
    await window.recorderAPI.startRecording({
      employeeIdentifier: environment.employeeIdentifier,
    })
  })

  byId("pauseButton").addEventListener("click", async () => {
    await window.recorderAPI.pauseRecording()
  })

  byId("stopButton").addEventListener("click", async () => {
    await window.recorderAPI.stopRecording()
  })

  const initialStatus = await window.recorderAPI.getStatus()
  renderStatus(initialStatus)
  window.recorderAPI.onStatusUpdate(renderStatus)
  window.recorderAPI.onToggleSettings(() => {
    setSettingsOpen(!settingsOpen)
  })
}

window.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch(() => {
    renderStatus({
      recording: false,
      paused: false,
      sessionRef: null,
      remoteSessionId: null,
      apiConnected: false,
    })
  })
})
