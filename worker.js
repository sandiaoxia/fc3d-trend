/**
 * FC3D Trend Chart - Cloudflare Worker V5
 * 精简布局: 期号递增排列 + 组选/走势交替 + 去掉所有右侧统计列
 * 数据源: huiNiao API (api.huiniao.top)
 */
const API_URL = 'http://api.huiniao.top/interface/home/lotteryHistory?type=fcsd&page=1&limit=120';
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
};
const DIGITS = [0,1,2,3,4,5,6,7,8,9];

function processData(apiJson) {
  const rawList = (apiJson.data && apiJson.data.data && apiJson.data.data.list)
    ? apiJson.data.data.list : [];
  return rawList.map(item => {
    const h = parseInt(item.one)||0, t = parseInt(item.two)||0, u = parseInt(item.three)||0;
    const d = new Date(item.day.replace(/-/g,'/'));
    const wds = ['日','一','二','三','四','五','六'];
    return {
      issue: item.code,
      date: item.day,
      weekday: wds[d.getDay()],
      numbers: [h, t, u],
    };
  });
}

// 计算位置遗漏值（百位/十位/个位）— 基于当前数据排列顺序
function calcPosMissing(data) {
  const miss = { bai:{}, shi:{}, ge:{} };
  for (let d of DIGITS) { miss.bai[d]=[]; miss.shi[d]=[]; miss.ge[d]=[]; }
  let lastBai={}, lastShi={}, lastGe={};
  for (let d of DIGITS) { lastBai[d]=-1; lastShi[d]=-1; lastGe[d]=-1; }

  data.forEach((row, idx) => {
    for (let d of DIGITS) {
      miss.bai[d].push(idx - lastBai[d]);
      miss.shi[d].push(idx - lastShi[d]);
      miss.ge[d].push(idx - lastGe[d]);
    }
    lastBai[row.numbers[0]] = idx;
    lastShi[row.numbers[1]] = idx;
    lastGe[row.numbers[2]] = idx;
  });
  return miss;
}

// 计算组选遗漏值（三个号码的集合）
function calcZuXuanMissing(data) {
  const miss = {};
  for (let d of DIGITS) { miss[d] = []; }
  let last = {};
  for (let d of DIGITS) { last[d] = -1; }

  data.forEach((row, idx) => {
    for (let d of DIGITS) {
      miss[d].push(idx - last[d]);
    }
    for (let n of row.numbers) {
      last[n] = idx;
    }
  });
  return miss;
}

