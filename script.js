/* =========================
   スマート交通量カウンター (UI改善版v6)
   ========================= */

// グローバル定数とDOM要素
const CATS=['car','bus','truck','motorcycle','bicycle','person'];
const DOM={video:document.getElementById("video"),canvas:document.getElementById("canvas"),ctx:document.getElementById("canvas").getContext("2d"),toggleBtn:document.getElementById("toggle-analysis-btn"),status:document.getElementById("status-indicator"),loadingPerc:document.getElementById("loading-percentage"),loadingProg:document.getElementById("loading-progress"),toast:document.getElementById("toast"),hourTitle:document.getElementById("current-hour-title"),count:{car:document.getElementById("count-car"),bus:document.getElementById("count-bus"),truck:document.getElementById("count-truck"),motorcycle:document.getElementById("count-motorcycle"),bicycle:document.getElementById("count-bicycle"),person:document.getElementById("count-person")},logDisplay:document.getElementById("log-display"),logBody:document.getElementById("log-body"),startDt:document.getElementById("auto-start-dt"),endDt:document.getElementById("auto-end-dt"),reserveBtn:document.getElementById("reserve-btn"),scoreTh:document.getElementById("score-th"),iouTh:document.getElementById("iou-th"),minHits:document.getElementById("min-hits"),maxLost:document.getElementById("max-lost"),maxFps:document.getElementById("max-fps"),drawMode:document.getElementById("draw-mode"),geoLat:document.getElementById("geo-lat"),geoLng:document.getElementById("geo-lng")};
let model=null,isAnalyzing=!1,rafId=null,lastInferTime=0,analysisStartTime=null,hourWindowStart=null,geo={lat:"未取得",lng:"未取得"},recordsHourly=[],autoSaveTimer=null,scheduleTimerStart=null,scheduleTimerEnd=null;
const MAX_LOGS=100,zeroCounts=()=>({car:0,bus:0,truck:0,motorcycle:0,bicycle:0,person:0});
let countsCurrentHour=zeroCounts(),countsSessionTotal=zeroCounts();

// 追跡器クラス (変更なし)
class Track{constructor(t,o,s){this.id=t,this.bbox=o,this.score=s,this.state="tentative",this.hitStreak=1,this.lostAge=0,this.createdAt=performance.now(),this.lastSeenAt=this.createdAt,this.prevCenter=this.center()}center(){const[t,o,s,e]=this.bbox;return{x:t+s/2,y:o+e/2}}update(t,o){this.bbox=t,this.score=o,this.hitStreak++,this.lostAge=0,this.prevCenter=this.center(),this.lastSeenAt=performance.now()}}
class Tracker{constructor(t){this.tracks=[],this.nextId=1,this.iouThreshold=t.iouThreshold??.4,this.minHits=t.minHits??3,this.maxLostAge=t.maxLostAge??30,this.onConfirmed=t.onConfirmed??(()=>{})}static iou(t,o){const[s,e,i,n]=t,[r,c,a,h]=o,l=Math.max(s,r),d=Math.max(e,c),u=Math.min(s+i,r+a),f=Math.min(e+n,c+h),p=Math.max(0,u-l),m=Math.max(0,f-d),w=p*m;return i*n+a*h-w>0?w/(i*n+a*h-w):0}updateWithDetections(t){const o=[],s=new Set(t.map((t,o)=>o)),e=new Set(this.tracks.map((t,o)=>o)),i=[];for(let s=0;s<this.tracks.length;s++)for(let o=0;o<t.length;o++){const e=Tracker.iou(this.tracks[s].bbox,t[o].bbox);i.push({ti:s,di:o,iou:e})}i.sort((t,o)=>o.iou-t.iou);for(const t of i){if(t.iou<this.iouThreshold)break;e.has(t.ti)&&s.has(t.di)&&(o.push(t),e.delete(t.ti),s.delete(t.di))}for(const s of o){const o=this.tracks[s.ti],e=t[s.di];o.update(e.bbox,e.score),"tentative"===o.state&&o.hitStreak>=this.minHits&&(o.state="confirmed",this.onConfirmed(o))}for(const o of s){const s=t[o],e=new Track(this.nextId++,s.bbox,s.score);this.tracks.push(e)}for(const t of e)this.tracks[t].lostAge++;this.tracks=this.tracks.filter(t=>t.lostAge<=this.maxLostAge)}}

