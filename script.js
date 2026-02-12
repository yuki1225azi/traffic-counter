/* =========================================
   スクロール連動：ミニプレーヤー化 ＆ ドラッグ移動パッチ (下端判定版)
   - 映像コンテナの「下端」が画面上部に消えたら発動する
   ========================================= */
(function floatingPlayerPatch(){
  const container = document.getElementById("video-container");
  if(!container) return;

  // 1. プレースホルダー（映像が抜けた穴を埋める箱）
  const placeholder = document.createElement("div");
  placeholder.id = "video-placeholder";
  // 挿入場所: コンテナの直前
  container.parentNode.insertBefore(placeholder, container);

  // 2. 監視用センチネル（透明な線）
  // ★修正：コンテナの「下」に配置する
  const sentinel = document.createElement("div");
  sentinel.id = "video-sentinel";
  sentinel.style.height = "1px";
  sentinel.style.width = "100%";
  sentinel.style.pointerEvents = "none";
  sentinel.style.marginTop = "-1px"; // 隙間ができないよう調整
  
  // コンテナの「次」に挿入 = コンテナの下に配置
  if (container.nextSibling) {
    container.parentNode.insertBefore(sentinel, container.nextSibling);
  } else {
    container.parentNode.appendChild(sentinel);
  }

  // 3. スクロール監視
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // プレースホルダー高さ同期
      if(container.offsetHeight > 0 && !container.classList.contains("is-floating")){
         placeholder.style.height = container.offsetHeight + "px";
      }

      // ★判定ロジック：
      // 「監視線（映像の下端）が画面外（上）に行った」とき = 映像が完全に見えなくなったとき
      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
        // --- フロートON ---
        if(!container.classList.contains("is-floating")){
          placeholder.style.display = "block";
          container.classList.add("is-floating");
          
          // 位置リセット
          container.style.transform = ""; 
          container.style.left = ""; 
          container.style.top = "";
          container.style.bottom = "20px";
          container.style.right = "20px";
          container.style.width = ""; 
        }
      } else {
        // --- フロートOFF ---
        // 監視線（映像の下端）が画面内に入ってきたら = 映像が見え始めたら戻す
        if(container.classList.contains("is-floating")){
          container.classList.remove("is-floating");
          placeholder.style.display = "none";
          
          // スタイル解除
          container.style.transform = "";
          container.style.left = "";
          container.style.top = "";
          container.style.bottom = "";
          container.style.right = "";
          container.style.width = "";
        }
      }
    });
  }, { 
    threshold: 0,
    rootMargin: "0px" // オフセットなし（下端が画面端に来たら即反応）
  });

  observer.observe(sentinel);

  // 4. ドラッグ移動ロジック
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  container.addEventListener("touchstart", (e) => {
    if (!container.classList.contains("is-floating")) return;
    e.preventDefault(); 
    isDragging = true;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    const rect = container.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    
    container.style.bottom = "auto";
    container.style.right = "auto";
    container.style.left = initialLeft + "px";
    container.style.top = initialTop + "px";
    container.style.width = rect.width + "px"; 
  }, { passive: false });

  window.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    e.preventDefault(); 
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    container.style.left = `${initialLeft + dx}px`;
    container.style.top = `${initialTop + dy}px`;
  }, { passive: false });

  window.addEventListener("touchend", () => {
    isDragging = false;
  });

  container.addEventListener("click", (e) => {
    if (container.classList.contains("is-floating") && !isDragging) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

})();
