import { APP_DISPLAY_NAME } from '../../../shared/appMeta'

/** 局域网手机端页面（Apple 风格，自包含 HTML/CSS/JS） */
export function buildLanMobilePageHtml(): string {
  const appName = APP_DISPLAY_NAME
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="default"/>
<title>${appName} · 局域网</title>
<style>
:root{
  --bg:#F5F5F7;--card:#FFFFFF;--text:#1D1D1F;--muted:#86868B;--accent:#007AFF;
  --border:rgba(0,0,0,.08);--radius:14px;--safe-b:env(safe-area-inset-bottom,0px);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;
  background:var(--bg);color:var(--text);min-height:100dvh;padding-bottom:calc(72px + var(--safe-b))}
header{position:sticky;top:0;z-index:10;padding:16px 20px 12px;
  background:rgba(245,245,247,.82);backdrop-filter:saturate(180%) blur(20px);
  border-bottom:1px solid var(--border)}
header h1{font-size:22px;font-weight:700;letter-spacing:-.02em}
header p{font-size:13px;color:var(--muted);margin-top:4px}
.panel{display:none;padding:16px 16px 8px}
.panel.active{display:block}
.card{background:var(--card);border-radius:var(--radius);border:1px solid var(--border);
  padding:16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.04)}
label{display:block;font-size:13px;font-weight:600;margin-bottom:8px}
select{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--border);
  background:var(--bg);font-size:15px;color:var(--text);appearance:none}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;
  padding:14px;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;
  transition:opacity .15s,transform .1s}