// 初期化
window.addEventListener("load",init);
async function init(){
    try {
        progressFake(5); await tf.ready();
        progressFake(35); model = await cocoSsd.load();
        progressFake(100);
        setTimeout(() => { DOM.status.classList.add("hidden") }, 500);
        await setupCamera();
        await getGeolocation().catch(err => {
            console.warn('Initial geolocation failed:', err.message);
            toast('位置情報の自動取得に失敗しました', true);
        });
        setupEventListeners();
        setupTrackers();
        updateHourTitle();
        drawVideoToCanvas();
        DOM.toggleBtn.disabled = false;
        toast("準備完了");
    } catch(err) {
        console.error(err);
        alert(`初期化に失敗しました: ${err?.message||err}`);
    }
}
function progressFake(t){DOM.loadingPerc.textContent=`${t}%`,DOM.loadingProg.value=t}

// イベントリスナ設定
function setupEventListeners(){
    DOM.toggleBtn.addEventListener("click",toggleAnalysis);
    DOM.reserveBtn.addEventListener("click",handleReservation);
    window.addEventListener("resize",adjustCanvasSize);
    ["iou-th","min-hits","max-lost","score-th","max-fps","draw-mode"].forEach(t=>{document.getElementById(t).addEventListener("change",()=>{isAnalyzing&&setupTrackers()})});
    setupTabs();
}
function setupTabs(){const t=document.querySelectorAll(".tab-link"),o=document.querySelectorAll(".tab-content");t.forEach(s=>{s.addEventListener("click",()=>{const e=s.dataset.tab;t.forEach(t=>t.classList.remove("active")),o.forEach(t=>t.classList.remove("active")),s.classList.add("active"),document.getElementById(`tab-${e}`).classList.add("active")})})}

// 測定開始・終了
function toggleAnalysis(){isAnalyzing=!isAnalyzing,isAnalyzing?startAnalysis():stopAnalysis()}
function startAnalysis(){DOM.toggleBtn.textContent="終了",DOM.toggleBtn.classList.replace("btn-green","btn-red"),DOM.canvas.classList.add("analyzing"),setupTrackers(),getGeolocation().catch(()=>{}),countsCurrentHour=zeroCounts(),recordsHourly=[],analysisStartTime=new Date,hourWindowStart=new Date,updateCountUI(),updateHourTitle(),updateLogDisplay(!0),startAutoSaveHourly(),lastInferTime=0,detectLoop()}
function stopAnalysis(){DOM.toggleBtn.textContent="開始",DOM.toggleBtn.classList.replace("btn-red","btn-green"),DOM.canvas.classList.remove("analyzing"),cancelAnimationFrame(rafId),stopAutoSaveHourly(),recordsHourly.length>0&&exportCSV(recordsHourly,geo),countsCurrentHour=zeroCounts(),recordsHourly=[],updateCountUI(),updateLogDisplay(!0),drawVideoToCanvas(),toast("測定を終了しました")}

// 測定予約
async function handleReservation(){try{await getGeolocation(),applySchedule()}catch(t){toast(`位置情報取得が必要です`,!0)}}
function applySchedule(){scheduleTimerStart&&clearTimeout(scheduleTimerStart),scheduleTimerEnd&&clearTimeout(scheduleTimerEnd);const t=DOM.startDt.value?new Date(DOM.startDt.value):null,o=DOM.endDt.value?new Date(DOM.endDt.value):null,s=new Date;let e=!1;t&&t>s&&(scheduleTimerStart=setTimeout(()=>{isAnalyzing||toggleAnalysis()},t-s),e=!0),o&&(!t||o>t)&&(scheduleTimerEnd=setTimeout(()=>{isAnalyzing&&toggleAnalysis()},Math.max(0,o-s)),e=!0),e?toast("予約が完了しました"):toast("予約可能な日時が設定されていません",!0)}

