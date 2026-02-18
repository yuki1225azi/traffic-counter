// 定数定義
const UI_CATS = ['car','bus','truck','motorcycle','bicycle','person'];
const VEHICLE_CATS = ['car','bus','truck','motorcycle','bicycle'];

// DOM要素の参照
const DOM = {
  videoContainer: document.getElementById("video-container"),
  video: document.getElementById("video"),
  canvas: document.getElementById("canvas"),
  ctx: document.getElementById("canvas").getContext("2d"),
  appTitle: document.getElementById("app-title"),
  toggleBtn: document.getElementById("toggle-analysis-btn"),
  status: document.getElementById("status-indicator"),
  loadingPerc: document.getElementById("loading-percentage"),
  loadingProg: document.getElementById("loading-progress"),
  toast: document.getElementById("toast"),
  hourTitle: document.getElementById("current-hour-title"),
  count: {
    car: document.getElementById("count-car"),
    bus: document.getElementById("count-bus"),
    truck: document.getElementById("count-truck"),
    motorcycle: document.getElementById("count-motorcycle"),
    bicycle: document.getElementById("count-bicycle"),
    person: document.getElementById("count-person"),
  },
  logBody: document.getElementById("log-body"),
  startDt: document.getElementById("auto-start-dt"),
  endDt: document.getElementById("auto-end-dt"),
  reserveBtn: document.getElementById("reserve-btn"),
  scoreTh: document.getElementById("score-th"),
  hitArea: document.getElementById("hit-area"),
  maxLost: document.getElementById("max-lost"),
  maxFps: document.getElementById("max-fps"),
  countModeSelect: document.getElementById("count-mode"),
  geoLat: document.getElementById("geo-lat"),
  geoLng: document.getElementById("geo-lng"),
};

// 情報モーダル関連
let INFO_MODAL = { overlay:null, title:null, body:null };

function ensureInfoModal(){
  if(INFO_MODAL.overlay) return;

  if(!document.getElementById("info-modal-style")){
     const st = document.createElement("style");
     st.id = "info-modal-style";
     st.textContent = `
      .info-modal-overlay{
        position:fixed; inset:0;
        background: rgba(0,0,0,0.5); 
        display:none;
        align-items:center;
        justify-content:center;
        z-index: 9999;
        padding: 16px;
      }
      .info-modal{
        width: min(640px, 90vw);  
        max-height: 80vh;         
        background: #ffffff;      
        color: #333;              
        border-radius: 14px;
        border: none;             
        box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        overflow: hidden;
        display:flex;
        flex-direction: column;
      }
      .info-modal-header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 8px 16px;       
        border-bottom: 1px solid #eee; 
        font-weight: 700;
        font-size: 1.1rem;
        color: #2c3e50;           
      }
      .info-modal-close{
        width: 32px; height: 32px;
        border-radius: 50%;       
        border: 1px solid #ddd;
        background: #f8f9fa;
        color: #666;
        cursor: pointer;
        display:inline-flex; align-items:center; justify-content:center;
        font-size: 20px; line-height: 1;
        transition: all 0.2s;
      }
      .info-modal-close:hover{ 
        background: #e9ecef; 
        color: #333;
      }
      .info-modal-body{
        padding: 12px 16px;
        overflow:auto;
        font-size: 0.95rem;
        line-height: 1.6;
        white-space: pre-wrap;
        color: #444;
      }
    `;
    document.head.appendChild(st);
  }

  const overlay = document.createElement("div");
  overlay.className = "info-modal-overlay";
  overlay.setAttribute("role","dialog");
  overlay.setAttribute("aria-modal","true");

  const modal = document.createElement("div");
  modal.className = "info-modal";

  const header = document.createElement("div");
  header.className = "info-modal-header";

  const title = document.createElement("div");
  title.className = "info-modal-title";
  title.textContent = "説明";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "info-modal-close";
  closeBtn.setAttribute("aria-label","閉じる");
  closeBtn.textContent = "×";

  const body = document.createElement("div");
  body.className = "info-modal-body";

  header.appendChild(title);
  header.appendChild(closeBtn);
  modal.appendChild(header);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = ()=>{
    overlay.style.display = "none";
  };

  overlay.addEventListener("pointerdown", (e)=>{
    if(e.target === overlay) close();
  });

  modal.addEventListener("pointerdown", (e)=> e.stopPropagation());

  closeBtn.addEventListener("click", close);

  window.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && overlay.style.display === "flex") close();
  });

  INFO_MODAL = { overlay, title, body };
}

function showInfoModal(titleText, bodyText){
  ensureInfoModal();
  INFO_MODAL.title.textContent = titleText || "説明";
  INFO_MODAL.body.textContent = bodyText || "";
  INFO_MODAL.overlay.style.display = "flex";
}

// UI状態制御
const COUNT_ITEM_EL = {};
for(const cat of UI_CATS){
  COUNT_ITEM_EL[cat] = document.querySelector(`.count-item.${cat}`);
}

function injectModeInactiveStyle(){
  if(document.getElementById("mode-inactive-style")) return;
  const st = document.createElement("style");
  st.id = "mode-inactive-style";
  
  st.textContent = `
    .count-item.inactive{
      background-color: #f2f2f2 !important; 
      color: #999 !important;                
      border-left-color: #ddd !important;    
      border-color: #ddd !important;         
      opacity: 0.6 !important;               
      filter: grayscale(100%);
      pointer-events: none;                  
    }
  `;
  document.head.appendChild(st);
}

function applyModeUiState(){
  const inactiveCats = (countMode === "vehicle") ? ["person"] : VEHICLE_CATS;
  for(const cat of UI_CATS){
    const el = COUNT_ITEM_EL[cat];
    if(!el) continue;
    el.classList.toggle("inactive", inactiveCats.includes(cat));
  }
}

function getCountedTotalByMode(counts){
  if(countMode === "pedestrian"){
    return Number(counts.person || 0);
  }
  return VEHICLE_CATS.reduce((s,k)=>s + Number(counts[k] || 0), 0);
}

// アプリ説明表示
function setupTitleDescription(){
  const title = DOM.appTitle;
  if(!title) return;

  const oldDesc = title.querySelector(".app-desc");
  if(oldDesc) oldDesc.remove();

  if(title.querySelector(".title-info-btn")) return;

  if(!document.getElementById("title-help-style")){
    const st = document.createElement("style");
    st.id = "title-help-style";
    st.textContent = `
      #app-title{display:flex;align-items:center;gap:8px;}
      #app-title .title-info-btn{
        width:22px;height:22px;border-radius:50%;
        border:1px solid #ccc;
        background:#f0f2f5;color:#555;
        font-weight:bold;font-size:0.75rem;line-height:1;
        display:inline-flex;align-items:center;justify-content:center;
        cursor:pointer;padding:0;flex:0 0 auto;
      }
      #app-title .title-info-btn:hover{box-shadow:0 1px 3px rgba(0,0,0,0.12);}
    `;
    document.head.appendChild(st);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "title-info-btn";
  btn.textContent = "i";
  btn.setAttribute("aria-label", "利用ガイド");

  const APP_GUIDE_TEXT = `【機能】
AIがカメラ映像から車両5種と歩行者を判別し、交通量をリアルタイムでカウントします。
測定データはアプリ内に蓄積され、「終了」ボタンを押すと、全期間分をまとめたCSVファイルが一括で保存されます。

【使い方の手順】
1. 画面上の枠をドラッグして、測定したい道路に合わせます。
2. 「開始」ボタンを押すと測定が始まります。
   ※開始後は誤操作防止のため、枠の移動や設定変更はロックされます。

【測定中の注意】
・測定が止まってしまうため、画面のスリープ(消灯)や、他のアプリへの切り替えは行わないでください。
・バッテリー消費が激しいため、充電しながらの使用を推奨します。`;

  btn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    showInfoModal("利用ガイド", APP_GUIDE_TEXT);
  });

  title.appendChild(btn);
}