// ===== V5 表格渲染 =====
// 列: 期号 | 星期 | 奖号 | 组选(0-9) | 百位走势(0-9) | 组选(0-9) | 十位走势(0-9) | 组选(0-9) | 个位走势(0-9) | 组选(0-9)
// = 3信息列 + 7组×10数据列 = 73列 = 2286px
function renderTable(data) {
  // 关键：反转数据，使最老期在上，最新期在下（期号递增）
  const revData = [...data].reverse();
  
  const posMiss = calcPosMissing(revData);
  const zxMiss = calcZuXuanMissing(revData);
  
  let h = '<table id="tt"><colgroup>';
  // 信息列：期号72px + 星期30px + 奖号84px = 186px
  h += '<col class="ci" style="width:72px" />';
  h += '<col class="cw" style="width:30px" />';
  h += '<col class="cn" style="width:84px" />';
  // 7组数据列(4组选+3走势)，每组10列×30px = 300px，7组共2100px
  for (let g = 0; g < 7; g++) {
    for (let d = 0; d < 10; d++) {
      h += '<col style="width:30px" />';
    }
  }
  h += '</colgroup><thead>';

  // 第一行表头
  h += '<tr>';
  h += '<th rowspan="2" class="ci">期号</th>';
  h += '<th rowspan="2" class="cw">星期</th>';
  h += '<th rowspan="2" class="cn">奖号</th>';
  h += '<th colspan="10" class="sz">组选号码分布</th>';
  h += '<th colspan="10" class="sb">百位号码走势</th>';
  h += '<th colspan="10" class="sz2">组选号码分布</th>';
  h += '<th colspan="10" class="ss">十位号码走势</th>';
  h += '<th colspan="10" class="sz3">组选号码分布</th>';
  h += '<th colspan="10" class="sg">个位号码走势</th>';
  h += '<th colspan="10" class="sz4">组选号码分布</th>';
  h += '</tr>';

  // 第二行数字 0-9 x 8组
  h += '<tr>';
  for (let g = 0; g < 8; g++) {
    for (let d of DIGITS) {
      h += `<th class="cd">${d}</th>`;
    }
  }
  h += '</tr></thead><tbody>';

  revData.forEach((row, idx) => {
    h += `<tr data-i="${idx}">`;
    
    // 期号
    h += `<td class="ic">${row.issue}</td>`;
    // 星期
    h += `<td class="wc">${row.weekday}</td>`;
    // 奖号球
    h += `<td class="nc">`;
    row.numbers.forEach((n, i) => {
      const c = i === 0 ? 'br' : (i === 1 ? 'bl' : 'bg');
      h += `<span class="b ${c}">${n}</span>`;
    });
    h += `</td>`;

    // ===== 组选分布 #1 (0-9) — 紫色系 =====
    for (let d of DIGITS) {
      const hit = row.numbers.includes(d);
      h += `<td class="dc dt-zx1" data-pos="zx1" data-digit="${d}" data-row="${idx}" data-hit="${hit}">`;
      if (hit) {
        h += `<span class="ball hit-zx1">${d}</span>`;
      }
      h += `</td>`;
    }

    // ===== 百位走势 (0-9) =====
    for (let d of DIGITS) {
      const hit = row.numbers[0] === d;
      h += `<td class="dc dt-bai" data-pos="bai" data-digit="${d}" data-row="${idx}" data-hit="${hit}">`;
      if (hit) {
        h += `<span class="ball hit-bai">${d}</span>`;
      }
      h += `</td>`;
    }

    // ===== 组选分布 #2 (0-9) — 橙色系 =====
    for (let d of DIGITS) {
      const hit = row.numbers.includes(d);
      h += `<td class="dc dt-zx2" data-pos="zx2" data-digit="${d}" data-row="${idx}" data-hit="${hit}">`;
      if (hit) {
        h += `<span class="ball hit-zx2">${d}</span>`;
      }
      h += `</td>`;
    }

    // ===== 十位走势 (0-9) =====
    for (let d of DIGITS) {
      const hit = row.numbers[1] === d;
      h += `<td class="dc dt-shi" data-pos="shi" data-digit="${d}" data-row="${idx}" data-hit="${hit}">`;
      if (hit) {
        h += `<span class="ball hit-shi">${d}</span>`;
      }
      h += `</td>`;
    }

    // ===== 组选分布 #3 (0-9) — 金黄色系 =====
    for (let d of DIGITS) {
      const hit = row.numbers.includes(d);
      h += `<td class="dc dt-zx3" data-pos="zx3" data-digit="${d}" data-row="${idx}" data-hit="${hit}">`;
      if (hit) {
        h += `<span class="ball hit-zx3">${d}</span>`;
      }
      h += `</td>`;
    }

    // ===== 个位走势 (0-9) =====
    for (let d of DIGITS) {
      const hit = row.numbers[2] === d;
      h += `<td class="dc dt-ge" data-pos="ge" data-digit="${d}" data-row="${idx}" data-hit="${hit}">`;
      if (hit) {
        h += `<span class="ball hit-ge">${d}</span>`;
      }
      h += `</td>`;
    }

    // ===== 组选分布 #4 (0-9) — 粉色系 =====
    for (let d of DIGITS) {
      const hit = row.numbers.includes(d);
      h += `<td class="dc dt-zx4" data-pos="zx4" data-digit="${d}" data-row="${idx}" data-hit="${hit}">`;
      if (hit) {
        h += `<span class="ball hit-zx4">${d}</span>`;
      }
      h += `</td>`;
    }

    h += '</tr>';
  });

  h += '</tbody></table>';
  return h;
}

/* ===== CSS V7.5 ===== */
/* 自动缩放布局: body固定2286px + JS自动scale()铺满视口。
   宽屏下内容左右铺满(等价于自动缩放)，窄屏横向滚动。
   信息列(期号/星期/奖号)保持固定px，数据列固定30px。 */
const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html{
  background:#f0f0f0;
  min-height:100vh;
  overflow-x:hidden;           /* 防止缩放后出现横向滚动条 */
}
body{
  font-family:"Microsoft YaHei","PingFang SC","Helvetica Neue",Helvetica,Arial,sans-serif;
  background:#fff;font-size:14px;color:#333;
  width:2286px;               /* 固定=表格精确宽度 */
  max-width:100vw;            /* 窄屏时收缩 */
  min-width:2286px;           /* 不压缩(窄屏靠横向滚动) */
  box-shadow:0 0 40px rgba(0,0,0,.08);
  -webkit-font-smoothing:antialiased;
}

