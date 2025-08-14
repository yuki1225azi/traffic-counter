// DOM要素取得
const DOM = {
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  ctx: document.getElementById("canvas").getContext("2d"),
  personCountSpan: document.getElementById("person-count"),
  toggleBtn: document.getElementById("toggle-analysis-btn"),
  loadingIndicator: document.getElementById("loading-model"),
  loadingPercentage: document.getElementById("loading-percentage"),
  loadingProgressBar: document.getElementById("loading-progress"),
  toast: document.getElementById("toast"),
  logBody: document.getElementById("log-body"),
  logDisplay: document.getElementById("log-display"),
  videoContainer: document.getElementById("video-container")
};

let model = null;
let isAnalyzing = false;
let animationFrameId = null;
let recordedData = [];
let lastLogTime = 0;
let autoSaveIntervalId = null;
let analysisStartTime = null;

const MAX_LOGS_IN_DISPLAY = 100;

async function initializeApp() {
  try {
    DOM.loadingIndicator.classList.remove("hidden");
    DOM.loadingProgressBar.classList.remove("hidden");
    DOM.loadingPercentage.textContent = "0%";
    DOM.loadingProgressBar.value = 0;

    await tf.ready();

    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 5;
      if (progress <= 90) {
        DOM.loadingPercentage.textContent = `${progress}%`;
        DOM.loadingProgressBar.value = progress;
      } else {
        clearInterval(progressInterval);
      }
    }, 100);

    model = await cocoSsd.load();
    clearInterval(progressInterval);
    DOM.loadingPercentage.textContent = "100%";
    DOM.loadingProgressBar.value = 100;
    document.getElementById("status-indicator").classList.add("hidden");

    await setupCamera();
    setupEventListeners();
    adjustCanvasSize();
    drawVideoToCanvas();
    DOM.logDisplay.classList.remove("hidden");
    DOM.personCountSpan.textContent = "0";
  } catch (error) {
    console.error("初期化に失敗しました:", error);
    alert(`初期化に失敗しました: ${error.message}`);
    DOM.loadingIndicator.innerText = "初期化エラー";
    DOM.loadingProgressBar.classList.add("hidden");
  }
}

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false
  });
  DOM.video.srcObject = stream;
  return new Promise(resolve => {
    DOM.video.onloadedmetadata = () => {
      DOM.video.play();
      adjustCanvasSize();
      DOM.toggleBtn.disabled = false;
      resolve();
    };
  });
}

function adjustCanvasSize() {
  DOM.canvas.width = DOM.video.videoWidth;
  DOM.canvas.height = DOM.video.videoHeight;
  DOM.canvas.style.width = `${DOM.video.offsetWidth}px`;
  DOM.canvas.style.height = `${DOM.video.offsetHeight}px`;
  DOM.videoContainer.style.height = `${DOM.video.offsetHeight}px`;

  if (!isAnalyzing) {
    requestAnimationFrame(drawVideoToCanvas);
  }
}

function drawVideoToCanvas() {
  DOM.ctx.drawImage(DOM.video, 0, 0, DOM.canvas.width, DOM.canvas.height);
  if (!isAnalyzing) {
    animationFrameId = requestAnimationFrame(drawVideoToCanvas);
  }
}

function toggleAnalysis() {
  isAnalyzing = !isAnalyzing;
  if (isAnalyzing) startAnalysis();
  else stopAnalysis();
}

function startAnalysis() {
  DOM.toggleBtn.textContent = "測定終了";
  DOM.toggleBtn.classList.remove("btn-green");
  DOM.toggleBtn.classList.add("btn-red");
  DOM.canvas.classList.add("analyzing");

  recordedData = [];
  analysisStartTime = new Date();
  DOM.logBody.innerHTML = "";
  startAutoSaveInterval();
  detectFrame();
}

async function stopAnalysis() {
  DOM.toggleBtn.textContent = "測定開始";
  DOM.toggleBtn.classList.remove("btn-red");
  DOM.toggleBtn.classList.add("btn-green");
  DOM.canvas.classList.remove("analyzing");
  cancelAnimationFrame(animationFrameId);
  stopAutoSaveInterval();

  if (recordedData.length > 0) {
    await exportCSV(recordedData, analysisStartTime);
    recordedData = [];
  }
  DOM.personCountSpan.textContent = "0";
  drawVideoToCanvas();
}

function startAutoSaveInterval() {
  if (autoSaveIntervalId) clearInterval(autoSaveIntervalId);
  autoSaveIntervalId = setInterval(async () => {
    if (recordedData.length > 0) {
      await exportCSV(recordedData, analysisStartTime);
      recordedData = [];
      analysisStartTime = new Date();
    }
  }, 60 * 60 * 1000);
}

function stopAutoSaveInterval() {
  if (autoSaveIntervalId) {
    clearInterval(autoSaveIntervalId);
    autoSaveIntervalId = null;
  }
}

async function detectFrame() {
  if (!isAnalyzing || DOM.video.paused || DOM.video.ended) return;

  adjustCanvasSize();
  const predictions = await model.detect(DOM.video);
  DOM.ctx.drawImage(DOM.video, 0, 0, DOM.canvas.width, DOM.canvas.height);

  let personCount = 0;
  predictions.forEach(pred => {
    if (pred.class === "person") {
      personCount++;
      DOM.ctx.strokeStyle = "red";
      DOM.ctx.lineWidth = 2;
      DOM.ctx.strokeRect(...pred.bbox);
    }
  });

  DOM.personCountSpan.textContent = personCount;

  const now = new Date();
  const timestamp = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`;

  if (now - lastLogTime >= 1000) {
    recordedData.push({ timestamp, count: personCount });
    updateLogDisplay();
    lastLogTime = now;
  }
  animationFrameId = requestAnimationFrame(detectFrame);
}

function updateLogDisplay() {
  const latestLog = recordedData[recordedData.length - 1];
  if (!latestLog) return;

  const row = document.createElement("tr");
  row.innerHTML = `<td>${latestLog.timestamp}</td><td>${latestLog.count}</td>`;

  DOM.logBody.prepend(row);

  if (DOM.logBody.children.length > MAX_LOGS_IN_DISPLAY) {
    DOM.logBody.lastChild.remove();
  }
}

async function exportCSV(dataToExport, sessionStartTime) {
  if (dataToExport.length === 0) {
    showToast("出力するデータがありません。", true);
    return;
  }

  const header = "日時,人数\n";
  const rows = dataToExport.map(row => `"${row.timestamp}",${row.count}`);
  const csvContent = header + rows.join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  const now = sessionStartTime;
  const formattedDate = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const formattedTime = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
  const fileName = `${formattedDate}_${formattedTime}_people_counter.csv`;

  link.setAttribute("download", fileName);
  link.href = url;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`CSVファイル「${fileName}」を出力しました。`);
}

function showToast(message, isError = false) {
  DOM.toast.textContent = message;
  DOM.toast.style.backgroundColor = isError ? "rgba(255,0,0,0.7)" : "rgba(0,0,0,0.7)";
  DOM.toast.classList.remove("hidden");
  setTimeout(() => {
    DOM.toast.classList.add("hidden");
    DOM.toast.style.backgroundColor = "";
  }, 3000);
}

function setupEventListeners() {
  DOM.toggleBtn.addEventListener("click", toggleAnalysis);
  window.addEventListener("resize", adjustCanvasSize);
}

window.addEventListener("load", initializeApp);
