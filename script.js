/* =========================
   スマート交通量カウンター
   ========================= */

const UI_CATS = ['car','bus','truck','motorcycle','bicycle','person'];
const VEHICLE_CATS = ['car','bus','truck','motorcycle','bicycle'];

// DOM
const DOM = {
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

/* ========= 共通モーダル（alert置換） =========
   - 127.0.0.1:xxxx のようなブラウザ標準タイトルを出さない
   - 枠外クリック/タップで閉じる（OKボタンなし）
*/
let INFO_MODAL = { overlay:null, title:null, body:null };

function ensureInfoModal(){
  if(INFO_MODAL.overlay) return;

  // style（最小限。既存CSSを崩さない）
  if(!document.getElementById("info-modal-style")){
     const st = document.createElement("style");
     st.id = "info-modal-style";
     st.textContent = `
      .info-modal-overlay{
        position:fixed; inset:0;
        background: rgba(0,0,0,0.5); /* 背景の暗さを少し強めてモーダルを目立たせる */
        display:none;
        align-items:center;
        justify-content:center;
        z-index: 9999;
        padding: 16px;
      }
      .info-modal{
        width: min(640px, 90vw);  /* 96vwだと端すぎるので90vwに */
        max-height: 80vh;         /* 520px制限を撤廃し、画面の80%まで広げる */
        background: #ffffff;      /* 白背景 */        color: #333;              /* 黒文字 */
        border-radius: 14px;
        border: none;             /* 白背景ならボーダーなしで影だけで十分綺麗 */
        box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        overflow: hidden;
        display:flex;
        flex-direction: column;
      }
      .info-modal-header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding: 8px 16px;       /* 余白を少し調整 */
        border-bottom: 1px solid #eee; /* 薄いグレーの区切り線 */
        font-weight: 700;
        font-size: 1.1rem;
        color: #2c3e50;           /* ヘッダー文字色を少し濃く */
      }
      .info-modal-close{
        width: 32px; height: 32px;
        border-radius: 50%;       /* 丸くする */
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

  // 枠外クリック/タップで閉じる
  overlay.addEventListener("pointerdown", (e)=>{
    if(e.target === overlay) close();
  });

  // 中身クリックで閉じない
  modal.addEventListener("pointerdown", (e)=> e.stopPropagation());

  closeBtn.addEventListener("click", close);

  // ESCでも閉じる（PC用）
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


// 画面上のカウントカード（灰色化用）
const COUNT_ITEM_EL = {};
for(const cat of UI_CATS){
  COUNT_ITEM_EL[cat] = document.querySelector(`.count-item.${cat}`);
}

function injectModeInactiveStyle(){
  if(document.getElementById("mode-inactive-style")) return;
  const st = document.createElement("style");
  st.id = "mode-inactive-style";
  // 使わない項目を「濃い灰色」で一目で分かるように
  st.textContent = `
    .count-item.inactive{
      background:#d0d0d0 !important;
      color:#666 !important;
      border-left-color:#777 !important;
      opacity:0.9;
      filter:grayscale(100%);
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

/* ========= （合計表示のUIコードは削除しました） ========= */

// この関数だけは計算に必要なので残します
function getCountedTotalByMode(counts){
  if(countMode === "pedestrian"){
    return Number(counts.person || 0);
  }
  // vehicleモード
  return VEHICLE_CATS.reduce((s,k)=>s + Number(counts[k] || 0), 0);
}

function setupTitleDescription(){
  const title = DOM.appTitle;
  if(!title) return;

  // 以前の説明テキスト（span.app-desc）が残っていれば消す
  const oldDesc = title.querySelector(".app-desc");
  if(oldDesc) oldDesc.remove();

  // すでに追加済みなら終了
  if(title.querySelector(".title-info-btn")) return;

  // 最小限のCSS（見た目を大きく変えない）
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

  // ★修正箇所：変数名を変更し、クリックイベントを追加
  const APP_GUIDE_TEXT = `【概要】
・AIがカメラ映像から車両5種(乗用車・バス・トラック・バイク・自転車)と歩行者を判別し、リアルタイムで集計を行う。
・解析はブラウザ内で完結し、映像の送信や録画は行わないため機密性が高い。
・データは1時間ごと、および終了時に位置情報付きCSVファイルとして保存される。

【測定エリア(枠)の設定】
・画面上の測定枠をドラッグして、測定したいエリア(位置)に合わせる。
・対象が測定枠を通過した際、または枠内での検知が終了した時点でカウントされる。
・道路を横切るように測定エリアを設置すると精度が向上する。

【測定中の注意】
・開始後は誤操作防止のため、測定枠の移動や設定変更がロックされる。
・処理停止を防ぐため、他アプリへの切り替えや画面スリープは避ける。
・バッテリー消費が激しいため、充電しながらの使用を推奨する。`;

  btn.addEventListener("click", (e)=>{
    e.preventDefault();
    e.stopPropagation();
    showInfoModal("利用ガイド", APP_GUIDE_TEXT);
  });

  title.appendChild(btn);
}

/* ========= 設定項目ヘルプ（各項目横のiボタン） ========= */
function setupSettingItemHelpPopups(){
  // 1) 最小限のCSSをJS側で注入（style.cssの見た目を崩さない）
  if(!document.getElementById("setting-help-style")){
    const st = document.createElement("style");
    st.id = "setting-help-style";
    st.textContent = `
      /* 配置修正: width100%にして左右に振り分け */
      #settings-panel .setting-label-row{
        display:flex; 
        align-items:center; 
        justify-content:space-between; /* 左端と右端に配置 */
        width:100%; 
        margin-bottom: 2px;
      }
      /* デザイン修正: 22px, #f0f2f5 */
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

// 2) 各設定の説明（id → 日本語説明）
const HELP = {
    "count-mode":
      "測定する対象の種類。(選択肢：車両 / 歩行者)\n・車両：乗用車、バス、トラック、バイク、自転車\n・歩行者：人のみ",
    
    "hit-area": 
      "カウント対象とする、物体中心部の判定幅。(設定範囲：10~100%)\n・すり抜け(カウント漏れ)が起きる場合は値を大きくする。\n・隣の車線を誤って拾う場合は値を小さくする。",
    
    "score-th":
      "AIが物体であると判断する際の自信の度合い。(設定範囲：10~90%)\n・誤検知(看板などを車と認識)が多い場合は値を大きくする。\n・未検知(車を見逃す)が多い場合は値を小さくする。",
    
    "max-fps":
      "1秒間に行う画像解析の回数。(設定範囲：5~30fps)\n・高速な車を見逃す場合は値を大きくする。\n・スマホの発熱や電池消費を抑える場合は値を小さくする。",
     
    "max-lost":
      "物体を見失っても追跡を継続する猶予フレーム数。(設定範囲：5~30frm)\n・木や影などの遮蔽物で追跡が切れる場合は値を大きくする。\n・別の車を同一と誤認してしまう場合は値を小さくする。",
  };

  const grid = document.querySelector("#settings-panel .settings-grid");
  if(!grid) return;

  // すでに追加済みなら二重に作らない
  if(grid.dataset.helpInjected === "1") return;
  grid.dataset.helpInjected = "1";

  // 3) labelの先頭テキストを取り出して、右側にiボタンを付ける
  const labels = Array.from(grid.querySelectorAll("label"));
  labels.forEach((label)=>{
    const control = label.querySelector("input, select, textarea");
    const id = control?.id;
    if(!id || !HELP[id]) return;

    // label内の最初のテキストノード（項目名）を抽出
    let titleText = "";
    for(const n of Array.from(label.childNodes)){
      if(n.nodeType === Node.TEXT_NODE){
        const t = (n.textContent || "").replace(/\s+/g, " ").trim();
        if(t){
          titleText = t;
          // このテキストノードは置き換える
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

    // controlの直前にrowを挿入
    if(control){
      label.insertBefore(row, control);
    }else{
      label.prepend(row);
    }
  });
}



function removeSettingsInfoMark(){
  // 「設定」見出し右側のインフォマークを消す
  try{ document.getElementById("settings-info-btn")?.remove(); }catch(_e){}
}

let model = null;
let isAnalyzing = false;
let rafId = null;
let lastInferTime = 0;
let analysisStartTime = null;
let hourWindowStart = null;

let geo = { lat: "未取得", lng: "未取得" };
const MAX_LOGS = 100;

const zeroCounts = () => ({
  car: 0, bus: 0, truck: 0, motorcycle: 0, bicycle: 0, person: 0
});
let countsCurrentHour = zeroCounts();

let recordsHourly = [];
let autoSaveTimer = null;
let scheduleTimerStart = null;
let scheduleTimerEnd = null;

let lastSnapAt = 0;
let frameIndex = 0;

/* ========= モード/ロジック ========= */
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
// ロジックはROI境界2回に固定
const countLogic = "roi";

/* ========= ROI（内部保持） ========= */
// 4つの頂点を [左上, 右上, 右下, 左下] の順で保持する
let ROI_NORM = [
  {x: 0.35, y: 0.3}, {x: 0.65, y: 0.3}, 
  {x: 0.65, y: 0.7}, {x: 0.35, y: 0.7}
];
let roiLocked = false; // trueの間はROI操作を無効化（測定中に固定）
// 保存済みROIがあれば復元（UIは変えず内部設定のみ）
try{
  const saved = localStorage.getItem(LS_KEY_ROI);
  if(saved){
    const obj = JSON.parse(saved);
    // ★4つの有効な座標を持つ「配列」であるかを確認する
    if(Array.isArray(obj) && obj.length === 4 && obj.every(p => isFinite(p.x) && isFinite(p.y))){
      ROI_NORM = obj;
    }
  }
}catch(_e){}

function getRoiPx(){
  const W = DOM.canvas.width || 1;
  const H = DOM.canvas.height || 1;
  // 4点すべての正規化座標をピクセル座標に変換して配列で返す
  return ROI_NORM.map(p => ({ x: p.x * W, y: p.y * H }));
}

// キャンバス座標 ↔ ROI正規化のユーティリティ
function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

function getCanvasPoint(ev){
  const rect = DOM.canvas.getBoundingClientRect();

  // canvas内部解像度（動画ピクセル）と表示領域の比率から "contain" の実スケールを求める
  const cw = DOM.canvas.width  || 1;
  const ch = DOM.canvas.height || 1;

  const scale = Math.min(rect.width / cw, rect.height / ch);

  // contain で発生する余白（レターボックス）
  const contentW = cw * scale;
  const contentH = ch * scale;
  const offsetX = (rect.width  - contentW) / 2;
  const offsetY = (rect.height - contentH) / 2;

  // 要素左上基準 → コンテンツ左上基準へ
  const xIn = (ev.clientX - rect.left - offsetX);
  const yIn = (ev.clientY - rect.top  - offsetY);

  // コンテンツ外をクリックしたときは端に寄せる（掴みやすくする）
  const xClamped = Math.max(0, Math.min(contentW, xIn));
  const yClamped = Math.max(0, Math.min(contentH, yIn));

  // 表示座標 → canvas内部座標
  return {
    x: xClamped / scale,
    y: yClamped / scale
  };
}

function saveRoi(){
  try{ localStorage.setItem(LS_KEY_ROI, JSON.stringify(ROI_NORM)); }catch(_e){}
}

/* ========= ROI操作 ========= */
function setupRoiDrag(){
  const c = DOM.canvas;
  if(!c) return;

  let dragging = false;
  let dragIndex = -1; // 掴んでいる頂点の番号 (0〜3)

  const getHitRadius = () => {
    const rect = c.getBoundingClientRect();
    if (!rect.width) return 40;
    
    // 指の太さ（約44px）を基準に、画面サイズに合わせて自動計算する
    const displayToInternalScale = c.width / rect.width;
    return 44 * displayToInternalScale; 
  };

  const startDrag = (ev)=>{
    if(isAnalyzing || window.roiLocked === true) return;
    
    // 【ラグ解消】触れた瞬間に即ロック
    c.style.touchAction = "none"; 

    const p = getCanvasPoint(ev);
    const pts = getRoiPx();
    const HIT_RADIUS = getHitRadius();

    // どの頂点に近いか判定
    dragIndex = pts.findIndex(pt => {
      return Math.sqrt((p.x - pt.x)**2 + (p.y - pt.y)**2) < HIT_RADIUS;
    });

    if(dragIndex !== -1){
      dragging = true;
      c.classList.add("roi-active"); 
      try{ c.setPointerCapture(ev.pointerId); }catch(_e){}
      ev.preventDefault();
      ev.stopPropagation();
    } else {
      c.style.touchAction = "auto";
    }
  };

  const moveDrag = (ev)=>{
    if(!dragging || dragIndex === -1) return;
    const p = getCanvasPoint(ev);
    const W = c.width || 1;
    const H = c.height || 1;

    // 掴んでいる点だけを更新（0.0〜1.0の範囲内に制限）
    ROI_NORM[dragIndex] = {
      x: Math.max(0, Math.min(1, p.x / W)),
      y: Math.max(0, Math.min(1, p.y / H))
    };
    ev.preventDefault();
  };

  const endDrag = (ev)=>{
    if(!dragging) return;
    dragging = false;
    dragIndex = -1;

    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) {
      // 【1秒ガード】スマホの場合は1秒間オレンジ色とスクロール禁止を維持
      setTimeout(() => {
        if (!dragging) {
          c.style.touchAction = "auto";
          c.classList.remove("roi-active");
        }
      }, 1000);
    } else {
      c.style.touchAction = "auto";
      c.classList.remove("roi-active");
    }
    saveRoi();
  };

  c.addEventListener("pointerdown", startDrag, { passive: false });
  c.addEventListener("pointermove", moveDrag);
  c.addEventListener("pointerup", endDrag);
  c.addEventListener("pointercancel", endDrag);
}

/* ========= ROI描画（枠の変化：オレンジ実線＋太線） ========= */
function drawRoi(ctx){
  const pts = getRoiPx(); // ★新：4点の配列
  if(pts.length < 4) return;

  const isActive = DOM.canvas.classList.contains("roi-active");
  const mainColor = isActive ? "#ff9800" : "#ffffff"; 

  ctx.save();
  // ★新：パスを結んで四角形を塗る
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for(let i=1; i<4; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();

  ctx.fillStyle = isActive ? "rgba(255, 152, 0, 0.2)" : "rgba(255, 255, 255, 0.15)";
  ctx.fill();

  // ★新：枠線を描画
  ctx.lineWidth = isActive ? 4 : 2;
  ctx.strokeStyle = mainColor;
  if (!isActive) ctx.setLineDash([5, 5]); 
  ctx.stroke();

  // ★改良：どんな背景でも見やすい「二重円」デザインに変更
  ctx.setLineDash([]);
  pts.forEach(pt => {
    // 1. 外側の影（黒の半透明）
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();

    // 2. メインの円（オレンジまたは白）
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = mainColor;
    ctx.fill();

    // 3. 内側の中心点（白）
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

/* --- 追加：点 p が多角形 polygon 内にあるか判定 (交差数法) --- */
function isPointInPolygon(p, polygon) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    // 点pから水平に引いた線が辺と交差するか判定
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
                      (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

/* ========= 幾何計算ヘルパー（ワープ判定用） ========= */
// 線分(p1-p2)と多角形(polygon)の辺が交差するか判定
function isLineIntersectingPolygon(p1, p2, polygon) {
  for (let i = 0; i < polygon.length; i++) {
    const s1 = polygon[i];
    const s2 = polygon[(i + 1) % polygon.length]; // 0-1, 1-2, 2-3, 3-0 の順で辺を作る
    if (getLineIntersection(p1, p2, s1, s2)) return true;
  }
  return false;
}

// 2つの線分の交差判定
function getLineIntersection(p0, p1, p2, p3) {
  let s1_x = p1.x - p0.x;     let s1_y = p1.y - p0.y;
  let s2_x = p3.x - p2.x;     let s2_y = p3.y - p2.y;
  let s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
  let t = ( s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);
  return (s >= 0 && s <= 1 && t >= 0 && t <= 1);
}

/* ========= 追跡器（マルチクラス） ========= */
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

    // --- 新ロジック用変数（追加） ---
    this.prevCenter = this.center(); // ワープ判定用（前の位置）
    this.roiVotes = {};     // ROI内での投票 (本命)
    this.globalVotes = {};  // 全期間の投票 (保険)
    this.totalFramesInRoi = 0;
    this.consecutiveOutsideRoi = 0; // 連続退出カウンタ
    this.warpDetected = false;
    this.counted = false;
    
    // 作成時も1票入れておく
    this.voteGlobal(det.cls, det.score);
  }

  center(){
    const [x,y,w,h] = this.bbox;
    return { x: x + w/2, y: y + h/2 };
  }

  update(det){
    this.prevCenter = this.center(); // 更新前に現在地を保存
    this.bbox = det.bbox;
    this.score = det.score;
    this.cls = det.cls;
    this.hitStreak++;
    this.lostAge = 0;
    this.lastSeenAt = performance.now();
    
    // 毎フレーム全体投票は行う
    this.voteGlobal(det.cls, det.score);
  }

  // ROI内での投票（本命）
  voteRoi(cls, score){
    if(!this.roiVotes[cls]) this.roiVotes[cls] = 0;
    this.roiVotes[cls] += score;
    this.totalFramesInRoi++;
  }

  // 全体投票（保険）
  voteGlobal(cls, score){
    if(!this.globalVotes[cls]) this.globalVotes[cls] = 0;
    this.globalVotes[cls] += score;
  }

  // ハイブリッド判定で勝者を決める
  getWinnerClass(){
    const candidates = new Set([...Object.keys(this.roiVotes), ...Object.keys(this.globalVotes)]);
    let bestCls = this.cls;
    let maxScore = -1;

    for(const c of candidates){
      const rScore = this.roiVotes[c] || 0;
      const gScore = this.globalVotes[c] || 0;
      // 計算式: ROIスコア(本命) + 全体スコア(保険)の10%
      const total = rScore + (gScore * 0.1);
      
      if(total > maxScore){
        maxScore = total;
        bestCls = c;
      }
    }
    return bestCls;
  }
}

class Tracker {
  constructor(opts){
    this.tracks = [];
    this.nextId = 1;
    this.iouThreshold = opts.iouThreshold ?? 0.4;
    this.minHits = 1; // ★スマホ対策: 1に固定（設定値無視）
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

    // --- 第1段階：IOU（重なり）によるマッチング ---
    // 既存のロジック。形があまり変わらないときはこれで判定。
    const iouPairs = [];
    for (let ti = 0; ti < this.tracks.length; ti++) {
      for (let di = 0; di < dets.length; di++) {
        const score = Tracker.iou(this.tracks[ti].bbox, dets[di].bbox);
        if (score >= this.iouThreshold) {
          iouPairs.push({ ti, di, score });
        }
      }
    }
    // スコアが高い順にマッチング確定
    iouPairs.sort((a, b) => b.score - a.score);
    for (const p of iouPairs) {
      if (unmatchedTracks.has(p.ti) && unmatchedDets.has(p.di)) {
        matches.push(p);
        unmatchedTracks.delete(p.ti);
        unmatchedDets.delete(p.di);
      }
    }

    // --- 第2段階（追加機能）：中心点距離による救済マッチング ---
    // 重なり判定で漏れたものを、「距離が近い」という理由で同一とみなす
    // クラスが変わって枠のサイズが激変したときに効果を発揮します。
    const distPairs = [];
    const MAX_DIST_REL = 0.2; // 画面幅の20%以内の移動なら同一とみなす

    const W = DOM.canvas.width || 1;
    const H = DOM.canvas.height || 1;
    const norm = Math.sqrt(W * W + H * H); // 画面の対角線長

    for (const ti of unmatchedTracks) {
      const tr = this.tracks[ti];
      const c1 = tr.center();
      
      for (const di of unmatchedDets) {
        const d = dets[di];
        const cx = d.bbox[0] + d.bbox[2] / 2;
        const cy = d.bbox[1] + d.bbox[3] / 2;
        
        // 距離を計算
        const dist = Math.sqrt((c1.x - cx) ** 2 + (c1.y - cy) ** 2);
        const relDist = dist / norm;

        // 距離が近ければ候補にする
        if (relDist < MAX_DIST_REL) {
          // 距離が近いほどスコアが高いとする（逆数的な考え）
          distPairs.push({ ti, di, score: 1.0 - relDist });
        }
      }
    }

    // 距離が近い順にマッチング確定
    distPairs.sort((a, b) => b.score - a.score);
    for (const p of distPairs) {
      if (unmatchedTracks.has(p.ti) && unmatchedDets.has(p.di)) {
        matches.push(p);
        unmatchedTracks.delete(p.ti);
        unmatchedDets.delete(p.di);
      }
    }

    // --- 結果の更新（既存コードと同じ） ---
    // 更新（既存トラック）
    for (const m of matches) {
      const tr = this.tracks[m.ti];
      const det = dets[m.di];
      tr.update(det);
      if (tr.state === "tentative" && tr.hitStreak >= this.minHits) {
        tr.state = "confirmed";
        this.onConfirmed(tr);
      }
    }

    // 新規作成（どのトラックともマッチしなかった検出）
    for (const di of unmatchedDets) {
      const det = dets[di];
      const tr = new Track(this.nextId++, det);
      this.tracks.push(tr);
    }

    // 見失いカウント（検出されなかったトラック）
    for (const ti of unmatchedTracks) {
      this.tracks[ti].lostAge++;
    }

    // 削除処理
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

/* ========= カウントロジック (Ver3.0) ========= */

// 必要なヘルパー関数（再定義）
function isVehicleClass(cls){
  return VEHICLE_CATS.includes(cls);
}

function countUp(cls){
  if(!UI_CATS.includes(cls)) return;
  countsCurrentHour[cls] += 1;
  updateCountUI();
}

function applyCountByMode(cls){
  // モードに応じてカウント対象を絞る
  if(countMode === "pedestrian"){
    if(cls === "person") countUp("person");
    return;
  }
  // vehicleモード：車両のみ
  if(isVehicleClass(cls)) countUp(cls);
}

// --- メイン判定ロジック（新・滞在型） ---

function updateRoiCountingForConfirmedTracks(){
  const r = getRoiPx(); 
  const centerWidth = DOM.hitArea ? Number(DOM.hitArea.value) : 0.0;

  for(const tr of tracker.tracks){
    if(tr.state !== "confirmed" || tr.counted) continue;
    if(tr.lostAge > 0) continue;

    const c = tr.center();
    const prev = tr.prevCenter;

    // 動いているかチェック
    let isMoving = true;
    if(prev){
       const dist = Math.sqrt((c.x - prev.x)**2 + (c.y - prev.y)**2);
       if(dist < 2.0) isMoving = false; 
    }

    // 判定中心幅のロジックを適用
    // 枠内判定（inRoi）
    let inRoi = isPointInPolygon(c, r);
    
    // 設定が「100%(0.0)」以外なら、枠の境界線から一定距離内側に入ったか厳密にチェックする準備
    // 現状は中心点が枠に入ればカウント候補とする
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
  // 消失回収 (Lost Recovery)
  // 画面端で消えたり、追跡が切れた場合に拾う
  if(!tr.counted){
    // ROI滞在実績が十分(2フレーム以上) または ワープ経験あり
    if(tr.totalFramesInRoi >= 2 || tr.warpDetected){
      const winner = tr.getWinnerClass();
      applyCountByMode(winner);
      tr.counted = true;
    }
  }
}

function filterDetectionsByMode(rawDets){
  // rawDets: [{bbox, score, cls}]
  if(countMode === "pedestrian"){
    // 歩行者特化：personだけ残す
    return rawDets.filter(d => d.cls === "person");
  }

  // vehicleモード：車両カウントに集中するため、personは一切扱わない（表示もしない）
  const vehicles = rawDets.filter(d => VEHICLE_CATS.includes(d.cls));
  return vehicles;
}

/* ========= 初期化 ========= */
window.addEventListener("load", init);

async function init(){
  try{
    removeSettingsInfoMark();    // 設定横の「i」を消す
    setupTitleDescription();     // タイトル横に「利用ガイド」を出す
    injectModeInactiveStyle();   // 非アクティブ項目の色設定

    applyModeUiState();
    setupSettingItemHelpPopups();
    progressFake(5);
    await tf.ready();

    progressFake(35);
    model = await cocoSsd.load();

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

    // エラーメッセージを文字列化してチェック
    const errStr = String(err?.message || err || "");
    let userMsg = `${errStr}`;

    // よくあるエラー（権限拒否）の場合は、具体的な日本語メッセージにする
    if(errStr.includes("Permission denied") || errStr.includes("NotAllowedError")){
      userMsg = "カメラの利用が許可されていません";
    } else if(errStr.includes("device") || errStr.includes("found")){
      userMsg = "カメラが見つかりません";
    }

    // ヘルプ風の画面ではなく、位置情報エラーと同じ「赤色のトースト」で表示
    toast(userMsg, true);
  }
}
function progressFake(v){
  DOM.loadingPerc.textContent = `${v}%`;
  DOM.loadingProg.value = v;
}

/* ========= イベント ========= */
function setupEventListeners(){
  DOM.toggleBtn.addEventListener("click", toggleAnalysis);

  // モード切替（設定パネルのプルダウン）
  if(DOM.countModeSelect){
    // 初期値を反映
    DOM.countModeSelect.value = normalizeMode(countMode);

    DOM.countModeSelect.addEventListener("change", ()=>{
      countMode = normalizeMode(DOM.countModeSelect.value);
      try{ localStorage.setItem(LS_KEY_MODE, countMode); }catch(_e){}
      applyModeUiState();
      updateCountUI();
      updateHourTitle();
      setupSettingItemHelpPopups();
      updateLogTableVisibility();

      // すぐ画面に反映（残っているトラックは描画側で抑制）
      if(isAnalyzing) setupTracker();
    });
  }

  DOM.reserveBtn.addEventListener("click", handleReservation);
  window.addEventListener("resize", adjustCanvasSize);

  // 既存設定は測定中に変更されたら追跡器を再生成（挙動は従来通り）
  ["max-lost","score-th","max-fps"].forEach(id=>{
    document.getElementById(id).addEventListener("change", ()=>{
      if(isAnalyzing) setupTracker();
    });
  });

  setupTabs();
  setupRoiDrag(); // ROI枠のドラッグ設定（見た目変化はキャンバス上の枠のみ）
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

/* ========= 測定開始・終了 ========= */
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

  startAutoSaveHourly();

  lastInferTime = 0;
  frameIndex = 0;
}

function stopAnalysis(){
  DOM.toggleBtn.textContent = "開始";
  DOM.toggleBtn.classList.replace("btn-red", "btn-green");
  DOM.canvas.classList.remove("analyzing");

  stopAutoSaveHourly();

  if(recordsHourly.length > 0){
    exportCSV(recordsHourly, geo); 
  }

  countsCurrentHour = zeroCounts();
  recordsHourly = [];

  updateCountUI();
  updateLogDisplay(true);
  mainRenderLoop();
}

/* ========= 測定予約 ========= */
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

/* ========= 位置情報 ========= */
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

/* ========= カメラ ========= */
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

  // 内部解像度は「実動画ピクセル」に合わせる
  DOM.canvas.width = w;
  DOM.canvas.height = h;

  // 表示サイズは「実際に表示されているサイズ」を優先して拾う
  // offsetWidth/Height が 0 になる環境対策
  const rect = DOM.video.getBoundingClientRect();
  const parentRect = DOM.canvas.parentElement?.getBoundingClientRect?.();

  const cssW = rect.width  || DOM.video.offsetWidth  || parentRect?.width  || w;
  const cssH = rect.height || DOM.video.offsetHeight || parentRect?.height || h;

  DOM.canvas.style.width  = `${cssW}px`;
  DOM.canvas.style.height = `${cssH}px`;
}


/* ========= 追跡器セットアップ ========= */
function setupTracker(){
  tracker = new Tracker({
    iouThreshold: 0.4,
    maxLostAge: Number(DOM.maxLost.value),

    // classicロジック：confirmedで即カウント（従来に近い）
    onConfirmed: (tr)=>{
      if(countLogic !== "classic") return;
      applyCountByMode(tr.cls);
    },

    // roiロジック：1回接触のみの「車両不明」を拾うため
    onRemoved: (tr)=> onTrackRemoved(tr),
  });
}

/* ========= 統合メインループ（修正後） ========= */
function mainRenderLoop() {
  const ctx = DOM.ctx;

  // 1. 共通：映像をキャンバスに描く（常に実行）
  if (DOM.video.videoWidth) {
    // 画面サイズを自動調整
    adjustCanvasSize(); 
    ctx.drawImage(DOM.video, 0, 0, DOM.canvas.width, DOM.canvas.height);
  }

  // 2. 測定中だけ実行する処理
  if (isAnalyzing) {
    const interval = 1000 / Number(DOM.maxFps.value);
    const now = performance.now();

    // 解析頻度（FPS）に合わせてAIを動かす
    if (now - lastInferTime >= interval) {
      lastInferTime = now;
      model.detect(DOM.video).then(preds => {
        const scoreTh = Number(DOM.scoreTh.value);
        // 設定した感度以上のものだけ抽出
        const raw = preds.filter(p => UI_CATS.includes(p.class) && p.score >= scoreTh)
                         .map(p => ({ bbox: p.bbox, score: p.score, cls: p.class }));
        
        const dets = filterDetectionsByMode(raw);
        tracker.updateWithDetections(dets);
        updateRoiCountingForConfirmedTracks(); // ROI内判定
        pushHourlySnapshotIfNeeded();          // ログ保存
      });
    }
    // AIの枠（四角）を描画
    drawAllOverlays(ctx); 
  }

  // 3. 測定エリア（白い枠）を常に一番上に描く
  drawRoi(ctx);

  // 次のコマを予約してループさせる
  requestAnimationFrame(mainRenderLoop);
}

// 枠描画専用の関数（整理のために分離）
function drawAllOverlays(ctx) {
  ctx.save();
  ctx.font = "14px Segoe UI, Arial";
  ctx.lineWidth = 2;
  const color = { car:"#1e88e5", bus:"#43a047", truck:"#fb8c00", motorcycle:"#8e24aa", bicycle:"#fdd835", person:"#e53935" };

  for(const tr of tracker.tracks){
    if(tr.lostAge > 0 || tr.state !== "confirmed") continue;
    const [x,y,w,h] = tr.bbox;
    const cls = tr.cls;

    // モードに合わないものは描かない
    if(countMode === "vehicle" && cls === "person") continue;
    if(countMode === "pedestrian" && cls !== "person") continue;

    ctx.strokeStyle = color[cls] || "#fff";
    ctx.strokeRect(x,y,w,h);
    
    const label = `${cls} ${Math.floor(tr.score*100)}%`;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x, Math.max(0, y-18), ctx.measureText(label).width + 6, 18);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x+3, Math.max(10, y-4));
  }
  ctx.restore();
}

/* ========= ログ/CSV ========= */
function startAutoSaveHourly(){
  // 既存タイマーのクリア（念のため）
  if(autoSaveTimer) clearTimeout(autoSaveTimer);

  const scheduleNext = () => {
    const now = new Date();
    // 次の「0分0秒」を計算（例: 10:15なら11:00:00）
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    
    // 待ち時間を計算
    const delay = nextHour.getTime() - now.getTime();

    // 次の00分になったら実行
    autoSaveTimer = setTimeout(async () => {
      // -------------------------------------------------
      // 【1】前の時間枠（ファイルA）の締め処理
      // -------------------------------------------------
      
      // タイムスタンプを「1秒前（xx:59:59）」として記録
      // これにより、前のファイルの最後は「59:59」になる
      const endTime = new Date(nextHour);
      endTime.setSeconds(endTime.getSeconds() - 1);

      const snapshotA = { ...countsCurrentHour };
      const rowA = {
        timestamp: formatTimestamp(endTime),
        ...snapshotA,
        total_counted_mode: getCountedTotalByMode(snapshotA),
      };
      recordsHourly.push(rowA);

      // ファイルA（前の1時間分）を出力
      await exportCSV(recordsHourly, geo);


      // -------------------------------------------------
      // 【2】次の時間枠（ファイルB）の開始処理
      // -------------------------------------------------

      // カウントをリセット
      recordsHourly = [];
      countsCurrentHour = zeroCounts();

      // 新しい時間の開始時刻（xx:00:00）
      // nextHour変数をそのまま使うとズレがない
      const startTime = new Date(nextHour);

      hourWindowStart = startTime;
      analysisStartTime = startTime;

      // ★ファイルBの先頭行として「xx:00:00 (カウント0)」を記録しておく
      const snapshotB = { ...countsCurrentHour }; // 全部0
      const rowB = {
        timestamp: formatTimestamp(startTime), // xx:00:00
        ...snapshotB,
        total_counted_mode: 0
      };
      recordsHourly.push(rowB);

      // 通常ループによる重複記録防止のため、最終スナップ時間を更新
      lastSnapAt = Date.now();

      updateHourTitle();
      updateCountUI();
      updateLogDisplay(true);

      // 次の正時（さらに1時間後）を予約
      scheduleNext();

    }, delay);
  };

  // 初回の予約を実行
  scheduleNext();
}

function stopAutoSaveHourly(){
  if(autoSaveTimer){
    clearTimeout(autoSaveTimer); // setIntervalではなくsetTimeoutになったため修正
    autoSaveTimer = null;
  }
}

function pushHourlySnapshotIfNeeded(){
  const t = Date.now();
  if(t - lastSnapAt < 1000) return;
  lastSnapAt = t;

const snapshot = { ...countsCurrentHour };
const row = {
  timestamp: formatTimestamp(new Date(t)),
  ...snapshot,
  total_counted_mode: getCountedTotalByMode(snapshot),
};
  recordsHourly.push(row);
  updateLogDisplay();
}

// モードに合わせて表の列（ヘッダー）を表示/非表示にする関数
function updateLogTableVisibility() {
  const table = document.getElementById("log-table");
  if (!table) return;

  const ths = table.querySelectorAll("thead th");
  // thsの並び順: [0]日時, [1]乗用車, [2]バス, [3]トラック, [4]バイク, [5]自転車, [6]歩行者
  
  if (countMode === "pedestrian") {
    // 歩行者モード：車両系(1～5)を非表示、歩行者(6)を表示
    for (let i = 1; i <= 5; i++) ths[i].style.display = "none";
    ths[6].style.display = "table-cell";
  } else {
    // 車両モード：車両系(1～5)を表示、歩行者(6)を非表示
    for (let i = 1; i <= 5; i++) ths[i].style.display = "table-cell";
    ths[6].style.display = "none";
  }

  // 列の表示が変わったので、中身も書き直す
  rebuildLogTable(); 
}

// ログテーブルの中身を再構築する関数
function rebuildLogTable() {
  DOM.logBody.innerHTML = "";
  // 新しい順に表示
  [...recordsHourly].reverse().forEach(row => {
    insertLogRow(row);
  });
}

// 行を作成して挿入するヘルパー関数
function insertLogRow(row, prepend=false){
  const tr = document.createElement("tr");
  
  const timeCell = `<td>${row.timestamp.split(" ")[1]}</td>`;
  let cells = "";

  if(countMode === "pedestrian"){
    // 歩行者モード用の行：日時 + 歩行者
    cells = timeCell + `<td>${row.person || 0}</td>`;
  } else {
    // 車両モード用の行：日時 + 車両5種
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

// 既存の updateLogDisplay を修正してヘルパーを使うようにする
function updateLogDisplay(clear=false){
  if(clear){
    DOM.logBody.innerHTML = "";
    return;
  }
  const last = recordsHourly[recordsHourly.length-1];
  if(!last) return;

  // 新しい共通関数を使って行を追加
  insertLogRow(last, true);
  
  while(DOM.logBody.children.length > MAX_LOGS){
    DOM.logBody.lastChild?.remove();
  }
}

function updateHourTitle(){
  const h = (hourWindowStart || new Date()).getHours();

  if(countMode === "pedestrian"){
    // 歩行者モード
    const total = countsCurrentHour.person || 0;
    DOM.hourTitle.textContent = `${h}時台の通行量`;
    return;
  }

  // 車両モード
  const total = getCountedTotalByMode(countsCurrentHour);
  DOM.hourTitle.textContent = `${h}時台の交通量：計${total}台`;
}
function updateCountUI(){
  for(const k of UI_CATS){
    DOM.count[k].textContent = countsCurrentHour[k];
  }
  //setupCountSummaryUI();
  //updateCountSummaryUI();
}

async function exportCSV(data, geo, unknown){
  if(!data || data.length === 0){
    toast("出力するデータがありません", true);
    return;
  }

  const endTime = new Date();
  const noun = modeNoun();

  // ▼▼▼ UIのテキストを取得するヘルパー ▼▼▼
  const getUiText = (el) => {
    if(el && el.options && el.selectedIndex >= 0){
      return el.options[el.selectedIndex].text;
    }
    return "";
  };

  // ▼▼▼ メタデータ（ここだけに残す） ▼▼▼
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
    // 歩行者モード
    header = "日時,歩行者\n"; 
    
    rows = data.map(r => {
      const person = r.person ?? 0;
      return `"${r.timestamp}",${person}`;
    }).join("\r\n");

  } else {
    // 車両モード
    header = "日時,乗用車,バス,トラック,バイク,自転車,合計\n";
    
    rows = data.map(r => {
      const car   = r.car ?? 0;
      const bus   = r.bus ?? 0;
      const truck = r.truck ?? 0;
      const moto  = r.motorcycle ?? 0;
      const bici  = r.bicycle ?? 0;

      // シンプルに合計
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

function toast(msg, isError=false){
  // toast要素が無い/HTMLが途中で欠けている場合でも、アプリ全体が止まらないようにガード
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

/* =========================================
   ROI固定（測定開始後は編集不可） 修正版
   ========================================= */
(function lockRoiAfterStartPatch(){
  try{
    // 1) start/stop を差し替え
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

    // 2) 測定中は操作をブロック
    const c = DOM.canvas;
    if(!c) return;

    const blockIfLocked = (ev)=>{
      // 「測定中」かつ「明示的にロックされている」時だけ止める
      if(isAnalyzing && window.roiLocked === true){
        // ドラッグ操作中(roi-active)でない場合のみブロック
        if(!c.classList.contains("roi-active")){
           ev.preventDefault();
           ev.stopImmediatePropagation();
           
           // タップした瞬間だけメッセージを出す
           if(ev.type === "pointerdown"){
             toast("測定中は測定枠を変更できません");
           }
        }
      }
    };

    // capture: true で、他のイベントより先に判定する
    c.addEventListener("pointerdown", blockIfLocked, true);
    c.addEventListener("pointermove", blockIfLocked, true);
    c.addEventListener("pointerup",   blockIfLocked, true);
    
    // 初期状態はロック解除
    window.roiLocked = false;

  }catch(e){
    console.warn("ROI lock patch failed:", e);
  }
})();

/* =========================================
   測定中：設定をグレーアウト（無効化） 追加のみパッチ
   - startAnalysis/stopAnalysisを上書きしてフック
   - 設定項目を disabled にして操作不可
   ========================================= */
(function disableSettingsWhileRunningPatch(){
  try{
    const SETTINGS_IDS = [
      "count-mode", // 測定対象（モード）
      "score-th",
      "max-lost",
      "max-fps",
      // 予約系も止めたいなら追加
      "auto-start-dt",
      "auto-end-dt",
      "reserve-btn",
    ];

    const getEls = ()=> SETTINGS_IDS
      .map(id=>document.getElementById(id))
      .filter(Boolean);

    // 追加CSS（disabled時に「よりグレー」に見せる：任意）
    if(!document.getElementById("disable-settings-style")){
      const st = document.createElement("style");
      st.id = "disable-settings-style";
      st.textContent = `
        #settings-panel .settings-grid.is-locked{
          opacity: .55;
          filter: grayscale(100%);
          pointer-events: none; /* クリック自体無効化 */
        }
      `;
      document.head.appendChild(st);
    }

    function setLocked(locked){
      const els = getEls();
      els.forEach(el=>{
        // 予約ボタン以外は disabled が効く
        if("disabled" in el) el.disabled = !!locked;
      });

      const grid = document.querySelector("#settings-panel .settings-grid");
      if(grid) grid.classList.toggle("is-locked", !!locked);
    }

    // すでにパッチされてる start/stop をさらに包む（上書きでも「中身は呼ぶ」）
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

    // 初期状態は解除
    setLocked(false);
  }catch(e){
    console.warn("Disable settings patch failed:", e);
  }
})();
/* =========================================
   測定中：スリープ抑止（Screen Wake Lock） 追加のみパッチ
   - Android Chrome/Edge等で有効
   - iOS Safariは未対応の場合が多い
   ========================================= */
(function wakeLockPatch(){
  let wakeLock = null;

  async function requestWakeLock(){
    try{
      if(!("wakeLock" in navigator) || !navigator.wakeLock?.request){
        // 未対応（iOS Safariなど）
        return false;
      }
      wakeLock = await navigator.wakeLock.request("screen");
      // 解除イベント（OS側で切れる場合がある）
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

  // 画面が戻ってきたら再取得（OSが勝手に解除することがある）
  document.addEventListener("visibilitychange", async ()=>{
    if(document.visibilityState === "visible" && (isAnalyzing === true)){
      await requestWakeLock();
    }
  });

  // start/stop を包む（既存は消さない）
  const _start = startAnalysis;
  startAnalysis = function(){
    // ユーザー操作直後のタイミングが一番通りやすい
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

/* =========================================
   クラッシュ対策＆リアルタイム更新パッチ (v5 完成版)
   - 修正1: 「計〇〇人」の表示をリアルタイムに更新（カードと同期）
   - 修正2: メモリ対策（終了時・CSV保存時にバックアップ削除）
   - 修正3: クラッシュ/リロード時はデータを保持して復旧
   ========================================= */
(function crashProtectionPatch() {
  const BACKUP_KEY = "trafficCounter_crash_backup_v1";
  let isResumed = false; // 復旧モード待機フラグ
  let backupInterval = null;

  // --- 1. UIのリアルタイム同期（ここが「合計が増えない」の修正） ---
  // 元の updateCountUI（カード更新）をフックし、同時に updateHourTitle（合計更新）も呼ぶ
  const _updateCountUI = updateCountUI;
  updateCountUI = function() {
    _updateCountUI.apply(this, arguments);
    try {
      updateHourTitle(); // カードが変わるたびに上のタイトルも更新
    } catch(e) {}
  };

  // --- 2. バックアップ保存・読込・削除関数 ---

  function saveBackup() {
    // 測定中、または復旧待機中なら保存する
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
      
      // 変数に展開
      countsCurrentHour = data.countsCurrentHour || zeroCounts();
      recordsHourly = data.recordsHourly || [];
      
      if (data.analysisStartTime) analysisStartTime = new Date(data.analysisStartTime);
      if (data.hourWindowStart) hourWindowStart = new Date(data.hourWindowStart);

      // モード復元
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

  // --- 3. 起動時の復元チェック ---
  if (loadBackup()) {
    isResumed = true;
    // ロード完了後に通知とUI更新
    window.addEventListener("load", () => {
       updateCountUI(); // これでカードもタイトルも更新される
       if(DOM.logBody){
         DOM.logBody.innerHTML = "";
         [...recordsHourly].reverse().forEach(row => insertLogRow(row));
       }
       toast("前回のデータを復元しました。\n「開始」で測定を再開します。", true);
    });
  }

  // --- 4. startAnalysisをフック（開始時の挙動） ---
  const _start = startAnalysis;
  startAnalysis = function() {
    if (isResumed) {
      // ★復旧モード：変数をリセットせず維持
      const savedData = {
        c: countsCurrentHour,
        rh: recordsHourly,
        as: analysisStartTime,
        hw: hourWindowStart
      };

      const ret = _start.apply(this, arguments);

      // 変数を書き戻す
      countsCurrentHour = savedData.c;
      recordsHourly = savedData.rh;
      analysisStartTime = savedData.as;
      hourWindowStart = savedData.hw;

      // UI再反映
      isResumed = false;
      updateCountUI(); // タイトルも更新される
      if(DOM.logBody){
        DOM.logBody.innerHTML = ""; 
        [...recordsHourly].reverse().forEach(row => insertLogRow(row));
      }

      toast("中断箇所から測定を再開しました");
      saveBackup();
      startBackupLoop();
      return ret;

    } else {
      // ★通常開始
      const ret = _start.apply(this, arguments);
      saveBackup(); 
      startBackupLoop();
      return ret;
    }
  };

  // --- 5. stopAnalysisをフック（停止ボタン＝削除） ---
  const _stop = stopAnalysis;
  stopAnalysis = function() {
    stopBackupLoop();
    clearBackup(); // ★ご要望通り削除
    return _stop.apply(this, arguments);
  };

  // --- 6. exportCSVをフック（CSV保存完了＝削除） ---
  const _exportCSV = exportCSV;
  exportCSV = async function() {
    try {
      // 1. まずはCSVの保存を試みる
      await _exportCSV.apply(this, arguments);
      
      // 2. 保存が無事に完了した（エラーが起きなかった）場合のみ、バックアップを消す
      clearBackup(); 
    } catch (e) {
      // 3. もし保存に失敗したら、データを守るためにバックアップは残す
      console.error("CSV出力エラー:", e);
      toast("出力に失敗したため、データを保持します", true);
    }
  };

  // --- 7. バックアップ間隔制御 ---
  function startBackupLoop() {
    if (backupInterval) clearInterval(backupInterval);
    backupInterval = setInterval(saveBackup, 1000);
  }
  function stopBackupLoop() {
    if (backupInterval) { clearInterval(backupInterval); backupInterval = null; }
  }

  // 画面が隠れたり閉じたりする瞬間に強制保存
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'hidden') saveBackup();
  });
  window.addEventListener("pagehide", saveBackup);
  window.addEventListener("beforeunload", saveBackup);

})();