// 位置情報
function getGeolocation(){return new Promise((t,o)=>{if(!navigator.geolocation)return DOM.geoLat.textContent="非対応",DOM.geoLng.textContent="非対応",o(new Error("ブラウザが位置情報取得に非対応です"));navigator.geolocation.getCurrentPosition(s=>{geo.lat=s.coords.latitude.toFixed(6),geo.lng=s.coords.longitude.toFixed(6),DOM.geoLat.textContent=geo.lat,DOM.geoLng.textContent=geo.lng,t(s)},s=>{geo.lat="取得失敗",geo.lng="取得失敗",DOM.geoLat.textContent=geo.lat,DOM.geoLng.textContent=geo.lng,o(s)},{enableHighAccuracy:!0,timeout:8e3,maximumAge:6e4})})}

// 検出・追跡・描画
function setupTrackers(){trackers={};for(const o of CATS)trackers[o]=new Tracker({iouThreshold:Number(DOM.iouTh.value),minHits:Number(DOM.minHits.value),maxLostAge:Number(DOM.maxLost.value),onConfirmed:()=>{countsCurrentHour[o]+=1,updateCountUI()}})}
async function setupCamera(){const t=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:!1});return DOM.video.srcObject=t,new Promise(t=>{DOM.video.onloadedmetadata=()=>{DOM.video.play(),adjustCanvasSize(),t()}})}
function adjustCanvasSize(){const t=DOM.video.videoWidth,o=DOM.video.videoHeight;t&&o&&(DOM.canvas.width=t,DOM.canvas.height=o,DOM.canvas.style.width=`${DOM.video.offsetWidth}px`,DOM.canvas.style.height=`${DOM.video.offsetHeight}px`)}
function detectLoop(){if(!isAnalyzing)return;const t=1e3/Number(DOM.maxFps.value),o=performance.now();if(o-lastInferTime<t)return void(rafId=requestAnimationFrame(detectLoop));lastInferTime=o,model.detect(DOM.video).then(t=>{const o=Number(DOM.scoreTh.value),s={car:[],bus:[],truck:[],motorcycle:[],bicycle:[],person:[]};for(const e of t)CATS.includes(e.class)&&e.score>=o&&s[e.class].push({bbox:e.bbox,score:e.score});for(const e of CATS)trackers[e].updateWithDetections(s[e]);drawAll(),pushHourlySnapshotIfNeeded(),rafId=requestAnimationFrame(detectLoop)}).catch(t=>{console.error(t),rafId=requestAnimationFrame(detectLoop)})}
function drawVideoToCanvas(){DOM.video.videoWidth&&(adjustCanvasSize(),DOM.ctx.drawImage(DOM.video,0,0,DOM.canvas.width,DOM.canvas.height)),isAnalyzing||requestAnimationFrame(drawVideoToCanvas)}
function drawAll(){const t=DOM.drawMode.value,o=DOM.ctx;if(o.drawImage(DOM.video,0,0,DOM.canvas.width,DOM.canvas.height),"off"===t)return;o.save(),o.font="14px Segoe UI, Arial",o.lineWidth=2;const s={car:"#1e88e5",bus:"#43a047",truck:"#fb8c00",motorcycle:"#8e24aa",bicycle:"#fdd835",person:"#e53935"};for(const e of CATS){const i=s[e];for(const n of trackers[e].tracks){if(n.lostAge>0)continue;const[r,c,a,h]=n.bbox;if(o.strokeStyle=i,o.strokeRect(r,c,a,h),"all"===t){const l=`${e} ${n.score*100|0} [#${n.id}]`,d=o.measureText(l).width+6;o.fillStyle="rgba(0,0,0,0.6)",o.fillRect(r,Math.max(0,c-18),d,18),o.fillStyle="#fff",o.fillText(l,r+3,Math.max(10,c-4))}}}o.restore()}

