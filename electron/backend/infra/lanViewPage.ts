import { APP_DISPLAY_NAME } from '../../../shared/appMeta'

/** 单媒体预览页（扫码分享打开，含下载按钮） */
export function buildLanViewPageHtml(): string {
  const appName = APP_DISPLAY_NAME
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"/>
<title>${appName} · 预览</title>
<style>
:root{--bg:#F5F5F7;--card:#FFF;--text:#1D1D1F;--muted:#86868B;--accent:#007AFF;--border:rgba(0,0,0,.08);--radius:14px}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;background:var(--bg);color:var(--text);min-height:100dvh;padding:16px;padding-bottom:32px}
header{text-align:center;margin-bottom:16px}
header h1{font-size:20px;font-weight:700}
header p{font-size:13px;color:var(--muted);margin-top:6px;word-break:break-all}
.preview-card{background:var(--card);border-radius:var(--radius);border:1px solid var(--border);overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)}
.preview-media{background:#000;display:flex;align-items:center;justify-content:center;min-height:200px;max-height:70vh}
.preview-media img,.preview-media video{max-width:100%;max-height:70vh;display:block}
.type-pill{display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:8px;margin-top:8px}
.type-pill.gif{background:#FF9500;color:#fff}
.type-pill.video{background:#1D1D1F;color:#fff}
.type-pill.photo{background:#E8E8ED;color:var(--text)}
.meta{padding:14px 16px;font-size:12px;color:var(--muted);line-height:1.6}
.btn{display:flex;align-items:center;justify-content:center;width:calc(100% - 32px);margin:16px auto 0;padding:14px;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;background:var(--accent);color:#fff;text-decoration:none}
.btn:active{opacity:.85}
.btn:disabled{opacity:.45;pointer-events:none}
.error{text-align:center;padding:40px 16px;color:var(--muted)}
</style>
</head>
<body>
<header>
  <h1>${appName}</h1>
  <p id="fileName">加载中…</p>
  <span id="typePill" class="type-pill photo" style="display:none"></span>
</header>
<div id="content" class="preview-card">
  <div class="preview-media" id="mediaWrap"><p class="error">加载中…</p></div>
  <div class="meta" id="meta"></div>
</div>
<a id="downloadBtn" class="btn" href="#" download style="display:none">下载到手机</a>
<p id="error" class="error" style="display:none"></p>
<script>
(function(){
  var token = new URLSearchParams(location.search).get('token') || sessionStorage.getItem('lanToken') || '';
  if (token) sessionStorage.setItem('lanToken', token);
  var parts = location.pathname.split('/').filter(Boolean);
  var mediaId = parts[parts.length - 1] || '';
  var fileUrl = '/api/media/' + encodeURIComponent(mediaId) + '/file?token=' + encodeURIComponent(token);
  var metaUrl = '/api/media/' + encodeURIComponent(mediaId) + '/meta?token=' + encodeURIComponent(token);

  function isGif(m){ return m.mediaType === 'gif' || /\\.gif$/i.test(m.fileName||''); }
  function isVideo(m){ return m.mediaType === 'video' || /\\.(mp4|mov|avi|mkv|webm)$/i.test(m.fileName||''); }
  function typeLabel(m){
    if (isGif(m)) return { text: '动图 GIF', cls: 'gif' };
    if (isVideo(m)) return { text: '视频', cls: 'video' };
    return { text: '图片', cls: 'photo' };
  }

  function showError(msg){
    document.getElementById('error').textContent = msg;
    document.getElementById('error').style.display = 'block';
    document.getElementById('content').style.display = 'none';
  }

  if (!token || !mediaId) { showError('链接无效，请从电脑端重新扫码'); return; }

  fetch(metaUrl, { headers: { 'X-Lan-Token': token } })
    .then(function(r){
      if (!r.ok) throw new Error(r.status === 401 ? '访问令牌无效' : '无法加载媒体信息');
      return r.json();
    })
    .then(function(m){
      document.getElementById('fileName').textContent = m.fileName || '未命名';
      var tl = typeLabel(m);
      var pill = document.getElementById('typePill');
      pill.textContent = tl.text;
      pill.className = 'type-pill ' + tl.cls;
      pill.style.display = 'inline-block';
      var meta = [];
      if (m.width && m.height) meta.push(m.width + ' × ' + m.height);
      if (m.fileSize) meta.push((m.fileSize / 1024 / 1024).toFixed(2) + ' MB');
      document.getElementById('meta').textContent = meta.join(' · ');
      var wrap = document.getElementById('mediaWrap');
      wrap.innerHTML = '';
      var inlineUrl = fileUrl + '&inline=1';
      if (isVideo(m)) {
        var v = document.createElement('video');
        v.src = inlineUrl;
        v.controls = true;
        v.playsInline = true;
        v.setAttribute('webkit-playsinline','');
        v.preload = 'auto';
        wrap.appendChild(v);
      } else {
        var img = document.createElement('img');
        img.src = inlineUrl;
        img.alt = m.fileName || '';
        img.loading = 'eager';
        wrap.appendChild(img);
      }
      var dl = document.getElementById('downloadBtn');
      dl.href = fileUrl;
      dl.download = m.fileName || 'download';
      dl.style.display = 'flex';
    })
    .catch(function(e){ showError(e.message); });
})();
</script>
</body>
</html>`
}