// 設定項目のヘルプ表示
function setupSettingItemHelpPopups(){
  if(!document.getElementById("setting-help-style")){
    const st = document.createElement("style");
    st.id = "setting-help-style";
    st.textContent = `
      #settings-panel .setting-label-row{
        display:flex; 
        align-items:center; 
        justify-content:space-between; 
        width:100%; 
        margin-bottom: 2px;
      }
      #settings-panel .setting-info-btn{
        width:22px; height:22px; 
        border-radius:50%; 
        border:1px solid #ccc; 
        background:#f0f2f5; color:#555; 
        font-weight:bold; font-size:0.85rem; line-height:1; 
        display:inline-flex; align-items:center; justify-content:center; 
        cursor:pointer; padding:0; flex:0 0 auto;
      }
      #settings-panel .setting-info-btn:hover{box-shadow:0 1px 3px rgba(0,0,0,0.12);} 
    `;
    document.head.appendChild(st);
  }

const HELP = {
    "count-mode":
      "測定する対象の種類を選択します。\n・車両：乗用車、バス、トラック、バイク、自転車\n・歩行者：人のみ",
    
    "hit-area": 
      "カウント対象とする、物体中心部の判定幅を設定します。(10~100%)\n・カウント漏れが起きる場合は値を大きくしてください。\n・隣の車線を誤って拾う場合は値を小さくしてください。",
    
    "score-th":
      "AIが物体であると判断する際の自信の度合いです。(10~90%)\n・看板などを誤検知する場合は値を大きくしてください。\n・車両を見逃す場合は値を小さくしてください。",
    
    "max-fps":
      "1秒間に行う画像解析の回数です。(5~30fps)\n・高速な車両を見逃す場合は値を大きくしてください。\n・スマホの発熱や電池消費を抑える場合は値を小さくしてください。",
     
    "max-lost":
      "物体を見失っても追跡を継続する猶予フレーム数です。(5~30frm)\n・遮蔽物で追跡が切れる場合は値を大きくしてください。\n・別の車両を同一と誤認してしまう場合は値を小さくしてください。",
};

  const grid = document.querySelector("#settings-panel .settings-grid");
  if(!grid) return;

  if(grid.dataset.helpInjected === "1") return;
  grid.dataset.helpInjected = "1";

  const labels = Array.from(grid.querySelectorAll("label"));
  labels.forEach((label)=>{
    const control = label.querySelector("input, select, textarea");
    const id = control?.id;
    if(!id || !HELP[id]) return;

    let titleText = "";
    for(const n of Array.from(label.childNodes)){
      if(n.nodeType === Node.TEXT_NODE){
        const t = (n.textContent || "").replace(/\s+/g, " ").trim();
        if(t){
          titleText = t;
          label.removeChild(n);
          break;
        }
      }
    }
    if(!titleText) titleText = id;

    const row = document.createElement("div");
    row.className = "setting-label-row";

    row.addEventListener("click", (e) => {
      e.preventDefault();
    });

    const title = document.createElement("span");
    title.textContent = titleText;

    title.addEventListener("click", (e) => {
      e.preventDefault();
    });

    const btn = document.createElement("span");
    btn.className = "setting-info-btn";
    btn.textContent = "i";
    btn.setAttribute("aria-label", `${titleText} の説明`);

    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      showInfoModal(titleText, HELP[id]);
    });

    row.appendChild(title);
    row.appendChild(btn);

    if(control){
      label.insertBefore(row, control);
    }else{
      label.prepend(row);
    }
  });
}

function removeSettingsInfoMark(){
  try{ document.getElementById("settings-info-btn")?.remove(); }catch(_e){}
}

// アプリケーション状態変数
let model = null;
let isAnalyzing = false;
let rafId = null;
let lastInferTime = 0;
let analysisStartTime = null;
let hourWindowStart = null;
let isModelBusy = false;

let geo = { lat: "未取得", lng: "未取得" };
const MAX_LOGS = 100;

const zeroCounts = () => ({
  car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0, person: 0
});
let countsCurrentHour = zeroCounts();

let recordsHourly = [];
let scheduleTimerStart = null;
let scheduleTimerEnd = null;

let frameIndex = 0;

// カウントモード設定
const LS_KEY_MODE  = "trafficCounter.countMode";

const LS_KEY_ROI   = "trafficCounter.roiNorm";

function normalizeMode(v){
  return (v === "pedestrian" || v === "person") ? "pedestrian" : "vehicle";
}

function modeLabel(m){
  return (m === "pedestrian") ? "歩行者カウントモード" : "車両カウントモード";
}

function modeNoun(){
  return (countMode === "pedestrian") ? "通行量" : "交通量";
}

let countMode  = normalizeMode(localStorage.getItem(LS_KEY_MODE)  || "vehicle");
const countLogic = "roi";

// ROI管理
let ROI_NORM = [
  {x: 0.35, y: 0.3}, {x: 0.65, y: 0.3}, 
  {x: 0.65, y: 0.7}, {x: 0.35, y: 0.7}
];
let roiLocked = false; 
try{
  const saved = localStorage.getItem(LS_KEY_ROI);
  if(saved){
    const obj = JSON.parse(saved);
    if(Array.isArray(obj) && obj.length === 4 && obj.every(p => isFinite(p.x) && isFinite(p.y))){
      ROI_NORM = obj;
    }
  }
}catch(_e){}

function getRoiPx(){
  const W = DOM.canvas.width || 1;
  const H = DOM.canvas.height || 1;
  return ROI_NORM.map(p => ({ x: p.x * W, y: p.y * H }));
}

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

function getCanvasPoint(ev){
  const rect = DOM.canvas.getBoundingClientRect();

  const cw = DOM.canvas.width  || 1;
  const ch = DOM.canvas.height || 1;

  const scale = Math.min(rect.width / cw, rect.height / ch);

  const contentW = cw * scale;
  const contentH = ch * scale;
  const offsetX = (rect.width  - contentW) / 2;
  const offsetY = (rect.height - contentH) / 2;

  const xIn = (ev.clientX - rect.left - offsetX);
  const yIn = (ev.clientY - rect.top  - offsetY);

  const xClamped = Math.max(0, Math.min(contentW, xIn));
  const yClamped = Math.max(0, Math.min(contentH, yIn));

  return {
    x: xClamped / scale,
    y: yClamped / scale
  };
}

function saveRoi(){
  try{ localStorage.setItem(LS_KEY_ROI, JSON.stringify(ROI_NORM)); }catch(_e){}
}