// ログ・UI更新・CSV出力
function startAutoSaveHourly(){autoSaveTimer&&clearInterval(autoSaveTimer),autoSaveTimer=setInterval(async()=>{const t={...countsCurrentHour},o=new Date,s={timestamp:formatTimestamp(o),...t};recordsHourly.push(s),await exportCSV(recordsHourly,geo),recordsHourly=[],countsCurrentHour=zeroCounts(),hourWindowStart=o,updateHourTitle(),updateCountUI(),updateLogDisplay(!0),analysisStartTime=o},36e5)}
function stopAutoSaveHourly(){autoSaveTimer&&(clearInterval(autoSaveTimer),autoSaveTimer=null)}
let lastSnapAt=0;
function pushHourlySnapshotIfNeeded(){const t=Date.now();if(t-lastSnapAt<1e3)return;lastSnapAt=t;const o=formatTimestamp(new Date(t)),s={timestamp:o,...countsCurrentHour};recordsHourly.push(s),updateLogDisplay()}
function updateLogDisplay(t=!1){if(t)return void(DOM.logBody.innerHTML="");const o=recordsHourly[recordsHourly.length-1];if(!o)return;const s=document.createElement("tr");s.innerHTML=`<td>${o.timestamp.split(" ")[1]}</td><td>${o.car}</td><td>${o.bus}</td><td>${o.truck}</td><td>${o.motorcycle}</td><td>${o.bicycle}</td><td>${o.person}</td>`,DOM.logBody.prepend(s);for(;DOM.logBody.children.length>MAX_LOGS;)DOM.logBody.lastChild?.remove()}
function updateHourTitle(){const t=(hourWindowStart||new Date).getHours().toString().padStart(2,"0");DOM.hourTitle.textContent=`${t}時台の累積数`}
function updateCountUI(){for(const t of CATS)DOM.count[t].textContent=countsCurrentHour[t]}
async function exportCSV(data, geo){
  if(!data || data.length===0) { toast('出力するデータがありません', true); return; }
  const header = '測定地点（緯度）,測定地点（経度）,集計日時,乗用車台数,バス台数,トラック台数,バイク台数,自転車台数,歩行者人数\n';
  const rows = data.map(r => {
    return `${geo.lat},${geo.lng},"${r.timestamp}",${r.car},${r.bus},${r.truck},${r.motorcycle},${r.bicycle},${r.person}`;
  }).join('\n');
  const csv = "﻿" + header + rows;
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = fileNameFromDate(analysisStartTime || new Date());
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`CSVファイル「${name}」を出力しました`);
}
function fileNameFromDate(t){const o=t.getFullYear(),s=String(t.getMonth()+1).padStart(2,"0"),e=String(t.getDate()).padStart(2,"0"),i=String(t.getHours()).padStart(2,"0"),n=String(t.getMinutes()).padStart(2,"0"),r=String(t.getSeconds()).padStart(2,"0");return`traffic_counter_${o}${s}${e}_${i}${n}${r}.csv`}
function toast(t,o=!1){DOM.toast.textContent=t,DOM.toast.style.backgroundColor=o?"rgba(229,57,53,.85)":"rgba(0,0,0,.8)",DOM.toast.classList.remove("hidden"),setTimeout(()=>{DOM.toast.classList.add("hidden")},3e3)}
function formatTimestamp(t){const o=t.getFullYear(),s=String(t.getMonth()+1).padStart(2,"0"),e=String(t.getDate()).padStart(2,"0"),i=String(t.getHours()).padStart(2,"0"),n=String(t.getMinutes()).padStart(2,"0"),r=String(t.getSeconds()).padStart(2,"0");return`${o}/${s}/${e} ${i}:${n}:${r}`}