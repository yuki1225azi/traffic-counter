/* ========= ROI操作（1秒ロック維持・高速追従版） ========= */
function setupRoiDrag(){
  const c = DOM.canvas;
  if(!c) return;

  // 初期状態：縦スクロールは許可
  // (ドラッグ開始時に動的に "none" に切り替える)
  c.style.touchAction = "pan-y";

  let dragging = false;
  let dragIndex = -1;
  let dragCache = null; // 高速化用キャッシュ
  let lockTimer = null; // 1秒ルール用タイマー

  // 判定範囲
  const TOUCH_HIT_RADIUS_PX = 40; 
  const MOUSE_HIT_RADIUS_PX = 20;

  // ■ロック制御：操作開始でスクロール禁止、離しても1秒間は禁止維持
  const activateScrollLock = () => {
    if(lockTimer) clearTimeout(lockTimer);
    c.style.touchAction = "none"; // 強制スクロール禁止
  };

  const scheduleScrollUnlock = () => {
    if(lockTimer) clearTimeout(lockTimer);
    // 1秒後にスクロール許可に戻す
    lockTimer = setTimeout(() => {
      c.style.touchAction = "pan-y";
      lockTimer = null;
    }, 1000);
  };

  // キャッシュ作成（ドラッグ開始時のみ実行）
  const createCache = (ev) => {
    const rect = c.getBoundingClientRect();
    const cw = c.width  || 1;
    const ch = c.height || 1;
    const scale = Math.min(rect.width / cw, rect.height / ch);
    const contentW = cw * scale;
    const contentH = ch * scale;
    const offsetX = (rect.width  - contentW) / 2;
    const offsetY = (rect.height - contentH) / 2;
    return { rect, scale, contentW, contentH, offsetX, offsetY, cw, ch };
  };

  const startDrag = (ev)=>{
    if(isAnalyzing || window.roiLocked === true) return;
    if(DOM.videoContainer && DOM.videoContainer.classList.contains("is-floating")) return;

    // ★重要：1秒ロック期間中なら、触った瞬間にブラウザ動作を止める
    // これにより「連続タップでの微調整」が劇的にスムーズになる
    if(c.style.touchAction === "none" && ev.cancelable){
      ev.preventDefault();
    }

    const cache = createCache(ev); // 計算用キャッシュ作成
    const { rect, scale, contentW, contentH, offsetX, offsetY } = cache;

    // タッチ位置の計算
    const xIn = ev.clientX - rect.left - offsetX;
    const yIn = ev.clientY - rect.top  - offsetY;

    // Canvas内部座標へ変換
    const p = { 
      x: Math.max(0, Math.min(contentW, xIn)) / scale, 
      y: Math.max(0, Math.min(contentH, yIn)) / scale 
    };

    // ヒット判定
    const pts = getRoiPx(); 
    const isTouch = (ev.pointerType === 'touch' || ev.pointerType === 'pen');
    const visualRadius = isTouch ? TOUCH_HIT_RADIUS_PX : MOUSE_HIT_RADIUS_PX;
    const HIT_RADIUS = visualRadius * (cache.cw / cache.rect.width) * cache.scale;

    let closestIdx = -1;
    let minDistance = Infinity;

    pts.forEach((pt, i) => {
      const dist = Math.sqrt((p.x - pt.x)**2 + (p.y - pt.y)**2);
      if(dist <= HIT_RADIUS && dist < minDistance){
        minDistance = dist;
        closestIdx = i;
      }
    });

    if(closestIdx !== -1){
      dragging = true;
      dragIndex = closestIdx;
      dragCache = cache; 
      
      c.classList.add("roi-active"); 
      activateScrollLock(); // ★操作中はスクロール禁止

      ev.stopImmediatePropagation();
      if(ev.cancelable) ev.preventDefault();

      // ★重要：高速移動しても指を離さないためのキャプチャ
      try{ c.setPointerCapture(ev.pointerId); }catch(_e){}
    }
  };

  const moveDrag = (ev)=>{
    if(!dragging || dragIndex === -1 || !dragCache) return;
    
    // ドラッグ中はブラウザイベントを完全ブロック
    if(ev.cancelable) ev.preventDefault();
    ev.stopImmediatePropagation();

    const { rect, scale, contentW, contentH, offsetX, offsetY, cw, ch } = dragCache;

    const xIn = ev.clientX - rect.left - offsetX;
    const yIn = ev.clientY - rect.top  - offsetY;

    const xClamped = Math.max(0, Math.min(contentW, xIn));
    const yClamped = Math.max(0, Math.min(contentH, yIn));

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
    
    c.classList.remove("roi-active");
    try{ c.releasePointerCapture(ev.pointerId); }catch(_e){}
    
    saveRoi();
    
    // ★指を離してもすぐにはスクロール許可しない（1秒待機）
    scheduleScrollUnlock();
  };

  c.addEventListener("pointerdown", startDrag, { passive: false });
  c.addEventListener("pointermove", moveDrag, { passive: false });
  c.addEventListener("pointerup", endDrag);
  c.addEventListener("pointercancel", endDrag);
}
