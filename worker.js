/**
 * FC3D Trend Chart - Cloudflare Worker V4
 * 完美复刻 新浪彩票 福彩3D基本走势图
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
  // 原始数据已经是最新在前，保持不变（最新期在表格最上方）
  return rawList.map(item => {
    const h = parseInt(item.one)||0, t = parseInt(item.two)||0, u = parseInt(item.three)||0;
    const sum = h+t+u;
    let ft, fg;
    if (h===t&&t===u) {ft='baozi';fg='豹子';}
    else if (h===t||t===u||h===u) {ft='zusan';fg='组三';}
    else {ft='zuliu';fg='组六';}
    const odds=[h,t,u].filter(x=>x%2===1).length;
    const bigs=[h,t,u].filter(x=>x>=5).length;
    const r0=[h,t,u].filter(x=>x%3===0).length;
    const r1=[h,t,u].filter(x=>x%3===1).length;
    const r2=3-r0-r1;
    const d=new Date(item.day.replace(/-/g,'/'));
    const wds=['日','一','二','三','四','五','六'];
    return {
      issue:item.code, date:item.day, weekday:wds[d.getDay()],
      numbers:[h,t,u], sum,
      span:Math.max(h,t,u)-Math.min(h,t,u),
      formType:ft, formTag:fg,
      oddRatio:`${odds}:${3-odds}`,
      bigRatio:`${bigs}:${3-bigs}`,
      routeRatio:`${r0}${r1}${r2}`,
      heWei:sum%10,
    };
  });
}

// 计算遗漏值：每个位置每个数字自上次出现以来的期数
function calcMissing(data) {
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

// 计算组选遗漏
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

// ===== 表格渲染（完美复刻新浪布局）=====
function renderTable(data) {
  const miss = calcMissing(data);
  const zxm = calcZuXuanMissing(data);
  
  let h = '<table id="tt"><thead>';
  
  // 第一行表头
  h += '<tr>';
  h += '<th rowspan="2" class="ci">期号</th>';
  h += '<th rowspan="2" class="cw">星期</th>';
  h += '<th rowspan="2" class="cn">奖号</th>';
  h += '<th rowspan="2" class="cs">和值</th>';
  h += '<th colspan="10" class="sb">百位号码走势</th>';
  h += '<th colspan="10" class="ss">十位号码走势</th>';
  h += '<th colspan="10" class="sg">个位号码走势</th>';
  h += '<th colspan="10" class="sz">组选号码分布</th>';
  h += '<th rowspan="2" class="cfm">形态<br>组六</th>';
  h += '<th rowspan="2" class="cfm">组三</th>';
  h += '<th rowspan="2" class="cfm">豹子</th>';
  h += '<th rowspan="2" classchw">和尾</th>';
  h += '<th rowspan="2" classcsp">跨度</th>';
  h += '<th rowspan="2" classcf">形态</th>';
  h += '<th rowspan="2" classco">奇偶比</th>';
  h += '<th rowspan="2" classcb">大小比</th>';
  h += '<th rowspan="2" classcr">012路<br>个数比</th>';
  h += '</tr>';

  // 第二行数字 0-9 x 4组
  h += '<tr>';
  for (let g = 0; g < 4; g++) {
    for (let d of DIGITS) {
      h += `<th class="cd">${d}</th>`;
    }
  }
  h += '</tr></thead><tbody>';

  data.forEach((row, idx) => {
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
    // 和值
    h += `<td class="sc">${row.sum}</td>`;

    // 百位走势 0-9
    for (let d of DIGITS) {
      const hit = row.numbers[0] === d;
      const mv = miss.bai[d][idx];
      h += `<td class="dc dt-bai" data-pos="bai" data-digit="${d}" data-row="${idx}" data-hit="${hit}">`;
      if (hit) {
        h += `<span class="ball hit-bai">${d}</span>`;
      } else {
        h += `<span class="miss-val">${mv}</span>`;
      }
      h += `</td>`;
    }

    // 十位走势 0-9
    for (let d of DIGITS) {
      const hit = row.numbers[1] === d;
      const mv = miss.shi[d][idx];
      h += `<td class="dc dt-shi" data-pos="shi" data-digit="${d}" data-row="${idx}" data-hit="${hit}">`;
      if (hit) {
        h += `<span class="ball hit-shi">${d}</span>`;
      } else {
        h += `<span class="miss-val">${mv}</span>`;
      }
      h += `</td>`;
    }

    // 个位走势 0-9
    for (let d of DIGITS) {
      const hit = row.numbers[2] === d;
      const mv = miss.ge[d][idx];
      h += `<td class="dc dt-ge" data-pos="ge" data-digit="${d}" data-row="${idx}" data-hit="${hit}">`;
      if (hit) {
        h += `<span class="ball hit-ge">${d}</span>`;
      } else {
        h += `<span class="miss-val">${mv}</span>`;
      }
      h += `</td>`;
    }

    // 组选分布 0-9
    for (let d of DIGITS) {
      const hit = row.numbers.includes(d);
      const mv = zxm[d][idx];
      h += `<td class="dc dt-zx" data-pos="zx" data-digit="${d}" data-row="${idx}" data-hit="${hit}">`;
      if (hit) {
        h += `<span class="ball hit-zx">${d}</span>`;
      } else {
        h += `<span class="miss-val">${mv}</span>`;
      }
      h += `</td>`;
    }

    // 形态组六/组三/豹子
    h += `<td class="fm-cell ${row.formType==='zuliu'?'fm-active':''}">组六</td>`;
    h += `<td class="fm-cell ${row.formType==='zusan'?'fm-active':''}">组三</td>`;
    h += `<td class="fm-cell ${row.formType==='baozi'?'fm-active':''}">豹子</td>`;

    // 和尾 跨度 形态 奇偶 大小 012路
    h += `<td class="hw">${row.heWei}</td>`;
    h += `<td class="sp">${row.span}</td>`;
    const fmClass = row.formType==='zuliu'?'fzl':(row.formType==='zusan'?'fzs':'fbz');
    h += `<td class="fmt ${fmClass}">${row.formTag}</td>`;
    h += `<td class="rat">${row.oddRatio}</td>`;
    h += `<td class="rat">${row.bigRatio}</td>`;
    h += `<td class="rt">${row.routeRatio}</td>`;

    h += '</tr>';
  });

  h += '</tbody></table>';
  return h;
}

/* ===== CSS 完美复刻新浪风格 ===== */
const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:"Microsoft YaHei","PingFang SC","Helvetica Neue",Helvetica,Arial,sans-serif;
  background:#f5f5f5;font-size:14px;color:#333;
  -webkit-font-smoothing:antialiased;
}