.header{background:#e03a3a;color:#fff;text-align:center;padding:16px 20px 12px}
.header h1{font-size:22px;font-weight:700;letter-spacing:2px;margin-bottom:4px}
.header .sub{font-size:12px;opacity:.88;margin-bottom:8px}
.header .update-info{display:inline-block;background:rgba(255,255,255,.18);border-radius:12px;padding:2px 14px;font-size:11.5px}

.nav-tabs{background:#fff;display:flex;align-items:center;border-bottom:2px solid #e03a3a;padding:0 10px;overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap}
.nav-tabs .tab{padding:10px 14px;font-size:13px;color:#666;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;transition:.2s;flex-shrink:0}
.nav-tabs .tab.active{color:#e03a3a;font-weight:700;border-bottom-color:#e03a3a}
.nav-tabs .tab:hover{color:#e03a3a}

.toolbar{background:#fffbf0;padding:8px 14px;display:flex;gap:6px;align-items:center;border-bottom:1px solid #eee;flex-wrap:wrap}
.toolbar .period-btn{padding:5px 14px;border:1px solid #ddd;border-radius:4px;cursor:pointer;background:#fff;font-size:12px;transition:.2s}
.toolbar .period-btn:hover{background:#e03a3a;color:#fff;border-color:#e03a3a}
.toolbar .period-btn.active{background:#e03a3a;color:#fff;border-color:#e03a3a}
.toolbar .expert-btn{margin-left:auto;padding:5px 16px;background:#e03a3a;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer}
.toolbar .status-text{color:#999;font-size:11px;margin-left:auto}

.table-wrap{overflow-x:auto;padding:8px 0;background:#fff;position:relative;-webkit-overflow-scrolling:touch}
/* 表格固定2286px: 与body宽度一致 */
table{border-collapse:collapse;width:2286px;table-layout:fixed;font-size:12.5px}

/* 表头 */
thead th{border:1px solid #e0c8b8;padding:6px 3px;text-align:center;font-weight:700;color:#555;font-size:11.5px;white-space:nowrap;background:#fff8f0;position:sticky;z-index:99}
thead tr:first-child th{top:0;z-index:101}
thead tr:nth-child(2) th{top:37px;z-index:100}

/* 分类标题色 — 组选1(紫)、百位(红)、组选2(橙)、十位(蓝)、组选3(金)、个位(绿)、组选4(粉) */
thead th.sz{background:#e8daef;color:#6c3483;font-size:11.5px}
thead th.sz2{background:#fdebd0;color:#b9770e;font-size:11.5px}
thead th.sz3{background:#fcf3cf;color:#9a7d0a;font-size:11.5px}
thead th.sz4{background:#fadbd8;color:#922b21;font-size:11.5px}
thead th.sb{background:#ffe4de;color:#c0392b;font-size:11.5px}
thead th.ss{background:#ddeaff;color:#2980b9;font-size:11.5px}
thead th.sg{background:#ddf0dd;color:#27ae60;font-size:11.5px}

thead th.cd{width:30px;font-weight:800;font-size:13px;color:#333;background:#fafafa}
thead th.ci{width:72px}thead th.cw{width:30px}thead th.cn{width:84px}

/* 数据行 */
tbody tr{border:none}
tbody tr:nth-child(even){background:#fffcf8}
tbody tr:hover{background:#fff3e0}
td{border:1px solid #e8dfd2;text-align:center;height:36px;vertical-align:middle;white-space:nowrap;position:relative;padding:0}

/* 期号 星期 */
.ic{font-weight:700;color:#e03a3a;font-size:12px;background:#fff5f0}
.wc{color:#888;font-size:11px;background:#fafafa}

/* 奖号球 */
.nc{padding:2px 4px !important}
.nc .b{display:inline-block;width:26px;height:26px;line-height:26px;border-radius:50%;font-weight:700;font-size:16px;color:#fff;margin:0 1px;text-shadow:0 1px 1px rgba(0,0,0,.2)}
.br{background:linear-gradient(135deg,#e74c3c,#c0392b)}
.bl{background:linear-gradient(135deg,#3498db,#2980b9)}
.bg{background:linear-gradient(135deg,#27ae60,#1e8449)}

/* 数据格子 — table-layout:fixed下精确30px宽度 */
.dc{width:30px;height:36px;padding:0 !important;background:linear-gradient(#fff,#fefefa);position:relative}
.dt-zx1{border-left:2px solid #d7bde2}
.dt-zx2{border-left:2px solid #f5cba7}
.dt-zx3{border-left:2px solid #f9e79f}
.dt-zx4{border-left:2px solid #f5b7b1}
.dt-bai{border-left:2px solid #f5d0d0}
.dt-shi{border-left:2px solid #d0e4f5}
.dt-ge{border-left:2px solid #d0f0d0}

/* 中奖圆球 — 绝对定位居中于固定宽度格子内 */
.dc .ball{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:26px;height:26px;line-height:26px;border-radius:50%;font-size:15px;font-weight:700;color:#fff;z-index:5;text-shadow:0 1px 1px rgba(0,0,0,.25)}
.hit-bai{background:linear-gradient(135deg,#e74c3c,#c0392b);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(192,57,43,.4)}
.hit-shi{background:linear-gradient(135deg,#3498db,#2980b9);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(41,128,185,.4)}
.hit-ge{background:linear-gradient(135deg,#27ae60,#1e8449);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(39,174,96,.4)}
/* 组选分布4种颜色 */
.hit-zx1{background:linear-gradient(135deg,#9b59b6,#8e44ad);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(142,68,173,.45)}
.hit-zx2{background:linear-gradient(135deg,#e67e22,#d35400);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(211,84,0,.4)}
.hit-zx3{background:linear-gradient(135deg,#f1c40f,#d4ac0d);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(212,172,13,.4)}
.hit-zx4{background:linear-gradient(135deg,#e91e63,#c2185b);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(194,24,91,.4)}

.miss-val{font-size:11px;color:#aaa;line-height:36px;display:block}

/* SVG连线层 */
svg.trend-layer{position:absolute;top:0;left:0;pointer-events:none;z-index:15;overflow:visible}
`;

const JS = `
(function(){
var showLines = true;

window.toggleLines = function() {
  showLines = !showLines;
  var layer = document.getElementById('trend-svg');
  if (layer) layer.style.display = showLines ? 'block' : 'none';
};

/* ===== 自动缩放：让2286px内容铺满视口（不小于100%） ===== */
function autoScale() {
  var body = document.body;
  var vw = window.innerWidth;
  var targetWidth = 2286;   /* body实际内容宽 */
  if (vw > targetWidth) {
    var scale = vw / targetWidth;
    body.style.transformOrigin = 'top center';
    body.style.transform = 'scale(' + scale.toFixed(4) + ')';
    /* 缩放后body占用的视觉高度 */
    var fullHeight = body.scrollHeight * scale;
    document.documentElement.style.height = fullHeight + 'px';
  } else {
    body.style.transform = 'none';
    document.documentElement.style.height = '';
  }
}

function drawTrends() {
  var table = document.getElementById('tt');
  if (!table) return;

  var oldLayer = document.getElementById('trend-svg');
  if (oldLayer) oldLayer.remove();

  var tbody = table.querySelector('tbody');
  var tRect = table.getBoundingClientRect();
  var tbRect = tbody.getBoundingClientRect();

  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'trend-svg';
  svg.setAttribute('class', 'trend-layer trend-path');
  svg.setAttribute('width', tbRect.width);
  svg.setAttribute('height', tbRect.height);
  svg.style.position = 'absolute';
  svg.style.top = (tbRect.top - tRect.top) + 'px';
  svg.style.left = (tbRect.left - tRect.left) + 'px';
  table.style.position = 'relative';
  table.appendChild(svg);

  // 只对三个位置画走势连线
  var configs = [
    { pos: 'bai', color: '#e74c3c', strokeColor: '#c0392b' },
    { pos: 'shi', color: '#3498db', strokeColor: '#2980b9' },
    { pos: 'ge',  color: '#27ae60', strokeColor: '#1e8449' }
  ];

  configs.forEach(function(cfg) {
    var points = [];
    var cells = document.querySelectorAll('td[data-pos="' + cfg.pos + '"][data-hit="true"]');
    
    cells.forEach(function(cell) {
      var ball = cell.querySelector('.ball');
      if (!ball) return;
      
      var ballRect = ball.getBoundingClientRect();
      points.push({
        x: ballRect.left - tbRect.left + ballRect.width / 2,
        y: ballRect.top - tbRect.top + ballRect.height / 2,
        digit: cell.dataset.digit,
        row: parseInt(cell.dataset.row)
      });
    });

    if (points.length < 2) return;

    var pathD = '';
    points.forEach(function(p, i) {
      pathD += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
    });

      if (pathD) {
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', pathD);
      line.setAttribute('stroke', cfg.strokeColor);
      line.setAttribute('stroke-width', '1.8');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-linejoin', 'round');
      line.setAttribute('opacity', '0.65');
      svg.appendChild(line);
      }
  });
}

/* 初始化：先缩放适配 → 再画连线 */
autoScale();
setTimeout(function(){ drawTrends(); }, 600);

var resizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    /* 重缩放后重绘连线 */
    var layer = document.getElementById('trend-svg');
    if (layer) layer.remove();
    autoScale();
    setTimeout(drawTrends, 400);
  }, 300);
});
})();
`;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/data') {
      try {
        const r = await fetch(API_URL, { headers: FETCH_HEADERS });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (j.code !== 1) throw new Error(j.info || 'API error');
        return new Response(JSON.stringify(processData(j)), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status:500 });
      }
    }

    try {
      const r = await fetch(API_URL, { headers: FETCH_HEADERS });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (j.code !== 1) throw new Error(j.info || 'API error');

      const data = processData(j);
      // 反转后：第一行是最老期，最后一行是最新期
      const revData = [...data].reverse();
      const oldestIssue = revData.length > 0 ? revData[0].issue : '';
      const latestIssue = revData.length > 0 ? revData[revData.length-1].issue : '';
      const latestDate = revData.length > 0 ? revData[revData.length-1].date : '';

      const body = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">'
        + '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
        + '<title>福彩3D走势图 - 最近120期</title>'
        + '<style>' + CSS + '</style></head><body>'
        
        + '<div class="header"><h1>福彩3D基本走势图</h1>'
        + '<div class="sub">中国福利彩票 · 基本走势（组选分布 + 百位/十位/个位走势）</div>'
        + '<div class="update-info">数据时间: ' + latestDate + ' · 共 ' + data.length + ' 期 · 范围: ' + oldestIssue + ' → ' + latestIssue + '</div></div>'
        
        + '<div class="nav-tabs">'
        + '<div class="tab active">基本走势</div>'
        + '<div class="tab">和值和尾</div>'
        + '<div class="tab">跨度走势</div>'
        + '<div class="tab">012路综合</div>'
        + '<div class="tab">直选形态</div>'
        + '<div class="tab">直选综合</div>'
        + '<div class="tab">组选综合</div>'
        + '<div class="tab">和尾走势</div>'
        + '<div class="tab">组三走势</div>'
        + '<div class="tab">大小形态</div>'
        + '<div class="tab">奇偶形态</div>'
        + '<div class="tab">质合形态</div>'
        + '<div class="tab">二码走势</div>'
        + '<div class="tab">百位走势</div>'
        + '<div class="tab">十位走势</div>'
        + '<div class="tab">个位走势</div>'
        + '</div>'
        
        + '<div class="toolbar">'
        + '<div class="period-btn active">120期</div>'
        + '<div class="period-btn">80期</div>'
        + '<div class="period-btn">50期</div>'
        + '<div class="period-btn">300期</div>'
        + '<div class="period-btn">500期</div>'
        + '<button class="expert-btn" onclick="location.reload()">查看专家推荐</button>'
        + '<span class="status-text">' + oldestIssue + ' → ' + latestIssue + ' (递增)</span></div>'
        
        + '<div class="table-wrap" id="tc">' + renderTable(data) + '</div>'
        
        + '<div style="text-align:center;padding:12px;background:#fff;border-top:1px solid #eee;">'
        + '<button onclick="toggleLines()" style="padding:8px 24px;cursor:pointer;border:1px solid #ddd;border-radius:6px;background:#fff;font-size:13px;">📈 切换走势线</button>&nbsp;'
        + '<button onclick="window.scrollTo({top:0,behavior:\'smooth\'})" style="padding:8px 24px;cursor:pointer;border:1px solid #ddd;border-radius:6px;background:#fff;font-size:13px;">⬆ 回顶部</button>&nbsp;'
        + '<button onclick="location.reload()" style="padding:8px 24px;cursor:pointer;border:1px solid #ddd;border-radius:6px;background:#fff;font-size:13px;">🔄 刷新数据</button>'
        + '</div>'
        
        + '<script>' + JS + '</script></body></html>';

      return new Response(body, {
        headers: { 'Content-Type':'text/html;charset=utf-8', 'Cache-Control':'public,max-age=300' }
      });

    } catch (e) {
      return new Response(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Error</title>'
        + '<style>body{display:flex;align-items:center;justify-content:center;height:100vh;'
        + 'font-family:sans-serif;color:#e74c3c;text-align:center;background:#f5f5f5}'
        + 'button{margin-top:16px;padding:10px 24px;cursor:pointer;border:1px solid #ccc;border-radius:6px}'
        + 'button:hover{background:#e74c3c;color:#fff;border-color:#e74c3c}</style></head>'
        + '<body><div><p style="font-size:20px;font-weight:700">❌ 数据获取失败</p>'
        + '<p style="color:#888;font-size:13px">' + e.message + '</p>'
        + '<button onclick="location.reload()">重新加载</button></div></body></html>',
        { status:500, headers:{'Content-Type':'text/html;charset=utf-8'} }
      );
    }
  }
};
