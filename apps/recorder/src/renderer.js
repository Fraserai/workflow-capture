const byId = (id) => document.getElementById(id)

let environment = null
let currentConfig = null
let currentStatus = null

function formatRelativeTime(value) {
  if (!value) {
    return "Not yet synced"
  }

  const diffSeconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (diffSeconds < 5) {
    return "Just now"
  }
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`
  }
  if (diffSeconds < 3600) {
    return `${Math.floor(diffSeconds / 60)}m ago`
  }
  return `${Math.floor(diffSeconds / 3600)}h ago`
}

function modeFromStatus(status) {
  if (status.lastError && !status.apiConnected) {
    return "error"
  }
  if (!status.recording && !status.paused && status.pendingCount > 0 && status.apiConnected) {
    return "syncing"
  }
  if (status.recording) {
    return "recording"
  }
  if (status.paused) {
    return "paused"
  }
  return "idle"
}

function setVisibility(id, visible) {
  byId(id).classList.toggle("hidden", !visible)
}

function renderConfig(config) {
  currentConfig = config
  byId("managedLabel").textContent = `Managed by ${config.organizationName}`
  byId("organizationName").value = config.organizationName
  byId("apiBaseUrl").value = config.apiBaseUrl
  byId("captureScreenshots").checked = config.captureScreenshots
  byId("screenshotIntervalSeconds").value = String(config.screenshotIntervalSeconds)
  byId("debugMode").checked = config.debugMode
  setVisibility("onboardingView", !config.hasCompletedOnboarding)
}

function renderDiagnostics(status) {
  byId("diagSession").textContent = status.remoteSessionId || status.sessionRef || "No active session"
  byId("diagPending").textContent = String(status.pendingCount)
  byId("diagApp").textContent = status.currentApp || "Unavailable"
  byId("diagWindow").textContent = status.currentWindow || "Unavailable"
  byId("diagError").textContent = status.lastError || "None"

  const activity = byId("diagActivity")
  activity.innerHTML = ""
  ;(status.recentActivity || [])
    .slice()
    .reverse()
    .forEach((entry) => {
      const row = document.createElement("div")
      row.className = "diag-entry"
      row.textContent = entry
      activity.appendChild(row)
    })
}

function renderStatus(status) {
  currentStatus = status
  const mode = modeFromStatus(status)
  const labelMap = {
    idle: "Idle",
    recording: "Recording",
    syncing: "Syncing",
    error: "Error",
    paused: "Paused",
  }

  byId("statusLabel").textContent = labelMap[mode]
  byId("lastSyncValue").textContent = formatRelativeTime(status.lastSyncAt)
  byId("statusOrb").className = `status-orb ${mode}`
  byId("syncDot").className = `sync-dot ${status.apiConnected ? "online" : "offline"}`

  byId("startLabel").textContent = status.paused ? "Resume" : "Start"
  byId("startButton").disabled = status.recording
  byId("pauseButton").disabled = !status.recording
  byId("stopButton").disabled = !status.recording && !status.paused
  byId("quickStopButton").disabled = !status.recording && !status.paused

  renderDiagnostics(status)
}

function openSettings() {
  setVisibility("settingsSheet", true)
}

function closeSettings() {
  setVisibility("settingsSheet", false)
}

function openDiagnostics() {
  setVisibility("diagnosticsSheet", true)
}

function closeDiagnostics() {
  setVisibility("diagnosticsSheet", false)
}

async function saveConfig(partial = {}) {
  const payload = {
    apiBaseUrl: byId("apiBaseUrl").value.trim(),
    organizationName: byId("organizationName").value.trim() || "Your organization",
    captureScreenshots: byId("captureScreenshots").checked,
    screenshotIntervalSeconds: Number(byId("screenshotIntervalSeconds").value || "5"),
    excludedApps: currentConfig?.excludedApps || [],
    excludedDomains: currentConfig?.excludedDomains || [],
    debugMode: byId("debugMode").checked,
    hasCompletedOnboarding: currentConfig?.hasCompletedOnboarding || false,
    ...partial,
  }
  const saved = await window.recorderAPI.saveConfig(payload)
  renderConfig(saved)
  return saved
}

async function completeOnboarding() {
  const saved = await saveConfig({ hasCompletedOnboarding: true })
  renderConfig(saved)
}

async function bootstrap() {
  environment = await window.recorderAPI.getEnvironment()
  renderConfig(await window.recorderAPI.getConfig())
  renderStatus(await window.recorderAPI.getStatus())

  byId("settingsButton").addEventListener("click", openSettings)
  byId("settingsRowButton").addEventListener("click", openSettings)
  byId("closeSettingsButton").addEventListener("click", closeSettings)
  byId("openDiagnosticsButton").addEventListener("click", () => {
    closeSettings()
    openDiagnostics()
  })
  byId("closeDiagnosticsButton").addEventListener("click", closeDiagnostics)
  byId("saveSettingsButton").addEventListener("click", async () => {
    await saveConfig()
    closeSettings()
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
  byId("quickStopButton").addEventListener("click", async () => {
    await window.recorderAPI.stopRecording()
  })

  byId("onboardingSettingsButton").addEventListener("click", openSettings)
  byId("onboardingContinueButton").addEventListener("click", async () => {
    await completeOnboarding()
  })

  window.recorderAPI.onStatusUpdate(renderStatus)
  window.recorderAPI.onConfigUpdated(renderConfig)
  window.recorderAPI.onOpenSettings(openSettings)
  window.recorderAPI.onOpenDiagnostics(() => {
    if (currentConfig?.debugMode) {
      openDiagnostics()
    } else {
      openSettings()
    }
  })
}

window.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch(() => {
    renderStatus({
      recording: false,
      paused: false,
      sessionRef: null,
      remoteSessionId: null,
      pendingCount: 0,
      apiConnected: false,
      lastError: "Recorder UI failed to initialize",
      lastSyncAt: null,
      recentActivity: [],
      currentApp: null,
      currentWindow: null,
    })
  })
})