// ROI操作・ドラッグ処理
function setupRoiDrag(){
  const c = DOM.canvas;
  if(!c) return;

  c.style.touchAction = "pan-y"; 
  let dragging = false;
  let dragIndex = -1;
  let dragCache = null;
  let lockTimer = null;

  const TOUCH_HIT_RADIUS_PX = 40; 
  const MOUSE_HIT_RADIUS_PX = 20;

  const activateScrollLock = () => {
    if(lockTimer) clearTimeout(lockTimer);
    c.style.touchAction = "none"; 
  };

  const scheduleScrollUnlock = (isTouch) => {
    if(lockTimer) clearTimeout(lockTimer);
    const delay = isTouch ? 1000 : 0;
    if (delay > 0) {
      lockTimer = setTimeout(() => {
        c.classList.remove("roi-active");
        c.style.touchAction = "pan-y"; 
        saveRoi();
        lockTimer = null;
      }, delay);
    } else {
      c.classList.remove("roi-active");
      c.style.touchAction = "pan-y";
      saveRoi();
      lockTimer = null;
    }
  };

  const checkHit = (clientX, clientY, isTouch) => {
    const rect = c.getBoundingClientRect();
    const cw = c.width || 1;
    const ch = c.height || 1; 
    const scale = Math.min(rect.width / cw, rect.height / ch); 
    const offsetX = (rect.width - (cw * scale)) / 2;
    const offsetY = (rect.height - (ch * scale)) / 2;
    
    const xIn = (clientX - rect.left - offsetX) / scale;
    const yIn = (clientY - rect.top - offsetY) / scale;
    
    const pts = getRoiPx(); 
    const radius = (isTouch ? TOUCH_HIT_RADIUS_PX : MOUSE_HIT_RADIUS_PX) / scale;

    let closestIdx = -1;
    let minDistance = Infinity;

    pts.forEach((pt, i) => {
      const dist = Math.sqrt((xIn - pt.x)**2 + (yIn - pt.y)**2);
      if(dist <= radius && dist < minDistance){
        minDistance = dist;
        closestIdx = i;
      }
    });
    return { index: closestIdx, rect, scale, offsetX, offsetY };
  };

  const handleFastInterrupt = (e) => {
    if (isAnalyzing || window.roiLocked === true) return;
    
    if (c.classList.contains("roi-active") && e.cancelable) {
      e.preventDefault();
      return;
    }

    const touch = e.touches ? e.touches[0] : e;
    const hit = checkHit(touch.clientX, touch.clientY, !!e.touches);

    if (hit.index !== -1 && e.cancelable) {
      e.preventDefault();
    }
  };

  const startDrag = (ev)=>{
    if(isAnalyzing || window.roiLocked === true) return;
    if(DOM.videoContainer && DOM.videoContainer.classList.contains("is-floating")) return;

    const isTouch = (ev.pointerType === 'touch' || ev.pointerType === 'pen');
    const hit = checkHit(ev.clientX, ev.clientY, isTouch);

    if(hit.index !== -1){
      if(ev.cancelable) ev.preventDefault();
      
      dragging = true;
      dragIndex = hit.index;
      dragCache = { 
        rect: hit.rect, scale: hit.scale, 
        offsetX: hit.offsetX, offsetY: hit.offsetY,
        cw: c.width, ch: c.height 
      };
      
      c.classList.add("roi-active"); 
      activateScrollLock(); 
      ev.stopImmediatePropagation();
      try{ c.setPointerCapture(ev.pointerId); }catch(_e){}
    }
  };

  const moveDrag = (ev)=>{
    if(!dragging || dragIndex === -1 || !dragCache) return;
    if(ev.cancelable) ev.preventDefault();
    ev.stopImmediatePropagation();

    const { rect, scale, offsetX, offsetY, cw, ch } = dragCache;
    const xClamped = Math.max(0, Math.min(cw * scale, ev.clientX - rect.left - offsetX));
    const yClamped = Math.max(0, Math.min(ch * scale, ev.clientY - rect.top - offsetY));

    ROI_NORM[dragIndex] = {
      x: Math.max(0, Math.min(1, (xClamped / scale) / cw)),
      y: Math.max(0, Math.min(1, (yClamped / scale) / ch))
    };
  };

  const endDrag = (ev)=>{
    if(!dragging) return;
    dragging = false;
    dragIndex = -1;
    dragCache = null;
    const isTouch = (ev.pointerType === 'touch' || ev.pointerType === 'pen');
    try{ c.releasePointerCapture(ev.pointerId); }catch(_e){}
    scheduleScrollUnlock(isTouch);
  };

  c.addEventListener("touchstart", handleFastInterrupt, { passive: false });
  c.addEventListener("pointerdown", startDrag, { passive: false });
  c.addEventListener("pointermove", moveDrag, { passive: false });
  c.addEventListener("pointerup", endDrag);
  c.addEventListener("pointercancel", endDrag);
}