.header{background:#e03a3a;color:#fff;text-align:center;padding:16px 20px 12px;}
.header h1{font-size:22px;font-weight:700;letter-spacing:2px;margin-bottom:4px}
.header .sub{font-size:12px;opacity:.88;margin-bottom:8px}
.header .update-info{display:inline-block;background:rgba(255,255,255,.18);border-radius:12px;padding:2px 14px;font-size:11.5px}

.nav-tabs{background:#fff;display:flex;align-items:center;border-bottom:2px solid #e03a3a;padding:0 10px;overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap;}
.nav-tabs .tab{padding:10px 14px;font-size:13px;color:#666;cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;transition:.2s;flex-shrink:0}
.nav-tabs .tab.active{color:#e03a3a;font-weight:700;border-bottom-color:#e03a3a}
.nav-tabs .tab:hover{color:#e03a3a}

.toolbar{background:#fffbf0;padding:8px 14px;display:flex;gap:6px;align-items:center;border-bottom:1px solid #eee;flex-wrap:wrap}
.toolbar .period-btn{padding:5px 14px;border:1px solid #ddd;border-radius:4px;cursor:pointer;background:#fff;font-size:12px;transition:.2s}
.toolbar .period-btn:hover{background:#e03a3a;color:#fff;border-color:#e03a3a}
.toolbar .period-btn.active{background:#e03a3a;color:#fff;border-color:#e03a3a}
.toolbar .expert-btn{margin-left:auto;padding:5px 16px;background:#e03a3a;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer}
.toolbar .status-text{color:#999;font-size:11px;margin-left:auto}

.table-wrap{overflow-x:auto;padding:8px 4px;background:#fff;position:relative;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:max-content;min-width:100%;font-size:12.5px}

/* 表头 */
thead th{border:1px solid #e0c8b8;padding:6px 3px;text-align:center;font-weight:700;color:#555;font-size:11.5px;white-space:nowrap;background:#fff8f0;position:sticky;z-index:99}
thead tr:first-child th{top:0;z-index:101}
thead tr:nth-child(2) th{top:33px;z-index:100}
thead th.sb{background:#ffe4de;color:#c0392b;font-size:11.5px}
thead th.ss{background:#ddeaff;color:#2980b9;font-size:11.5px}
thead th.sg{background:#ddf0dd;color:#27ae60;font-size:11.5px}
thead th.sz{background:#fff3cd;color:#856404;font-size:11.5px}
thead th.cfm{background:#f5f5f5;color:#666;font-size:10.5px;width:36px;line-height:1.35}
thead th.chw{width:28px}
thead th.csp{width:28px}
thead th.cf{width:34px}
thead th.co{width:38px}
thead th.cb{width:38px}
thead th.cr{width:40px;line-height:1.3}
thead th.cd{width:26px;font-weight:800;font-size:12px;color:#333;background:#fafafa}
thead th.ci{width:72px}thead th.cw{width:30px}thead th.cn{width:56px}thead th.cs{width:28px}

/* 数据行 */
tbody tr{border:none}
tbody tr:nth-child(even){background:#fffcf8}
tbody tr:hover{background:#fff3e0}
td{border:1px solid #e8dfd2;text-align:center;height:32px;vertical-align:middle;white-space:nowrap;position:relative;padding:0}

/* 期号 星期 */
.ic{font-weight:700;color:#e03a3a;font-size:12px;background:#fff5f0}
.wc{color:#888;font-size:11px;background:#fafafa}

/* 奖号球 */
.nc{padding:2px 4px !important}
.nc .b{display:inline-block;width:22px;height:22px;line-height:22px;border-radius:50%;font-weight:700;font-size:12px;color:#fff;margin:0 1px;text-shadow:0 1px 1px rgba(0,0,0,.2)}
.br{background:linear-gradient(135deg,#e74c3c,#c0392b)}
.bl{background:linear-gradient(135deg,#3498db,#2980b9)}
.bg{background:linear-gradient(135deg,#27ae60,#1e8449)}

/* 和值 */
.sc{font-weight:700;color:#2980b9;font-size:12.5px}

/* 数字格子 */
.dc{width:26px;height:32px;padding:0 !important;background:linear-gradient(#fff,#fefefa);position:relative}
.dt-bai{border-left:2px solid #f5d0d0}
.dt-shi{border-left:2px solid #d0e4f5}
.dt-ge{border-left:2px solid #d0f0d0}
.dt-zx{border-left:2px solid #f5ecd0}

/* 中奖圆球 */
.dc .ball{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:20px;height:20px;line-height:20px;border-radius:50%;font-size:11px;font-weight:700;color:#fff;z-index:5;text-shadow:0 1px 1px rgba(0,0,0,.25)}
.hit-bai{background:linear-gradient(135deg,#e74c3c,#c0392b);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(192,57,43,.4)}
.hit-shi{background:linear-gradient(135deg,#3498db,#2980b9);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(41,128,185,.4)}
.hit-ge{background:linear-gradient(135deg,#27ae60,#1e8449);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(39,174,96,.4)}
.hit-zx{background:linear-gradient(135deg,#f39c12,#e67e22);border:1.5px solid #fff;box-shadow:0 1px 3px rgba(230,126,34,.4)}

.miss-val{font-size:10px;color:#aaa;line-height:32px;display:block}

/* SVG连线层 */
svg.trend-layer{position:absolute;top:0;left:0;pointer-events:none;z-index:15;overflow:visible}

/* 右侧数据列 */
.hw{font-weight:600;color:#8e44ad;font-size:11.5px}
.sp{font-weight:600;color:#e74c3c;font-size:11.5px}
.fmt{font-size:11px;font-weight:600}
.fzl{color:#27ae60}.fzs{color:#e67e22}.fbz{color:#e74c3c}
.rat{font-size:11.5px;color:#555}
.rt{font-weight:700;color:#d35400;font-size:11.5px;letter-spacing:.5px}

/* 形态单元格 */
.fm-cell{font-size:10.5px;color:#bbb;width:36px}
.fm-cell.fm-active{font-weight:700;color:#333}
`;

const JS = `
(function(){
var showLines = true;

window.toggleLines = function() {
  showLines = !showLines;
  var layer = document.getElementById('trend-svg');
  if (layer) layer.style.display = showLines ? 'block' : 'none';
};

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

      points.forEach(function(p) {
        var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', p.x);
        circle.setAttribute('cy', p.y);
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', cfg.color);
        circle.setAttribute('stroke', '#ffffff');
        circle.setAttribute('stroke-width', '1.5');
        svg.appendChild(circle);
      });
    }
  });
}

setTimeout(drawTrends, 500);

var resizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function() {
    var layer = document.getElementById('trend-svg');
    if (layer) layer.remove();
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
      const latestDate = data.length > 0 ? data[0].date : new Date().toLocaleDateString('zh-CN');
      const rangeInfo = data.length > 0 
        ? '期数范围: ' + data[0].issue + ' → ' + data[data.length-1].issue 
        : '';

      const body = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">'
        + '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
        + '<title>福彩3D走势图 - 最近120期</title>'
        + '<style>' + CSS + '</style></head><body>'
        
        + '<div class="header"><h1>福彩3D基本走势图</h1>'
        + '<div class="sub">中国福利彩票 · 基本走势（百位/十位/个位 + 组选分布）</div>'
        + '<div class="update-info">数据时间: ' + latestDate + ' · 共 ' + data.length + ' 期</div></div>'
        
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
        + '<span class="status-text">' + rangeInfo + '</span></div>'
        
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
