<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
  <title>リアルタイム交通量調査AI</title>
  <link rel="stylesheet" href="./style.css" />
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.2.0/dist/tf.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js"></script>
  <script defer src="./script.js"></script>
</head>
<body>
  <div id="container">
    <header id="app-header">
      <h1 id="app-title">リアルタイム交通量調査AI</h1>
      <div id="status-indicator">
        <div id="loading-model">モデル読み込み中..</div>
        <progress id="loading-progress" max="100" value="0"></progress>
        <span id="loading-percentage">0%</span>
      </div>
    </header>

    <div id="main-layout">
      <div id="video-container">
        <video id="video" autoplay playsinline muted></video>
        <canvas id="canvas"></canvas>
      </div>

      <div class="panel-group">
        <nav class="tabs">
          <button class="tab-link active" data-tab="realtime">即時測定</button>
          <button class="tab-link" data-tab="schedule">予約測定</button>
        </nav>
        <div id="tab-realtime" class="tab-content active"><div class="panel"><button id="toggle-analysis-btn" class="btn btn-green" disabled>開始</button></div></div>
        <div id="tab-schedule" class="tab-content"><div class="panel">
            <div class="schedule-inputs"><label>開始日時<input type="datetime-local" id="auto-start-dt"></label><label>終了日時<input type="datetime-local" id="auto-end-dt"></label></div>
            <button id="reserve-btn" class="btn btn-blue">予約</button>
        </div></div>
      </div>

      <section id="realtime-stats">
        <h2 id="current-hour-title">--時台の交通量</h2>
        <div class="counts">
          <div class="count-item car">乗用車：<span id="count-car">0</span>台</div>
          <div class="count-item bus">バス：<span id="count-bus">0</span>台</div>
          <div class="count-item truck">トラック：<span id="count-truck">0</span>台</div>
          <div class="count-item motorcycle">バイク：<span id="count-motorcycle">0</span>台</div>
          <div class="count-item bicycle">自転車：<span id="count-bicycle">0</span>台</div>
          <div class="count-item person">歩行者：<span id="count-person">0</span>人</div>
        </div>
      </section>

      <div class="panel" id="info-panel">
         <div class="log-header">
           <h3>測定ログ</h3>
           <div class="geo">
             <span>緯度：<strong id="geo-lat">未取得</strong></span>
             <span>経度：<strong id="geo-lng">未取得</strong></span>
           </div>
         </div>
         <div id="log-display">
           <table id="log-table">
             <thead><tr><th>日時</th><th>乗用車</th><th>バス</th><th>トラック</th><th>バイク</th><th>自転車</th><th>歩行者</th></tr></thead>
             <tbody id="log-body"></tbody>
           </table>
         </div>
      </div>
      
      <div class="panel" id="settings-panel">
        <div class="panel-title-row">
          <h3>設定</h3>
        </div>
<div class="settings-grid">
          <label>測定対象
            <select id="count-mode">
              <option value="vehicle">車両</option>
              <option value="pedestrian">歩行者</option>
            </select>
          </label>
          <label>判定中心幅
            <select id="hit-area">
              <option value="0.4">20%</option>
              <option value="0.3">40%</option>
              <option value="0.2" selected>60%</option>
              <option value="0.1">80%</option>
              <option value="0.0">100%</option>
            </select>
          </label>
          <label>検知感度
            <select id="score-th">
              <option value="0.1">10%</option>
              <option value="0.2">20%</option>
              <option value="0.3">30%</option>
              <option value="0.4">40%</option>
              <option value="0.5" selected>50%</option>
              <option value="0.6">60%</option>
              <option value="0.7">70%</option>
              <option value="0.8">80%</option>
              <option value="0.9">90%</option>
            </select>
          </label>
          <label>解析頻度
            <select id="max-fps">
              <option value="5">5fps</option>
              <option value="10">10fps</option>
              <option value="15" selected>15fps</option>
              <option value="30">30fps</option>
            </select>
          </label>
          
          <label>見失い猶予
            <select id="max-lost">
              <option value="5">5frm</option>
              <option value="10">10frm</option>
              <option value="15" selected>15frm</option>
              <option value="20">20frm</option>
              <option value="25">25frm</option>
              <option value="30">30frm</option>
            </select>
          </label>
        </div>
      </div> <!-- /#settings-panel -->
    </div> <!-- /#main-layout -->
  </div> <!-- /#container -->

  <div id="toast" class="hidden"></div>
</body>
</html>