// ROI描画処理
function drawRoi(ctx){
  const pts = getRoiPx(); 
  if(pts.length < 4) return;

  const isActive = DOM.canvas.classList.contains("roi-active");
  const mainColor = isActive ? "#ff9800" : "#ffffff"; 

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for(let i=1; i<4; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();

  ctx.fillStyle = isActive ? "rgba(255, 152, 0, 0.2)" : "rgba(255, 255, 255, 0.15)";
  ctx.fill();

  ctx.lineWidth = isActive ? 4 : 2;
  ctx.strokeStyle = mainColor;
  if (!isActive) ctx.setLineDash([5, 5]); 
  ctx.stroke();

  ctx.setLineDash([]);
  pts.forEach(pt => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = mainColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

// 幾何計算ユーティリティ
function isPointInPolygon(p, polygon) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
                      (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

function isLineIntersectingPolygon(p1, p2, polygon) {
  for (let i = 0; i < polygon.length; i++) {
    const s1 = polygon[i];
    const s2 = polygon[(i + 1) % polygon.length]; 
    if (getLineIntersection(p1, p2, s1, s2)) return true;
  }
  return false;
}

function getLineIntersection(p0, p1, p2, p3) {
  let s1_x = p1.x - p0.x;     let s1_y = p1.y - p0.y;
  let s2_x = p3.x - p2.x;     let s2_y = p3.y - p2.y;
  let s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
  let t = ( s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);
  return (s >= 0 && s <= 1 && t >= 0 && t <= 1);
}

// 物体追跡クラス
class Track {
  constructor(id, det){
    this.id = id;
    this.bbox = det.bbox;
    this.score = det.score;
    this.cls = det.cls;
    this.state = "tentative";
    this.hitStreak = 1; 
    this.lostAge = 0;
    this.createdAt = performance.now();
    this.lastSeenAt = this.createdAt;

    this.prevCenter = this.center(); 
    this.roiVotes = {};     
    this.globalVotes = {};  
    this.totalFramesInRoi = 0;
    this.consecutiveOutsideRoi = 0; 
    this.warpDetected = false;
    this.counted = false;
    
    this.voteGlobal(det.cls, det.score);
  }

  center(){
    const [x,y,w,h] = this.bbox;
    return { x: x + w/2, y: y + h/2 };
  }

  update(det){
    this.prevCenter = this.center(); 
    this.bbox = det.bbox;
    this.score = det.score;
    this.cls = det.cls;
    this.hitStreak++;
    this.lostAge = 0;
    this.lastSeenAt = performance.now();
    
    this.voteGlobal(det.cls, det.score);
  }

  voteRoi(cls, score){
    if(!this.roiVotes[cls]) this.roiVotes[cls] = 0;
    this.roiVotes[cls] += score;
    this.totalFramesInRoi++;
  }

  voteGlobal(cls, score){
    if(!this.globalVotes[cls]) this.globalVotes[cls] = 0;
    this.globalVotes[cls] += score;
  }

  getWinnerClass(){
    const candidates = new Set([...Object.keys(this.roiVotes), ...Object.keys(this.globalVotes)]);
    let bestCls = this.cls;
    let maxScore = -1;

    for(const c of candidates){
      const rScore = this.roiVotes[c] || 0;
      const gScore = this.globalVotes[c] || 0;
      const total = rScore + (gScore * 0.1);
      
      if(total > maxScore){
        maxScore = total;
        bestCls = c;
      }
    }
    return bestCls;
  }
}

// トラッカー管理
class Tracker {
  constructor(opts){
    this.tracks = [];
    this.nextId = 1;
    this.iouThreshold = opts.iouThreshold ?? 0.4;
    this.minHits = 1; 
    this.maxLostAge = opts.maxLostAge ?? 30;
    this.onConfirmed = opts.onConfirmed ?? (()=>{});
    this.onRemoved   = opts.onRemoved   ?? (()=>{});
  }

  static iou(a, b){
    const [x1,y1,w1,h1] = a;
    const [x2,y2,w2,h2] = b;
    const left = Math.max(x1, x2);
    const top  = Math.max(y1, y2);
    const right = Math.min(x1 + w1, x2 + w2);
    const bottom= Math.min(y1 + h1, y2 + h2);
    const iw = Math.max(0, right - left);
    const ih = Math.max(0, bottom - top);
    const inter = iw * ih;
    const union = (w1*h1) + (w2*h2) - inter;
    return union > 0 ? inter/union : 0;
  }

  updateWithDetections(dets) {
    const matches = [];
    const unmatchedDets = new Set(dets.map((_, i) => i));
    const unmatchedTracks = new Set(this.tracks.map((_, i) => i));

    const iouPairs = [];
    for (let ti = 0; ti < this.tracks.length; ti++) {
      for (let di = 0; di < dets.length; di++) {
        const score = Tracker.iou(this.tracks[ti].bbox, dets[di].bbox);
        if (score >= this.iouThreshold) {
          iouPairs.push({ ti, di, score });
        }
      }
    }
    iouPairs.sort((a, b) => b.score - a.score);
    for (const p of iouPairs) {
      if (unmatchedTracks.has(p.ti) && unmatchedDets.has(p.di)) {
        matches.push(p);
        unmatchedTracks.delete(p.ti);
        unmatchedDets.delete(p.di);
      }
    }

    const distPairs = [];
    const MAX_DIST_REL = 0.2; 

    const W = DOM.canvas.width || 1;
    const H = DOM.canvas.height || 1;
    const norm = Math.sqrt(W * W + H * H); 

    for (const ti of unmatchedTracks) {
      const tr = this.tracks[ti];
      const c1 = tr.center();
      
      for (const di of unmatchedDets) {
        const d = dets[di];
        const cx = d.bbox[0] + d.bbox[2] / 2;
        const cy = d.bbox[1] + d.bbox[3] / 2;
        
        const dist = Math.sqrt((c1.x - cx) ** 2 + (c1.y - cy) ** 2);
        const relDist = dist / norm;

        if (relDist < MAX_DIST_REL) {
          distPairs.push({ ti, di, score: 1.0 - relDist });
        }
      }
    }

    distPairs.sort((a, b) => b.score - a.score);
    for (const p of distPairs) {
      if (unmatchedTracks.has(p.ti) && unmatchedDets.has(p.di)) {
        matches.push(p);
        unmatchedTracks.delete(p.ti);
        unmatchedDets.delete(p.di);
      }
    }

    for (const m of matches) {
      const tr = this.tracks[m.ti];
      const det = dets[m.di];
      tr.update(det);
      if (tr.state === "tentative" && tr.hitStreak >= this.minHits) {
        tr.state = "confirmed";
        this.onConfirmed(tr);
      }
    }

    for (const di of unmatchedDets) {
      const det = dets[di];
      const tr = new Track(this.nextId++, det);
      this.tracks.push(tr);
    }

    for (const ti of unmatchedTracks) {
      this.tracks[ti].lostAge++;
    }

    const kept = [];
    for (const tr of this.tracks) {
      if (tr.lostAge <= this.maxLostAge) {
        kept.push(tr);
      } else {
        this.onRemoved(tr);
      }
    }
    this.tracks = kept;
  }
}

let tracker = null;

// カウント・ログ記録処理
function isVehicleClass(cls){
  return VEHICLE_CATS.includes(cls);
}

function recordEvent() {
  const now = new Date();
  const snapshot = { ...countsCurrentHour };
  
  const row = {
    timestamp: formatTimestamp(now),
    ...snapshot,
    total_counted_mode: getCountedTotalByMode(snapshot)
  };

  recordsHourly.push(row);
  updateLogDisplay(); 
}

function countUp(cls){
  if(!UI_CATS.includes(cls)) return;
  countsCurrentHour[cls] += 1;
  updateCountUI();
  updateHourTitle();
  
  recordEvent();
}

function applyCountByMode(cls){
  if(countMode === "pedestrian"){
    if(cls === "person") countUp("person");
    return;
  }
  if(isVehicleClass(cls)) countUp(cls);
}

// ROI内判定・カウントロジック
function updateRoiCountingForConfirmedTracks(){
  const r_orig = getRoiPx(); 
  const factor = DOM.hitArea ? (1.0 - Number(DOM.hitArea.value)) : 1.0; 

  const centroid = r_orig.reduce((a, b) => ({x: a.x + b.x/4, y: a.y + b.y/4}), {x:0, y:0});
  
  const r = r_orig.map(p => ({
    x: centroid.x + (p.x - centroid.x) * factor,
    y: centroid.y + (p.y - centroid.y) * factor
  }));

  for(const tr of tracker.tracks){
    if(tr.state !== "confirmed" || tr.counted) continue;
    if(tr.lostAge > 0) continue;

    const c = tr.center();
    const prev = tr.prevCenter;

    let isMoving = true;
    if(prev){
       const dist = Math.sqrt((c.x - prev.x)**2 + (c.y - prev.y)**2);
       if(dist < 2.0) isMoving = false; 
    }

    let inRoi = isPointInPolygon(c, r);
    
    if(inRoi && !isMoving) continue;

    let isWarp = false;
    if(!inRoi && prev){
      isWarp = isLineIntersectingPolygon(prev, c, r);
    }

    if(inRoi || isWarp){
      tr.voteRoi(tr.cls, tr.score); 
      if(isWarp) tr.warpDetected = true;
      tr.consecutiveOutsideRoi = 0;
    } else {
      tr.consecutiveOutsideRoi++;
      if(tr.consecutiveOutsideRoi >= 2){
         if(tr.totalFramesInRoi >= 2 || tr.warpDetected){
            const winner = tr.getWinnerClass();
            applyCountByMode(winner);
            tr.counted = true;
         }
      }
    }
  }
}
function onTrackRemoved(tr){
  if(!tr.counted){
    if(tr.totalFramesInRoi >= 2 || tr.warpDetected){
      const winner = tr.getWinnerClass();
      applyCountByMode(winner);
      tr.counted = true;
    }
  }
}

function filterDetectionsByMode(rawDets){
  if(countMode === "pedestrian"){
    return rawDets.filter(d => d.cls === "person");
  }

  const vehicles = rawDets.filter(d => VEHICLE_CATS.includes(d.cls));
  return vehicles;
}

function progressFake(percent){
  if(DOM.loadingProg) DOM.loadingProg.value = percent;
  if(DOM.loadingPerc) DOM.loadingPerc.textContent = percent + "%";
}

// アプリケーション初期化
window.addEventListener("load", init);

async function init(){
  try{
    removeSettingsInfoMark();    
    setupTitleDescription();     
    injectModeInactiveStyle();   

    applyModeUiState();
    setupSettingItemHelpPopups();
    
    tf.env().set('WEBGL_PACK', false);
    tf.env().set('WEBGL_CONV_IM2COL', false);

    progressFake(5);
    
    await tf.ready();

    if(tf.getBackend() !== 'webgl'){
       try{ await tf.setBackend('webgl'); }catch(e){ console.warn(e); }
    }

    progressFake(35);
    
    model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });

    progressFake(100);
    setTimeout(()=>DOM.status.classList.add("hidden"), 500);

    await setupCamera();

    await getGeolocation().catch(err=>{
      console.warn("Initial geolocation failed:", err?.message || err);
      toast("位置情報の自動取得に失敗しました", true);
    });

    setupEventListeners();
    setupTracker();
    updateHourTitle();
    updateLogTableVisibility();
    mainRenderLoop();

    DOM.toggleBtn.disabled = false;
    
  }catch(err){
    console.error(err);
    const errStr = String(err?.message || err || "");
    let userMsg = `${errStr}`;

    if(errStr.includes("Permission denied") || errStr.includes("NotAllowedError")){
      userMsg = "カメラの利用が許可されていません。";
    } else if(errStr.includes("device") || errStr.includes("found")){
      userMsg = "カメラが見つかりません。";
    } else if(errStr.includes("WebGL")){
      userMsg = "AIの起動に失敗しました(WebGLエラー)";
    }

    toast(userMsg, true);
    
    const loadingText = document.getElementById("loading-model");
    if(loadingText) loadingText.textContent = "起動エラー";
  }
}

// イベントリスナー設定
function setupEventListeners(){
  DOM.toggleBtn.addEventListener("click", toggleAnalysis);

  if(DOM.countModeSelect){
    DOM.countModeSelect.value = normalizeMode(countMode);

    DOM.countModeSelect.addEventListener("change", ()=>{
      countMode = normalizeMode(DOM.countModeSelect.value);
      try{ localStorage.setItem(LS_KEY_MODE, countMode); }catch(_e){}
      applyModeUiState();
      updateCountUI();
      updateHourTitle();
      setupSettingItemHelpPopups();
      updateLogTableVisibility();

      if(isAnalyzing) setupTracker();
    });
  }

  DOM.reserveBtn.addEventListener("click", handleReservation);
  
  const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => adjustCanvasSize());
  });
  if(DOM.videoContainer) resizeObserver.observe(DOM.videoContainer);

  ["max-lost","score-th","max-fps"].forEach(id=>{
    document.getElementById(id).addEventListener("change", ()=>{
      if(isAnalyzing) setupTracker();
    });
  });

  setupTabs();
  setupRoiDrag(); 
}