.btn:active{transform:scale(.98)}
.btn-primary{background:var(--accent);color:#fff}
.btn-secondary{background:rgba(0,122,255,.12);color:var(--accent)}
.btn:disabled{opacity:.45;cursor:not-allowed}
.hint{font-size:12px;color:var(--muted);line-height:1.5;margin-top:8px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.thumb{aspect-ratio:1;border-radius:10px;overflow:hidden;background:#E8E8ED;
  border:2px solid transparent;cursor:pointer;position:relative}
.thumb-media{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}
.thumb img.thumb-img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.thumb img.thumb-gif{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.thumb video.thumb-video{width:100%;height:100%;object-fit:cover;display:block;background:#000;pointer-events:auto}
.thumb .type-badge{position:absolute;left:6px;bottom:6px;z-index:4;font-size:9px;font-weight:700;
  padding:2px 6px;border-radius:6px;color:#fff;pointer-events:none;line-height:1.3}
.thumb .type-badge.gif{background:rgba(255,149,0,.92)}
.thumb .type-badge.video{background:rgba(29,29,31,.75);cursor:pointer;pointer-events:auto}
.thumb img{width:100%;height:100%;object-fit:cover;display:block}
.thumb.selected{border-color:var(--accent)}
.thumb .check{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;
  background:var(--accent);color:#fff;font-size:13px;display:none;align-items:center;justify-content:center;pointer-events:none}
.thumb.selected .check{display:flex}
.toolbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.toolbar .btn{flex:1;min-width:120px;padding:10px;font-size:14px}
.status{font-size:13px;color:var(--muted);text-align:center;padding:24px 12px}
.empty{text-align:center;padding:40px 16px;color:var(--muted);font-size:14px}
.progress{height:4px;background:rgba(0,0,0,.08);border-radius:2px;overflow:hidden;margin-top:12px;display:none}
.progress.show{display:block}
.progress i{display:block;height:100%;background:var(--accent);width:0%;transition:width .2s}
nav.tabbar{position:fixed;left:0;right:0;bottom:0;padding:8px 16px calc(8px + var(--safe-b));
  background:rgba(255,255,255,.88);backdrop-filter:saturate(180%) blur(20px);
  border-top:1px solid var(--border);display:flex;gap:8px}
nav.tabbar button{flex:1;border:none;background:transparent;padding:10px;border-radius:12px;
  font-size:13px;font-weight:600;color:var(--muted);cursor:pointer}
nav.tabbar button.active{background:rgba(0,122,255,.12);color:var(--accent)}
.toast{position:fixed;left:50%;bottom:calc(80px + var(--safe-b));transform:translateX(-50%) translateY(20px);
  background:rgba(29,29,31,.88);color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;
  opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;z-index:99;max-width:90vw;text-align:center}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
</style>
</head>
<body>
<header>
  <h1>${appName}</h1>
  <p id="subtitle">连接中…</p>
</header>

<section id="panel-upload" class="panel active">
  <div class="card">
    <label for="uploadLibrary">上传到图库</label>
    <select id="uploadLibrary"><option value="">加载中…</option></select>
    <p class="hint">选择手机相册中的图片或视频，上传后将自动进入 AI 分析队列。</p>
    <input type="file" id="fileInput" accept="image/*,video/*" multiple hidden/>
    <button type="button" class="btn btn-primary" id="pickBtn" style="margin-top:14px">选择文件上传</button>
    <div class="progress" id="uploadProgress"><i id="uploadBar"></i></div>
    <p class="hint" id="uploadMsg"></p>
  </div>
</section>

<section id="panel-browse" class="panel">
  <div class="card" style="padding-bottom:12px">
    <label for="browseLibrary">浏览图库</label>
    <select id="browseLibrary"><option value="">加载中…</option></select>
    <div class="toolbar" style="margin-top:12px">
      <button type="button" class="btn btn-secondary" id="selectAllBtn">全选</button>
      <button type="button" class="btn btn-primary" id="downloadBtn" disabled>下载选中</button>
    </div>
    <p class="hint" style="margin-top:8px">点击图片/动图选择或取消；视频点左下角「视频」标签选择。已选显示蓝色边框与右上角 ✓。</p>
  </div>
  <div id="mediaGrid" class="grid"></div>
  <p class="status" id="browseStatus"></p>
  <button type="button" class="btn btn-secondary" id="loadMoreBtn" style="display:none;margin:0 16px 16px">加载更多</button>
</section>

<nav class="tabbar">
  <button type="button" class="tab active" data-tab="upload">上传到电脑</button>
  <button type="button" class="tab" data-tab="browse">下载到手机</button>
</nav>
<div class="toast" id="toast"></div>

<script>
(function(){
  var token = new URLSearchParams(location.search).get('token') || sessionStorage.getItem('lanToken') || '';
  if (token) sessionStorage.setItem('lanToken', token);
  var selected = new Set();
  var browsePage = 1;
  var browseTotal = 0;
  var pageSize = 60;
  var downloadIntervalMs = 1200;

  function toast(msg){
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function(){ el.classList.remove('show'); }, 2600);
  }

  function api(path, opts){
    opts = opts || {};
    var url = path + (path.indexOf('?') >= 0 ? '&' : '?') + 'token=' + encodeURIComponent(token);
    var headers = Object.assign({ 'X-Lan-Token': token }, opts.headers || {});
    return fetch(url, Object.assign({}, opts, { headers: headers })).then(function(r){
      if (r.status === 401) throw new Error('访问令牌无效，请从电脑端复制完整链接');
      if (!r.ok) return r.json().catch(function(){ return {}; }).then(function(j){ throw new Error(j.error || ('请求失败 ' + r.status)); });
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('application/json') >= 0) return r.json();
      return r;
    });
  }

  function fillLibraries(selects, libraries){
    var html = '<option value="">请选择图库</option>';
    libraries.forEach(function(lib){
      html += '<option value="' + lib.id + '">' + lib.name + ' (' + (lib.mediaCount || 0) + ')</option>';
    });
    selects.forEach(function(sel){ sel.innerHTML = html; });
  }

  function init(){
    if (!token) {
      document.getElementById('subtitle').textContent = '请从电脑 ${appName} 导入页复制完整链接（含 token）';
      toast('缺少访问令牌');
      return;
    }
    api('/api/status').then(function(data){
      document.getElementById('subtitle').textContent = '已连接 · ' + (data.hostname || '局域网');
      pageSize = data.pageSize || 60;
      downloadIntervalMs = data.downloadIntervalMs || 1200;
      var sels = [document.getElementById('uploadLibrary'), document.getElementById('browseLibrary')];
      fillLibraries(sels, data.libraries || []);
    }).catch(function(e){
      document.getElementById('subtitle').textContent = '连接失败';
      toast(e.message);
    });
  }

  document.querySelectorAll('.tab').forEach(function(btn){
    btn.addEventListener('click', function(){
      document.querySelectorAll('.tab').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
      var tab = btn.getAttribute('data-tab');
      document.getElementById('panel-upload').classList.toggle('active', tab === 'upload');
      document.getElementById('panel-browse').classList.toggle('active', tab === 'browse');
      if (tab === 'browse') loadBrowse(true);
    });
  });

  document.getElementById('pickBtn').addEventListener('click', function(){
    document.getElementById('fileInput').click();
  });

  document.getElementById('fileInput').addEventListener('change', function(e){
    var input = e.target;
    var fileArray = Array.from(input.files || []);
    input.value = '';
    if (!fileArray.length) return;
    var libraryId = document.getElementById('uploadLibrary').value;
    if (!libraryId) { toast('请先选择图库'); return; }
    uploadFiles(libraryId, fileArray);
  });

  function uploadFiles(libraryId, files){
    var prog = document.getElementById('uploadProgress');
    var bar = document.getElementById('uploadBar');
    var msg = document.getElementById('uploadMsg');
    var btn = document.getElementById('pickBtn');
    btn.disabled = true;
    prog.classList.add('show');
    var done = 0;
    var failed = 0;
    var total = files.length;
    function next(i){
      if (i >= total) {
        btn.disabled = false;
        prog.classList.remove('show');
        bar.style.width = '100%';
        msg.textContent = '完成：成功 ' + done + ' 个' + (failed ? '，失败 ' + failed + ' 个' : '') + ' / 共 ' + total + ' 个';
        toast(failed ? '部分上传失败' : '上传完成');
        return;
      }
      var file = files[i];
      bar.style.width = Math.round(((i + 0.5) / total) * 100) + '%';
      msg.textContent = '上传中 ' + (i + 1) + '/' + total + ' · ' + file.name;
      fetch('/api/upload?token=' + encodeURIComponent(token), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Library-Id': libraryId,
          'X-Filename': encodeURIComponent(file.name),
          'X-Lan-Token': token
        },
        body: file
      }).then(function(r){
        if (!r.ok) return r.json().then(function(j){ throw new Error(j.error || '上传失败'); });
        return r.json();
      }).then(function(){
        done++;
        next(i + 1);
      }).catch(function(err){
        failed++;
        msg.textContent = file.name + ' 失败：' + err.message + '，继续下一个…';
        setTimeout(function(){ next(i + 1); }, 300);
      });
    }
    next(0);
  }

  function mediaUrl(id, kind, inline){
    var q = 'token=' + encodeURIComponent(token);
    if (inline) q += '&inline=1';
    return '/api/media/' + id + '/' + kind + '?' + q;
  }

  function isGifItem(item){
    return item.mediaType === 'gif' || /\\.gif$/i.test(item.fileName || '');
  }
  function isVideoItem(item){
    return item.mediaType === 'video' || /\\.(mp4|mov|avi|mkv|webm)$/i.test(item.fileName || '');
  }
  function typeBadgeHtml(item){
    if (isGifItem(item)) return '<span class="type-badge gif">GIF</span>';
    if (isVideoItem(item)) return '<span class="type-badge video">视频</span>';
    return '';
  }

  function buildThumbMedia(item){
    if (isGifItem(item)) {
      return '<div class="thumb-media"><img class="thumb-img thumb-gif" src="' + mediaUrl(item.id, 'file', true) + '" loading="eager" decoding="async" alt=""/></div>';
    }
    if (isVideoItem(item)) {
      return '<div class="thumb-media"><video class="thumb-video" src="' + mediaUrl(item.id, 'file', true) + '" poster="' + mediaUrl(item.id, 'thumb', false) + '" controls playsinline webkit-playsinline preload="metadata"></video></div>';
    }
    return '<div class="thumb-media"><img class="thumb-img" src="' + mediaUrl(item.id, 'thumb', false) + '" loading="lazy" alt=""/></div>';
  }

  function bindThumbSelect(div, item){
    if (isVideoItem(item)) {
      var badge = div.querySelector('.type-badge.video');
      if (badge) {
        badge.addEventListener('click', function(e){
          e.stopPropagation();
          toggleThumbSelect(div, item.id);
        });
      }
      return;
    }
    div.addEventListener('click', function(){
      toggleThumbSelect(div, item.id);
    });
  }

  function toggleThumbSelect(div, id){
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    div.classList.toggle('selected', selected.has(id));
    updateDownloadBtn();
  }

  function loadBrowse(reset){
    if (reset) { browsePage = 1; selected.clear(); updateDownloadBtn(); }
    var libraryId = document.getElementById('browseLibrary').value;
    var grid = document.getElementById('mediaGrid');
    var status = document.getElementById('browseStatus');
    var loadMore = document.getElementById('loadMoreBtn');
    if (!libraryId) {
      grid.innerHTML = '';
      status.textContent = '请选择图库';
      loadMore.style.display = 'none';
      return;
    }
    status.textContent = '加载中…';
    api('/api/media?libraryId=' + encodeURIComponent(libraryId) + '&page=' + browsePage + '&pageSize=' + pageSize)
      .then(function(data){
        browseTotal = data.total || 0;
        if (reset) grid.innerHTML = '';
        if (!data.items || !data.items.length) {
          if (browsePage === 1) grid.innerHTML = '<p class="empty" style="grid-column:1/-1">该图库暂无图片</p>';
          status.textContent = '共 0 张';
          loadMore.style.display = 'none';
          return;
        }
        data.items.forEach(function(item){
          var div = document.createElement('div');
          div.className = 'thumb' + (selected.has(item.id) ? ' selected' : '');
          div.dataset.id = item.id;
          div.dataset.fileName = item.fileName || '';
          div.dataset.mediaType = item.mediaType || '';
          div.innerHTML = buildThumbMedia(item) + typeBadgeHtml(item) + '<span class="check">✓</span>';
          bindThumbSelect(div, item);
          grid.appendChild(div);
        });
        status.textContent = '已加载 ' + grid.children.length + ' / ' + browseTotal;
        loadMore.style.display = grid.children.length < browseTotal ? 'block' : 'none';
      }).catch(function(e){ status.textContent = e.message; toast(e.message); });
  }

  document.getElementById('browseLibrary').addEventListener('change', function(){ loadBrowse(true); });
  document.getElementById('loadMoreBtn').addEventListener('click', function(){ browsePage++; loadBrowse(false); });

  document.getElementById('selectAllBtn').addEventListener('click', function(){
    document.querySelectorAll('.thumb').forEach(function(el){
      selected.add(el.dataset.id);
      el.classList.add('selected');
    });
    updateDownloadBtn();
  });

  function updateDownloadBtn(){
    document.getElementById('downloadBtn').disabled = selected.size === 0;
  }

  function parseContentDisposition(header, fallback){
    if (!header) return fallback;
    var star = /filename\\*=UTF-8''([^;\\s]+)/i.exec(header);
    if (star) try { return decodeURIComponent(star[1]); } catch(e) {}
    var plain = /filename="([^"]+)"/i.exec(header);
    if (plain) return plain[1];
    return fallback;
  }

  function triggerBlobDownload(blob, fileName){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 2000);
  }

  function downloadSequentially(ids, index, btn){
    var statusEl = document.getElementById('browseStatus');
    if (index >= ids.length) {
      toast('全部下载完成');
      btn.disabled = selected.size === 0;
      return;
    }
    var id = ids[index];
    var thumb = document.querySelector('.thumb[data-id="' + id + '"]');
    var fallback = (thumb && thumb.dataset.fileName) || ('file-' + id.slice(0, 8));
    if (statusEl) statusEl.textContent = '下载中 ' + (index + 1) + '/' + ids.length + ' · ' + fallback;
    fetch('/api/media/' + id + '/file?token=' + encodeURIComponent(token), {
      headers: { 'X-Lan-Token': token }
    }).then(function(r){
      if (!r.ok) return r.json().then(function(j){ throw new Error(j.error || '下载失败'); });
      var name = parseContentDisposition(r.headers.get('Content-Disposition'), fallback);
      return r.blob().then(function(blob){ return { blob: blob, name: name }; });
    }).then(function(data){
      triggerBlobDownload(data.blob, data.name);
      setTimeout(function(){ downloadSequentially(ids, index + 1, btn); }, downloadIntervalMs);
    }).catch(function(e){
      toast(fallback + ': ' + e.message);
      setTimeout(function(){ downloadSequentially(ids, index + 1, btn); }, downloadIntervalMs);
    });
  }

  document.getElementById('downloadBtn').addEventListener('click', function(){
    if (!selected.size) return;
    var ids = Array.from(selected);
    var btn = document.getElementById('downloadBtn');
    btn.disabled = true;
    toast('开始逐个下载 ' + ids.length + ' 个文件');
    downloadSequentially(ids, 0, btn);
  });

  init();
})();
</script>
</body>
</html>`
}