function setupTabs(){
  const tabs = document.querySelectorAll(".tab-link");
  const contents = document.querySelectorAll(".tab-content");
  tabs.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const key = btn.dataset.tab;
      tabs.forEach(t=>t.classList.remove("active"));
      contents.forEach(c=>c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${key}`).classList.add("active");
    });
  });
}

// 測定開始・停止制御
function toggleAnalysis(){
  isAnalyzing = !isAnalyzing;
  if(isAnalyzing) startAnalysis();
  else stopAnalysis();
}

function startAnalysis(){
  DOM.toggleBtn.textContent = "終了";
  DOM.toggleBtn.classList.replace("btn-green", "btn-red");
  DOM.canvas.classList.add("analyzing");

  setupTracker();
 
  countsCurrentHour = zeroCounts();
  recordsHourly = [];

  analysisStartTime = new Date();
  hourWindowStart = new Date();

  updateCountUI();
  updateHourTitle();
  updateLogDisplay(true);

  recordEvent();            

  lastInferTime = 0;
}

function stopAnalysis(){
  DOM.toggleBtn.textContent = "開始";
  DOM.toggleBtn.classList.replace("btn-red", "btn-green");
  DOM.canvas.classList.remove("analyzing");

  if(recordsHourly.length > 0){
    exportCSV(recordsHourly, geo); 
  }

  countsCurrentHour = zeroCounts();
  recordsHourly = [];
  
  analysisStartTime = null; 
  hourWindowStart = null;

  updateCountUI();
  updateHourTitle(); 
  updateLogDisplay(true);
  mainRenderLoop();
}

// 予約測定機能
async function handleReservation(){
  try{
    await getGeolocation();
    applySchedule();
  }catch(e){
    toast("位置情報取得が必要です", true);
  }
}

function applySchedule(){
  if(scheduleTimerStart) clearTimeout(scheduleTimerStart);
  if(scheduleTimerEnd) clearTimeout(scheduleTimerEnd);

  const start = DOM.startDt.value ? new Date(DOM.startDt.value) : null;
  const end   = DOM.endDt.value ? new Date(DOM.endDt.value) : null;
  const now = new Date();

  let scheduled = false;

  if(start && start > now){
    scheduleTimerStart = setTimeout(()=>{ if(!isAnalyzing) toggleAnalysis(); }, start - now);
    scheduled = true;
  }

  if(end && (!start || end > start)){
    scheduleTimerEnd = setTimeout(()=>{ if(isAnalyzing) toggleAnalysis(); }, Math.max(0, end - now));
    scheduled = true;
  }

  if(scheduled) toast("予約が完了しました");
  else toast("予約可能な日時が設定されていません", true);
}

// 位置情報取得
function getGeolocation(){
  return new Promise((resolve, reject)=>{
    if(!navigator.geolocation){
      DOM.geoLat.textContent = "非対応";
      DOM.geoLng.textContent = "非対応";
      reject(new Error("ブラウザが位置情報取得に非対応です"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos=>{
        geo.lat = pos.coords.latitude.toFixed(6);
        geo.lng = pos.coords.longitude.toFixed(6);
        DOM.geoLat.textContent = geo.lat;
        DOM.geoLng.textContent = geo.lng;
        resolve(pos);
      },
      err=>{
        geo.lat = "取得失敗";
        geo.lng = "取得失敗";
        DOM.geoLat.textContent = geo.lat;
        DOM.geoLng.textContent = geo.lng;
        reject(err);
      },
      { enableHighAccuracy:true, timeout:8000, maximumAge:60000 }
    );
  });
}

// カメラ・キャンバス設定
async function setupCamera(){
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } },
    audio: false
  });
  DOM.video.srcObject = stream;
  return new Promise(resolve=>{
    DOM.video.onloadedmetadata = ()=>{
      DOM.video.play();
      adjustCanvasSize();
      resolve();
    };
  });
}

function adjustCanvasSize(){
  const w = DOM.video.videoWidth;
  const h = DOM.video.videoHeight;
  if(!w || !h) return;

  DOM.canvas.width = w;
  DOM.canvas.height = h;

  if(DOM.videoContainer) {
    DOM.videoContainer.style.aspectRatio = `${w} / ${h}`;
  }
  
  DOM.video.style.objectFit = "contain";
  DOM.canvas.style.objectFit = "contain";

  DOM.canvas.style.width = "100%";
  DOM.canvas.style.height = "100%";

  const infoPanel = document.getElementById("info-panel");
  if (infoPanel) {
    const isPC = window.matchMedia("(min-width: 1024px)").matches;
    
    if (isPC && DOM.videoContainer) {
      const videoBottom = DOM.videoContainer.getBoundingClientRect().bottom;
      
      const panelTop = infoPanel.getBoundingClientRect().top;
      
      const targetHeight = Math.floor(videoBottom - panelTop) - 2;
      
      infoPanel.style.height = `${Math.max(0, targetHeight)}px`;
      
    } else {
      infoPanel.style.height = "";
    }
  }
}


// トラッカー初期化
function setupTracker(){
  tracker = new Tracker({
    iouThreshold: 0.4,
    maxLostAge: Number(DOM.maxLost.value),

    onConfirmed: (tr)=>{
      if(countLogic !== "classic") return;
      applyCountByMode(tr.cls);
    },

    onRemoved: (tr)=> onTrackRemoved(tr),
  });
}

// メインレンダリングループ
function mainRenderLoop() {
  const ctx = DOM.ctx;

  ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);

  if (isAnalyzing) {
    const interval = 1000 / Number(DOM.maxFps.value);
    const now = performance.now();

    if (!isModelBusy && (now - lastInferTime >= interval)) {
      lastInferTime = now;
      isModelBusy = true; 

      model.detect(DOM.video).then(preds => {
        const scoreTh = Number(DOM.scoreTh.value);
        const raw = preds.filter(p => UI_CATS.includes(p.class) && p.score >= scoreTh)
                         .map(p => ({ bbox: p.bbox, score: p.score, cls: p.class }));
        
        const dets = filterDetectionsByMode(raw);
        tracker.updateWithDetections(dets);
        updateRoiCountingForConfirmedTracks(); 
      })
      .finally(() => {
         isModelBusy = false; 
      });
    }
    drawAllOverlays(ctx); 
  }

  drawRoi(ctx);

  requestAnimationFrame(mainRenderLoop);
}

// 検出枠描画
function drawAllOverlays(ctx) {
  ctx.save();
  ctx.font = "14px Segoe UI, Arial";
  ctx.lineWidth = 2;
  const color = { car:"#1e88e5", bus:"#43a047", truck:"#fb8c00", motorcycle:"#8e24aa", bicycle:"#fdd835", person:"#e53935" };

  for(const tr of tracker.tracks){
    if(tr.state !== "confirmed") continue;

    const [x,y,w,h] = tr.bbox;
    const cls = tr.cls;

    if(countMode === "vehicle" && cls === "person") continue;
    if(countMode === "pedestrian" && cls !== "person") continue;

    const c = color[cls] || "#fff";

    if (tr.lostAge > 0) {
      ctx.globalAlpha = 0.5;
    } else {
      ctx.globalAlpha = 1.0;
    }

    ctx.strokeStyle = c;
    ctx.strokeRect(x,y,w,h);
    
    const label = `${cls} ${Math.floor(tr.score*100)}%`; 

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x, Math.max(0, y-18), ctx.measureText(label).width + 6, 18);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x+3, Math.max(10, y-4));
    
    ctx.globalAlpha = 1.0;
  }
  ctx.restore();
}

// ログテーブル表示制御
function updateLogTableVisibility() {
  const table = document.getElementById("log-table");
  if (!table) return;

  table.classList.remove("is-loading");

  const ths = table.querySelectorAll("thead th");
  
  if (countMode === "pedestrian") {
    for (let i = 1; i <= 5; i++) ths[i].style.display = "none";
    ths[6].style.display = "table-cell";
  } else {
    for (let i = 1; i <= 5; i++) ths[i].style.display = "table-cell";
    ths[6].style.display = "none";
  }

  rebuildLogTable(); 
}

function rebuildLogTable() {
  DOM.logBody.innerHTML = "";
  [...recordsHourly].reverse().forEach(row => {
    insertLogRow(row);
  });
}

function insertLogRow(row, prepend=false){
  const tr = document.createElement("tr");
  
  const timeCell = `<td>${row.timestamp.split(" ")[1]}</td>`;
  let cells = "";

  if(countMode === "pedestrian"){
    cells = timeCell + `<td>${row.person || 0}</td>`;
  } else {
    cells = timeCell + 
      `<td>${row.car || 0}</td>` +
      `<td>${row.bus || 0}</td>` +
      `<td>${row.truck || 0}</td>` +
      `<td>${row.motorcycle || 0}</td>` +
      `<td>${row.bicycle || 0}</td>`;
  }

  tr.innerHTML = cells;

  if(prepend){
    DOM.logBody.prepend(tr);
  } else {
    DOM.logBody.appendChild(tr);
  }
}

function updateLogDisplay(clear=false){
  if(clear){
    DOM.logBody.innerHTML = "";
    return;
  }
  const last = recordsHourly[recordsHourly.length-1];
  if(!last) return;

  insertLogRow(last, true);
  
  while(DOM.logBody.children.length > MAX_LOGS){
    DOM.logBody.lastChild?.remove();
  }
}

function updateHourTitle(){
  if (!analysisStartTime) {
    DOM.hourTitle.textContent = "測定待機中";
    return;
  }

  const d = analysisStartTime;
  const h = String(d.getHours()).padStart(2,"0");
  const m = String(d.getMinutes()).padStart(2,"0");
  const s = String(d.getSeconds()).padStart(2,"0");
  const timeStr = `${h}:${m}:${s}`;

  if(countMode === "pedestrian"){
    DOM.hourTitle.textContent = `${timeStr}~の通行量`;
    return;
  }

  const total = getCountedTotalByMode(countsCurrentHour);
  DOM.hourTitle.textContent = `${timeStr}~の交通量：計${total}台`;
}

function updateCountUI(){
  for(const k of UI_CATS){
    DOM.count[k].textContent = countsCurrentHour[k];
  }
}

// CSVエクスポート
async function exportCSV(data, geo, unknown){
  if(!data || data.length === 0){
    toast("出力するデータがありません", true);
    return;
  }

  const endTime = new Date();
  const noun = modeNoun();

  const getUiText = (el) => {
    if(el && el.options && el.selectedIndex >= 0){
      return el.options[el.selectedIndex].text;
    }
    return "";
  };

  const metadata = [
    `緯度: ${geo.lat}`,
    `経度: ${geo.lng}`,
    `期間: ${formatTimestamp(analysisStartTime || new Date())} - ${formatTimestamp(endTime)}`,
    `測定対象: ${getUiText(DOM.countModeSelect)}`,
    `判定中心幅: ${getUiText(DOM.hitArea)}`,
    `検知感度: ${getUiText(DOM.scoreTh)}`,
    `解析頻度: ${getUiText(DOM.maxFps)}`,
    `見失い猶予: ${getUiText(DOM.maxLost)}`,
  ].join("\n");

  let header = "";
  let rows = "";

  if(countMode === "pedestrian"){
    header = "日時,歩行者\n"; 
    
    rows = data.map(r => {
      const person = r.person ?? 0;
      return `"${r.timestamp}",${person}`;
    }).join("\r\n");

  } else {
    header = "日時,乗用車,バス,トラック,バイク,自転車,合計\n";
    
    rows = data.map(r => {
      const car   = r.car ?? 0;
      const bus   = r.bus ?? 0;
      const truck = r.truck ?? 0;
      const moto  = r.motorcycle ?? 0;
      const bici  = r.bicycle ?? 0;

      const total = car + bus + truck + moto + bici;

      return `"${r.timestamp}",${car},${bus},${truck},${moto},${bici},${total}`;
    }).join("\r\n");
  }

  const csv = `\uFEFF${metadata}\n${header}${rows}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const name = fileNameFromDate(analysisStartTime || new Date(), noun);
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast(`CSVファイル（${noun}）「${name}」を出力しました`);
}

function fileNameFromDate(d, noun){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  const h = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  const s = String(d.getSeconds()).padStart(2,"0");
  const kind = (noun === "通行量") ? "通行量" : "交通量";
  return `${kind}_${y}${m}${da}_${h}${mi}${s}.csv`;
}

// ユーティリティ関数
function toast(msg, isError=false){
  if(!DOM.toast){
    console.warn("[toast] element not found:", msg);
    return;
  }
  DOM.toast.textContent = msg;
  DOM.toast.style.backgroundColor = isError ? "rgba(229,57,53,.85)" : "rgba(0,0,0,.8)";
  DOM.toast.classList.remove("hidden");
  setTimeout(()=>DOM.toast.classList.add("hidden"), 3000);
}

function formatTimestamp(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  const h = String(d.getHours()).padStart(2,"0");
  const mi = String(d.getMinutes()).padStart(2,"0");
  const s = String(d.getSeconds()).padStart(2,"0");
  return `${y}/${m}/${da} ${h}:${mi}:${s}`;
}

// ROIロック機能
(function lockRoiAfterStartPatch(){
  try{
    const _startAnalysis = startAnalysis;
    startAnalysis = function(){
      window.roiLocked = true;
      return _startAnalysis.apply(this, arguments);
    };

    const _stopAnalysis = stopAnalysis;
    stopAnalysis = function(){
      const r = _stopAnalysis.apply(this, arguments);
      window.roiLocked = false;
      return r;
    };

    const c = DOM.canvas;
    if(!c) return;

    const blockIfLocked = (ev)=>{
      if(DOM.videoContainer && DOM.videoContainer.classList.contains("is-floating")){
        return; 
      }

      if(isAnalyzing && window.roiLocked === true){
        
        const rect = c.getBoundingClientRect();
        const scale = (c.width || 1) / rect.width; 
        
        const mx = (ev.clientX - rect.left) * scale;
        const my = (ev.clientY - rect.top) * scale;
        
        const pts = getRoiPx(); 
        let isHit = false;
        
        const hitRadius = 40 * scale; 

        for(const p of pts){
           const dist = Math.sqrt((mx - p.x)**2 + (my - p.y)**2);
           if(dist < hitRadius){
             isHit = true;
             break;
           }
        }

        if(isHit){
           ev.preventDefault();
           ev.stopImmediatePropagation();
           
           if(ev.type === "pointerdown"){
             toast("測定中は測定枠を変更できません");
           }
        }
      }
    };

    c.addEventListener("pointerdown", blockIfLocked, true);
    c.addEventListener("pointermove", blockIfLocked, true);
    c.addEventListener("pointerup",   blockIfLocked, true);
    
    window.roiLocked = false;

  }catch(e){
    console.warn("ROI lock patch failed:", e);
  }
})();

// 設定無効化機能
(function disableSettingsWhileRunningPatch(){
  try{
    const SETTINGS_IDS = [
      "count-mode",
      "hit-area", 
      "score-th",
      "max-lost",
      "max-fps",
      "auto-start-dt",
      "auto-end-dt",
      "reserve-btn",
    ];

    const getEls = ()=> SETTINGS_IDS
      .map(id=>document.getElementById(id))
      .filter(Boolean);

    if(!document.getElementById("disable-settings-style")){
      const st = document.createElement("style");
      st.id = "disable-settings-style";
      st.textContent = `
        #settings-panel .settings-grid.is-locked{
          opacity: .55;
          filter: grayscale(100%);
          pointer-events: none; 
        }
      `;
      document.head.appendChild(st);
    }

    function setLocked(locked){
      const els = getEls();
      els.forEach(el=>{
        if("disabled" in el) el.disabled = !!locked;
      });

      const grid = document.querySelector("#settings-panel .settings-grid");
      if(grid) grid.classList.toggle("is-locked", !!locked);
    }

    const _start = startAnalysis;
    startAnalysis = function(){
      setLocked(true);
      return _start.apply(this, arguments);
    };

    const _stop = stopAnalysis;
    stopAnalysis = function(){
      const r = _stop.apply(this, arguments);
      setLocked(false);
      return r;
    };

    setLocked(false);
  }catch(e){
    console.warn("Disable settings patch failed:", e);
  }
})();

// スリープ抑止機能
(function wakeLockPatch(){
  let wakeLock = null;

  async function requestWakeLock(){
    try{
      if(!("wakeLock" in navigator) || !navigator.wakeLock?.request){
        return false;
      }
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", ()=>{
        wakeLock = null;
      });
      return true;
    }catch(e){
      console.warn("WakeLock request failed:", e);
      wakeLock = null;
      return false;
    }
  }

  async function releaseWakeLock(){
    try{
      if(wakeLock){
        await wakeLock.release();
        wakeLock = null;
      }
    }catch(e){
      console.warn("WakeLock release failed:", e);
    }
  }

  document.addEventListener("visibilitychange", async ()=>{
    if(document.visibilityState === "visible" && (isAnalyzing === true)){
      await requestWakeLock();
    }
  });

  const _start = startAnalysis;
  startAnalysis = function(){
    requestWakeLock().then(ok=>{
      if(!ok) toast("スリープ抑止が非対応の端末です");
    });
    return _start.apply(this, arguments);
  };

  const _stop = stopAnalysis;
  stopAnalysis = function(){
    releaseWakeLock();
    return _stop.apply(this, arguments);
  };
})();

// データバックアップ・復旧機能
(function crashProtectionPatch() {
  const BACKUP_KEY = "trafficCounter_crash_backup_v1";
  let isResumed = false; 
  let backupInterval = null;

  let saveDebounceTimer = null; 

  const _updateCountUI = updateCountUI;
  updateCountUI = function() {
    _updateCountUI.apply(this, arguments);
    try {
      
      if(saveDebounceTimer) clearTimeout(saveDebounceTimer);
      saveDebounceTimer = setTimeout(saveBackup, 1000); 

    } catch(e) {}
  };

  window.addEventListener("pagehide", () => {
    if(saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveBackup();
  });

  function saveBackup() {
    if (!isAnalyzing && !isResumed) return;

    try {
      const data = {
        savedAt: Date.now(),
        countsCurrentHour,
        recordsHourly,
        analysisStartTime: analysisStartTime ? analysisStartTime.getTime() : null,
        hourWindowStart: hourWindowStart ? hourWindowStart.getTime() : null,
        countMode
      };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Backup failed:", e);
    }
  }

  function loadBackup() {
    try {
      const json = localStorage.getItem(BACKUP_KEY);
      if (!json) return false;

      const data = JSON.parse(json);
      
      countsCurrentHour = data.countsCurrentHour || zeroCounts();
      recordsHourly = data.recordsHourly || [];
      
      if (data.analysisStartTime) analysisStartTime = new Date(data.analysisStartTime);
      if (data.hourWindowStart) hourWindowStart = new Date(data.hourWindowStart);

      if (data.countMode) {
        countMode = data.countMode;
        if(DOM.countModeSelect) DOM.countModeSelect.value = normalizeMode(countMode);
        try{ applyModeUiState(); }catch(e){}
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearBackup() {
    try { localStorage.removeItem(BACKUP_KEY); } catch(e) {}
  }

  if (loadBackup()) {
    isResumed = true;
    window.addEventListener("load", () => {
       updateCountUI(); 
       rebuildLogTable(); 
       toast("前回のデータを復元しました。\n「開始」で測定を再開します。", true);

       const modeSel = document.getElementById("count-mode");
       if(modeSel) modeSel.disabled = true;
    });
  }

  const _start = startAnalysis;
  startAnalysis = function() {
    if (isResumed) {
      const savedData = {
        c: countsCurrentHour,
        rh: recordsHourly,
        as: analysisStartTime,
        hw: hourWindowStart
      };

      const ret = _start.apply(this, arguments);

      countsCurrentHour = savedData.c;
      recordsHourly = savedData.rh;
      analysisStartTime = savedData.as;
      hourWindowStart = savedData.hw;

      isResumed = false;
      updateCountUI(); 
      rebuildLogTable(); 
      
      updateHourTitle(); 

      toast("中断箇所から測定を再開しました");
      saveBackup();
      startBackupLoop();
      return ret;

    } else {
      const ret = _start.apply(this, arguments);
      saveBackup(); 
      startBackupLoop();
      return ret;
    }
  };

  const _stop = stopAnalysis;
  stopAnalysis = function() {
    stopBackupLoop();
    clearBackup(); 
    return _stop.apply(this, arguments);
  };

  const _exportCSV = exportCSV;
  exportCSV = async function() {
    try {
      await _exportCSV.apply(this, arguments);
      
      clearBackup(); 
    } catch (e) {
      console.error("CSV出力エラー:", e);
      toast("出力に失敗したため、データを保持します", true);
    }
  };

  function startBackupLoop() {
    if (backupInterval) clearInterval(backupInterval);
    backupInterval = setInterval(saveBackup, 60000); 
  }

  function stopBackupLoop() {
    if (backupInterval) { clearInterval(backupInterval); backupInterval = null; }
  }

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'hidden') saveBackup();
  });
  window.addEventListener("pagehide", saveBackup);
  window.addEventListener("beforeunload", saveBackup);

})();

// フローティングプレーヤー機能
(function floatingPlayerPatch(){
  const container = document.getElementById("video-container");
  if(!container) return;

  const closeBtn = document.getElementById("close-float-btn"); 
  let isClosedManually = false;

  if(closeBtn){
    closeBtn.style.pointerEvents = "auto";

    closeBtn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      disableFloating();
      isClosedManually = true;
    });
    
    closeBtn.addEventListener("pointerdown", (e)=> e.stopPropagation());
  }

  function disableFloating(){
    container.classList.remove("is-floating");
    
    const ph = document.getElementById("video-placeholder");
    if(ph) ph.style.display = "none";
    
    container.style.transform = "";
    container.style.left = "";
    container.style.top = "";
    container.style.bottom = "";
    container.style.right = "";
    container.style.width = "";
    container.style.height = "";
  }

  let placeholder = document.getElementById("video-placeholder");
  if(!placeholder){
    placeholder = document.createElement("div");
    placeholder.id = "video-placeholder";
    placeholder.style.display = "none";
    placeholder.style.width = "100%";
    container.parentNode.insertBefore(placeholder, container);
  }

  let sentinel = document.getElementById("video-sentinel");
  if(!sentinel){
    sentinel = document.createElement("div");
    sentinel.id = "video-sentinel";
    sentinel.style.height = "1px";
    sentinel.style.width = "100%";
    sentinel.style.marginTop = "-1px";
    sentinel.style.visibility = "hidden";
    sentinel.style.pointerEvents = "none";
    container.parentNode.insertBefore(sentinel, container.nextSibling);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(container.offsetHeight > 0 && !container.classList.contains("is-floating")){
         placeholder.style.height = container.offsetHeight + "px";
      }

      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
        if (!isClosedManually && !container.classList.contains("is-floating")) {
          placeholder.style.display = "block"; 
          container.classList.add("is-floating");
          container.style.bottom = "20px";
          container.style.right = "20px";
          container.style.width = "45vw"; 
        }
      } else {
        isClosedManually = false;
        if (container.classList.contains("is-floating")) {
          disableFloating();
        }
      }
    });
  }, { threshold: 0 });

  observer.observe(sentinel);

  let isDragging = false;
  let startX, startY, startLeft, startTop;

  container.addEventListener("pointerdown", (e) => {
    if (!container.classList.contains("is-floating")) return;
    if (e.target === closeBtn || closeBtn.contains(e.target)) return;

    e.preventDefault(); 
    e.stopPropagation();

    isDragging = true;
    
    startX = e.clientX;
    startY = e.clientY;

    const rect = container.getBoundingClientRect();
    
    container.style.bottom = "auto";
    container.style.right = "auto";
    container.style.left = rect.left + "px";
    container.style.top = rect.top + "px";
    container.style.width = rect.width + "px"; 

    startLeft = rect.left;
    startTop = rect.top;
    
    try{ container.setPointerCapture(e.pointerId); }catch(_){}
  });

  container.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    e.preventDefault(); 

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    container.style.left = `${startLeft + dx}px`;
    container.style.top = `${startTop + dy}px`;
  });

  const stopDrag = (e) => {
    if(!isDragging) return;
    isDragging = false;
    try{ container.releasePointerCapture(e.pointerId); }catch(_){}
  };

  container.addEventListener("pointerup", stopDrag);
  container.addEventListener("pointercancel", stopDrag);

})();
