/* ═══════════════════════════════════════════════════════════
 * PIXEL DUNGEON CODEX — 병합 준비 버전 (원본 무수정)
 *  - IIFE 캡슐화: 내부 심볼이 전역으로 새지 않음
 *  - 외부 API: window.PixelCodex.{init,setMode,openDlg,getFrames,getEntity,
 *              buildGrid,blit,state,DATA}
 * ═══════════════════════════════════════════════════════════ */
var PixelCodex=(function(){
'use strict';

/* ===== 그리드 & 그리기 헬퍼 ===== */
var W=32,H=32;
function mkG(){var a=[],y,x;for(y=0;y<H;y++){a.push([]);for(x=0;x<W;x++)a[y].push(null);}return a;}
function put(g,x,y,c){x=x|0;y=y|0;if(x>=0&&x<W&&y>=0&&y<H)g[y][x]=c;}
function rc(g,x,y,w,h,c){for(var j=0;j<h;j++)for(var i=0;i<w;i++)put(g,x+i,y+j,c);}
function el(g,cx,cy,rx,ry,c){for(var y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)
 for(var x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){var dx=(x-cx)/rx,dy=(y-cy)/ry;if(dx*dx+dy*dy<=1.05)put(g,x,y,c);}}
function ln(g,x0,y0,x1,y1,c,w){w=w||1;var n=Math.max(1,Math.abs(x1-x0),Math.abs(y1-y0)),i;
 for(i=0;i<=n;i++){var x=Math.round(x0+(x1-x0)*i/n),y=Math.round(y0+(y1-y0)*i/n),d;
  for(d=0;d<w;d++)put(g,x+d,y,c);}}
function hl(g,x0,x1,y,c){for(var x=Math.min(x0,x1);x<=Math.max(x0,x1);x++)put(g,x,y,c);}
function vl(g,x,y0,y1,c){for(var y=Math.min(y0,y1);y<=Math.max(y0,y1);y++)put(g,x,y,c);}
function poly(g,pts,c){var ys=pts.map(function(p){return p[1];});
 var y0=Math.floor(Math.min.apply(null,ys)),y1=Math.ceil(Math.max.apply(null,ys)),y,i,k;
 for(y=y0;y<=y1;y++){var xs=[];
  for(i=0;i<pts.length;i++){var a=pts[i],b=pts[(i+1)%pts.length];
   if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));}
  xs.sort(function(m,n){return m-n;});
  for(k=0;k+1<xs.length;k+=2)for(var x=Math.round(xs[k]);x<=Math.round(xs[k+1]);x++)put(g,x,y,c);}}
function mirPts(p){return p.map(function(pt){return [31-pt[0],pt[1]];});}
function eyes(g,x1,x2,y,s){s=s||2;rc(g,x1,y,s,s,'#f8f8f4');rc(g,x2,y,s,s,'#f8f8f4');
 put(g,x1+s-1,y+s-1,'#181225');put(g,x2,y+s-1,'#181225');}
function rngF(seed){var a=seed>>>0;
 return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function rgb(h){var n=parseInt(h.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function hex(r,g,b){function f(v){v=Math.max(0,Math.min(255,Math.round(v)));var s=v.toString(16);return s.length<2?'0'+s:s;}return '#'+f(r)+f(g)+f(b);}
function tint(h,f){var c=rgb(h),t=f<0?0:255,a=Math.abs(f);
 return hex(c[0]+(t-c[0])*a,c[1]+(t-c[1])*a,c[2]+(t-c[2])*a);}
function mix(a,b,t){var A=rgb(a),B=rgb(b);
 return hex(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);}
function mkPal(c){var b=c[0],acc=c[1],sec=c[2]||tint(b,-0.14);
 return {b:b,h:tint(b,.3),s:tint(b,-.26),acc:acc,sec:sec,
  hs:tint(sec,.25),ss:tint(sec,-.26),m:tint(b,-.55),out:mix('#0d0a16',b,.16)};}
function lightShade(g,p){var s=g.map(function(r){return r.slice();}),y,x;
 for(y=0;y<H;y++)for(x=0;x<W;x++){var c=g[y][x];if(c!==p.b&&c!==p.sec)continue;
  if(y>0&&!s[y-1][x])g[y][x]=(c===p.b)?p.h:p.hs;
  else if(y<H-1&&!s[y+1][x])g[y][x]=(c===p.b)?p.s:p.ss;}}
function outline(g,col){var s=g.map(function(r){return r.slice();}),y,x;
 for(y=0;y<H;y++)for(x=0;x<W;x++){if(s[y][x])continue;
  for(var dy=-1;dy<=1;dy++){var hit=false;
   for(var dx=-1;dx<=1;dx++){var ny=y+dy,nx=x+dx;
    if(ny>=0&&ny<H&&nx>=0&&nx<W&&s[ny][nx]){hit=true;break;}}
   if(hit){g[y][x]=col;break;}}}}

/* ===== 종 드로잉 함수 ===== */
var SP={
slime:function(g,p){el(g,16,18,11,9,p.b);rc(g,6,22,20,5,p.b);el(g,16,25,9,2,p.s);
 el(g,12,13,3,2,p.h);eyes(g,10,19,17);hl(g,14,17,22,p.m);put(g,16,21,p.m);},
shroom:function(g,p){el(g,16,11,11,8,p.b);rc(g,5,12,22,3,p.s);
 rc(g,12,14,8,9,'#f2e3c9');vl(g,12,14,22,tint('#f2e3c9',-.2));vl(g,19,14,22,tint('#f2e3c9',-.2));
 el(g,9,8,1.4,1.4,p.acc);el(g,16,5,1.4,1.4,p.acc);el(g,22,9,1.4,1.4,p.acc);
 eyes(g,13,17,17);hl(g,14,16,20,p.m);},
rodent:function(g,p){var bel=p.c||tint(p.b,.35);
 el(g,9,9,2.6,2.6,p.b);el(g,23,9,2.6,2.6,p.b);el(g,9,9,1.3,1.3,p.acc);el(g,23,9,1.3,1.3,p.acc);
 el(g,16,18,9,8,p.b);el(g,16,21,6,5,bel);ln(g,24,22,30,27,p.b,2);
 eyes(g,11,19,16);put(g,16,19,p.acc);rc(g,15,22,1,2,'#fff');rc(g,17,22,1,2,'#fff');
 put(g,7,20,p.m);put(g,7,22,p.m);put(g,25,20,p.m);put(g,25,22,p.m);},
bat:function(g,p,o,f){f=f||0;
 var A=[[10,11],[1,6],[0,13],[4,13],[2,19],[7,18],[10,22]];
 var B=[[10,11],[2,4],[0,11],[4,11],[3,16],[8,17],[10,22]];
 var L=(f%2===0)?A:B;
 poly(g,L,p.sec);poly(g,mirPts(L),p.sec);
 poly(g,[[11,7],[13,2],[15,8]],p.b);poly(g,[[20,7],[18,2],[16,8]],p.b);
 el(g,16,15,6,8,p.b);rc(g,13,14,2,2,p.acc);rc(g,17,14,2,2,p.acc);
 rc(g,14,19,1,2,'#fff');rc(g,17,19,1,2,'#fff');put(g,13,24,p.s);put(g,18,24,p.s);},
imp:function(g,p,o,f){f=f||0;o=o||{};
 if(o.wings){var Lw=(f%2===0)?[[9,16],[1,7],[3,17],[8,16]]:[[9,16],[2,4],[3,15],[8,15]];
  poly(g,Lw,p.sec);poly(g,mirPts(Lw),p.sec);}
 poly(g,[[8,9],[3,5],[5,13]],p.b);poly(g,[[23,9],[28,5],[26,13]],p.b);
 el(g,16,11,9,8,p.b);el(g,16,23,6,6,p.b);
 rc(g,8,21,3,4,p.b);rc(g,21,21,3,4,p.b);rc(g,12,28,3,3,p.b);rc(g,17,28,3,3,p.b);
 rc(g,12,25,8,3,p.acc);hl(g,11,13,7,p.m);hl(g,18,20,7,p.m);
 eyes(g,12,18,10);hl(g,13,18,15,p.m);put(g,14,16,'#fff');put(g,17,16,'#fff');
 if(o.horns){poly(g,[[9,5],[11,0],[13,5]],'#efe6d0');poly(g,[[22,5],[20,0],[18,5]],'#efe6d0');}
 if(o.thirdeye){put(g,16,5,p.acc);put(g,16,6,tint(p.acc,-.3));}},
bug:function(g,p,o){o=o||{};
 if(o.larva){el(g,16,20,8,9,p.b);el(g,16,10,5,5,p.b);
  for(var y=15;y<=26;y+=3)hl(g,9,22,y,p.s);
  ln(g,13,6,11,2,p.m);ln(g,18,6,20,2,p.m);eyes(g,13,17,9);hl(g,14,17,12,p.m);}
 else{el(g,16,18,9,10,p.b);el(g,16,8,5,4,p.b);vl(g,15,10,26,p.s);vl(g,16,10,26,p.s);
  put(g,12,14,p.acc);put(g,20,16,p.acc);put(g,13,21,p.acc);put(g,19,22,p.acc);
  ln(g,9,14,4,11,p.m);ln(g,8,18,3,18,p.m);ln(g,9,22,4,26,p.m);
  ln(g,22,14,27,11,p.m);ln(g,23,18,28,18,p.m);ln(g,22,22,27,26,p.m);
  ln(g,13,5,11,1,p.m);ln(g,18,5,20,1,p.m);eyes(g,13,17,7,1);put(g,11,9,p.acc);put(g,20,9,p.acc);}},
treant:function(g,p){el(g,16,8,12,7,p.sec);el(g,8,10,4,3,p.sec);el(g,24,10,4,3,p.sec);
 poly(g,[[11,12],[21,12],[23,29],[9,29]],p.b);
 poly(g,[[9,28],[4,31],[11,31]],p.b);poly(g,[[22,28],[27,31],[20,31]],p.b);
 rc(g,4,15,8,3,p.b);rc(g,20,15,8,3,p.b);ln(g,4,16,1,12,p.b);ln(g,27,16,30,12,p.b);
 el(g,3,13,2,2,p.sec);el(g,29,13,2,2,p.sec);el(g,13,13,2,1,p.acc);
 rc(g,12,16,3,3,'#1a1424');rc(g,17,16,3,3,'#1a1424');put(g,13,17,'#ffd24f');put(g,18,17,'#ffd24f');
 put(g,12,22,'#241a10');put(g,13,21,'#241a10');put(g,14,22,'#241a10');
 put(g,15,21,'#241a10');put(g,16,22,'#241a10');put(g,17,21,'#241a10');put(g,18,22,'#241a10');
 vl(g,13,18,21,p.s);vl(g,19,18,24,p.s);},
skel:function(g,p){el(g,16,8,7,7,p.b);rc(g,12,13,8,4,p.b);
 rc(g,11,7,4,4,'#141021');rc(g,17,7,4,4,'#141021');put(g,12,9,p.acc);put(g,19,9,p.acc);
 put(g,16,12,'#141021');vl(g,14,14,16,p.s);vl(g,16,14,16,p.s);vl(g,18,14,16,p.s);
 rc(g,15,17,2,2,p.b);vl(g,16,19,26,p.b);hl(g,11,20,20,p.b);hl(g,11,20,22,p.b);hl(g,12,19,24,p.b);
 put(g,9,19,p.b);put(g,22,19,p.b);ln(g,9,20,7,26,p.b);ln(g,22,20,24,26,p.b);
 rc(g,6,26,2,2,p.b);rc(g,24,26,2,2,p.b);rc(g,12,27,8,3,p.b);rc(g,12,30,3,2,p.b);rc(g,17,30,3,2,p.b);},
zomb:function(g,p,o){o=o||{};
 if(o.band){rc(g,10,4,12,2,p.acc);put(g,9,6,p.acc);put(g,22,6,p.acc);}
 else{rc(g,9,3,14,3,p.acc);put(g,8,5,p.acc);put(g,23,5,p.acc);}
 el(g,16,9,7,6,p.b);rc(g,11,8,2,2,'#f8f8f4');put(g,12,9,'#181225');put(g,20,9,'#181225');
 rc(g,13,13,6,2,'#2a1f2e');put(g,14,13,'#fff');put(g,19,5,p.m);put(g,20,6,p.m);
 rc(g,10,16,12,10,p.sec);put(g,13,20,null);put(g,18,22,null);put(g,15,24,p.ss);
 rc(g,4,17,7,3,p.sec);el(g,3,18,2,2,p.b);rc(g,22,18,3,6,p.sec);rc(g,22,24,3,2,p.b);
 rc(g,11,26,10,3,'#3a3a4a');rc(g,12,29,3,2,'#3a3a4a');rc(g,17,29,3,2,'#3a3a4a');
 if(o.band){hl(g,12,19,19,p.acc);hl(g,12,19,23,p.acc);}},
ghost:function(g,p,o,f){f=f||0;o=o||{};var x;
 el(g,16,12,9,9,p.b);
 for(x=8;x<=23;x++){var l=((x+f)%4<2)?5:3;
  for(var j=0;j<l;j++)put(g,x,20+j,p.b);}
 el(g,16,16,6,3,p.s);el(g,7,15,2,3,p.b);el(g,25,15,2,3,p.b);
 rc(g,11,11,3,4,'#232c44');rc(g,18,11,3,4,'#232c44');el(g,16,18,2,2,'#232c44');
 if(o.tent){vl(g,10,25,26+(f%3),p.ss);vl(g,14,25,27-(f%2),p.ss);
  vl(g,18,25,26+((f+1)%3),p.ss);vl(g,22,25,27-((f+1)%2),p.ss);}},
knight:function(g,p,o){o=o||{};
 rc(g,15,1,2,4,p.acc);put(g,14,2,p.acc);put(g,17,3,p.acc);
 el(g,16,5,7,3,p.b);rc(g,9,4,14,10,p.b);
 rc(g,11,9,10,3,'#141021');rc(g,12,10,2,1,p.acc);rc(g,18,10,2,1,p.acc);
 rc(g,12,14,8,2,p.s);el(g,7,16,4,3,p.b);el(g,25,16,4,3,p.b);
 rc(g,10,15,12,10,p.b);poly(g,[[16,17],[19,20],[16,23],[13,20]],p.acc);rc(g,10,24,12,2,p.s);
 poly(g,[[10,26],[22,26],[24,30],[8,30]],p.b);
 rc(g,6,18,4,7,p.b);rc(g,6,25,4,3,p.s);rc(g,22,18,4,7,p.b);rc(g,22,25,4,3,p.s);
 rc(g,11,30,4,2,p.s);rc(g,17,30,4,2,p.s);
 if(o.weapon){rc(g,27,7,2,14,'#ccd6e2');rc(g,25,21,6,2,p.acc);rc(g,27,23,2,4,'#5a4632');put(g,27,6,'#eef4fa');}},
spider:function(g,p){ln(g,9,12,2,7,p.m);ln(g,8,16,1,15,p.m);ln(g,9,20,2,24,p.m);
 ln(g,22,12,29,7,p.m);ln(g,23,16,30,15,p.m);ln(g,22,20,29,24,p.m);
 el(g,16,20,8,7,p.b);poly(g,[[16,16],[19,20],[16,24],[13,20]],p.acc);el(g,16,11,5,4,p.b);
 rc(g,13,10,2,2,p.acc);rc(g,17,10,2,2,p.acc);
 put(g,12,12,p.acc);put(g,19,12,p.acc);put(g,15,9,p.acc);put(g,16,9,p.acc);
 rc(g,13,14,1,2,'#fff');rc(g,18,14,1,2,'#fff');},
golem:function(g,p,o){o=o||{};
 rc(g,11,4,10,7,p.b);hl(g,12,19,4,p.h);rc(g,13,7,2,2,p.acc);rc(g,17,7,2,2,p.acc);
 rc(g,8,11,16,12,p.b);rc(g,14,16,4,4,p.acc);
 put(g,13,15,p.h);put(g,18,15,p.h);put(g,13,20,p.s);put(g,18,20,p.s);
 rc(g,5,11,4,5,p.s);rc(g,23,11,4,5,p.s);rc(g,5,16,3,8,p.b);rc(g,24,16,3,8,p.b);
 rc(g,4,24,5,4,p.b);rc(g,23,24,5,4,p.b);hl(g,4,8,26,p.s);hl(g,23,27,26,p.s);
 rc(g,10,23,5,8,p.b);rc(g,17,23,5,8,p.b);hl(g,10,14,30,p.s);hl(g,17,21,30,p.s);
 put(g,10,13,p.s);put(g,20,14,p.s);put(g,12,19,p.s);put(g,19,22,p.s);put(g,11,27,p.s);put(g,20,27,p.s);
 if(o.drill){poly(g,[[4,25],[1,31],[8,31]],'#b8c4d0');poly(g,[[27,25],[24,31],[31,31]],'#b8c4d0');}
 if(o.runes){put(g,10,15,p.acc);put(g,21,15,p.acc);put(g,10,20,p.acc);put(g,21,20,p.acc);}},
wolf:function(g,p,o){o=o||{};var bel=p.c||tint(p.b,.35);
 poly(g,[[25,13],[31,7],[30,14],[26,17]],p.b);
 el(g,17,16,9,6,p.b);el(g,10,17,3,4,bel);
 el(g,8,11,5,5,p.b);rc(g,2,11,5,3,bel);put(g,2,12,'#181225');
 poly(g,[[6,5],[9,4],[9,9]],p.b);put(g,8,6,p.acc);
 rc(g,7,10,2,2,p.acc);
 rc(g,11,21,3,7,p.b);rc(g,15,22,3,6,p.b);rc(g,20,22,3,6,p.b);rc(g,24,21,3,7,p.b);
 hl(g,11,13,27,p.s);hl(g,15,17,27,p.s);hl(g,20,22,27,p.s);hl(g,24,26,27,p.s);
 if(o.flames){put(g,14,10,p.acc);put(g,17,9,p.acc);put(g,21,10,p.acc);
  put(g,26,9,p.acc);put(g,28,7,p.acc);put(g,12,12,p.acc);put(g,30,10,p.acc);}},
brute:function(g,p,o){o=o||{};var bel=p.c||tint(p.b,.3);
 el(g,16,20,11,9,p.b);el(g,16,10,8,7,p.b);el(g,16,11,5,4,bel);
 rc(g,12,9,2,2,'#181225');rc(g,18,9,2,2,'#181225');rc(g,12,13,8,2,'#2a1f2e');
 rc(g,12,13,1,2,'#fff');rc(g,19,13,1,2,'#fff');put(g,14,15,'#fff');put(g,17,15,'#fff');
 el(g,7,14,3,3,p.b);el(g,25,14,3,3,p.b);
 rc(g,3,16,4,11,p.b);rc(g,25,16,4,11,p.b);el(g,5,28,3,3,p.b);el(g,27,28,3,3,p.b);
 rc(g,11,28,4,3,p.b);rc(g,17,28,4,3,p.b);
 if(o.horns){poly(g,[[9,4],[11,-1],[13,4]],'#e8ecf4');poly(g,[[22,4],[20,-1],[18,4]],'#e8ecf4');}},
bird:function(g,p,o){o=o||{};
 if(o.penguin){el(g,16,18,7,10,p.b);el(g,16,20,5,8,'#f5f5ee');el(g,16,8,6,5,p.b);
  poly(g,[[10,8],[5,10],[10,11]],p.acc);eyes(g,13,17,7);
  poly(g,[[9,15],[5,22],[11,20]],p.sec);poly(g,[[22,15],[26,22],[20,20]],p.sec);
  rc(g,12,28,5,2,p.acc);rc(g,17,28,5,2,p.acc);return;}
 poly(g,[[23,14],[30,10],[30,18],[24,17]],p.sec);
 el(g,16,15,8,6,p.b);el(g,12,17,4,4,p.c||tint(p.b,.35));
 el(g,9,9,4,4,p.b);poly(g,[[6,8],[1,10],[6,11]],p.acc);
 rc(g,8,8,2,2,'#f8f8f4');put(g,9,9,'#181225');
 el(g,17,15,5,3,p.sec);hl(g,14,20,15,p.ss);
 vl(g,14,21,25,p.m);vl(g,17,21,25,p.m);hl(g,12,16,25,p.m);hl(g,15,19,25,p.m);},
lizard:function(g,p,o){o=o||{};
 rc(g,13,3,6,2,p.acc);put(g,11,5,p.acc);put(g,20,5,p.acc);
 rc(g,10,6,12,6,p.b);rc(g,12,10,8,3,p.b);put(g,13,11,p.m);put(g,18,11,p.m);
 hl(g,11,20,12,p.s);rc(g,11,7,2,2,p.acc);rc(g,19,7,2,2,p.acc);
 rc(g,11,13,10,10,p.b);rc(g,13,14,6,9,p.c||tint(p.b,.35));
 hl(g,13,18,17,p.s);hl(g,13,18,20,p.s);
 ln(g,21,24,28,29,p.b,2);rc(g,7,15,4,3,p.b);rc(g,21,15,4,3,p.b);put(g,6,16,p.acc);put(g,25,16,p.acc);
 rc(g,10,23,5,4,p.b);rc(g,9,27,4,4,p.b);hl(g,7,12,30,p.b);put(g,7,31,p.acc);put(g,12,31,p.acc);
 rc(g,17,23,5,4,p.b);rc(g,19,27,4,4,p.b);hl(g,19,24,30,p.b);put(g,19,31,p.acc);put(g,24,31,p.acc);
 if(o.spear){vl(g,26,8,29,'#8a6a42');poly(g,[[26,3],[24,8],[28,8]],'#ccd6e2');}},
serpent:function(g,p,o){o=o||{};
 if(o.hood!==false)el(g,16,11,11,6,p.sec);
 el(g,16,7,7,6,p.b);rc(g,12,6,2,2,p.acc);rc(g,18,6,2,2,p.acc);
 rc(g,13,11,1,2,'#fff');rc(g,18,11,1,2,'#fff');
 vl(g,16,13,15,'#ff5a7a');put(g,15,16,'#ff5a7a');put(g,17,16,'#ff5a7a');
 el(g,16,20,10,4,p.b);el(g,16,25,11,4,p.b);hl(g,7,25,22,p.m);
 poly(g,[[26,23],[31,19],[30,26]],p.b);
 put(g,10,19,p.c||tint(p.b,.35));put(g,16,22,p.c||tint(p.b,.35));put(g,22,19,p.c||tint(p.b,.35));
 put(g,12,26,p.c||tint(p.b,.35));put(g,20,26,p.c||tint(p.b,.35));
 if(o.heads){el(g,6,12,4,4,p.b);el(g,26,12,4,4,p.b);
  ln(g,8,15,10,17,p.b,2);ln(g,24,15,22,17,p.b,2);
  rc(g,4,11,1,2,p.acc);rc(g,7,11,1,2,p.acc);rc(g,24,11,1,2,p.acc);rc(g,27,11,1,2,p.acc);}
 if(o.electric){poly(g,[[8,17],[11,17],[9,21],[12,21]],p.acc);
  poly(g,[[21,24],[24,24],[22,28],[25,28]],p.acc);put(g,4,14,p.acc);put(g,28,15,p.acc);}},
eye:function(g,p){rc(g,11,25,2,4,p.sec);rc(g,15,26,2,4,p.sec);rc(g,19,25,2,4,p.sec);
 el(g,16,14,10,10,p.b);el(g,16,15,5,5,p.acc);el(g,16,15,2,2,'#141021');put(g,13,11,'#fff');
 put(g,8,10,'#d95f6e');put(g,9,8,'#d95f6e');put(g,24,9,'#d95f6e');put(g,23,12,'#d95f6e');
 rc(g,8,3,16,3,p.sec);hl(g,8,23,6,p.ss);},
flame:function(g,p,o,f){f=f||0;var i,r=rngF(f*7919+13);
 poly(g,[[16,2],[20,6],[22,4],[24,9],[27,12],[25,16],[27,20],[22,26],[16,28],[10,26],[5,20],[7,16],[5,11],[8,8],[10,10],[12,5],[14,7]],p.b);
 poly(g,[[16,8],[19,11],[21,10],[22,14],[20,18],[16,20],[12,18],[10,14],[12,10],[14,11]],p.acc);
 el(g,16+[0,1,0,-1][f],15,3,4,'#fff7d0');
 for(i=0;i<5;i++)put(g,3+Math.floor(r()*26),2+Math.floor(r()*10),(r()<.5?p.acc:'#fff7d0'));},
fish:function(g,p,o){o=o||{};
 poly(g,[[24,14],[31,9],[31,21],[25,18]],p.sec);
 el(g,16,15,9,6,p.b);poly(g,[[13,9],[20,9],[16,4]],p.sec);el(g,14,18,3,2,p.sec);
 rc(g,9,12,3,3,'#f8f8f4');rc(g,10,13,2,2,'#181225');hl(g,5,8,16,p.m);
 put(g,13,13,p.s);put(g,16,14,p.s);put(g,19,13,p.s);put(g,14,17,p.s);put(g,17,18,p.s);
 if(o.angler){ln(g,11,9,9,5,p.m);el(g,8,4,2,2,p.acc);put(g,7,3,'#fff');
  rc(g,6,15,1,2,'#fff');rc(g,8,16,1,2,'#fff');rc(g,10,15,1,2,'#fff');}},
crab:function(g,p){var bel=p.c||tint(p.b,.3);
 el(g,16,13,11,7,p.b);put(g,12,8,p.h);put(g,16,7,p.h);put(g,20,8,p.h);
 vl(g,12,5,8,p.m);vl(g,19,5,8,p.m);rc(g,11,3,2,2,p.acc);rc(g,19,3,2,2,p.acc);
 rc(g,5,16,4,2,p.b);rc(g,23,16,4,2,p.b);el(g,4,14,3,3,p.b);el(g,28,14,3,3,p.b);
 ln(g,7,19,3,24,p.m);ln(g,9,20,6,26,p.m);ln(g,11,20,9,27,p.m);
 ln(g,24,19,28,24,p.m);ln(g,22,20,25,26,p.m);ln(g,20,20,22,27,p.m);
 el(g,16,19,7,3,bel);},
kraken:function(g,p){var bel=p.c||tint(p.b,.35);
 el(g,16,10,9,8,p.b);el(g,16,4,5,3,p.b);
 rc(g,11,10,3,2,p.acc);rc(g,18,10,3,2,p.acc);hl(g,10,13,9,p.s);hl(g,18,21,9,p.s);
 el(g,16,16,2,2,'#2a1f2e');
 var T=[[[9,16],[8,19],[7,22],[6,25],[4,26]],[[13,17],[12,21],[12,25],[11,28]],[[16,18],[16,23],[15,27]],
        [[22,16],[23,19],[24,22],[25,25],[27,26]],[[18,17],[19,21],[19,25],[20,28]]];
 T.forEach(function(pts){pts.forEach(function(q){put(g,q[0],q[1],p.b);put(g,q[0]+1,q[1],p.b);});});
 put(g,7,20,bel);put(g,6,23,bel);put(g,12,23,bel);put(g,19,23,bel);put(g,24,20,bel);},
robed:function(g,p,o){o=o||{};
 if(o.vampire){poly(g,[[8,8],[12,15],[8,17]],p.sec);poly(g,[[23,8],[19,15],[23,17]],p.sec);
  rc(g,10,3,12,3,p.b);put(g,15,6,p.b);put(g,16,6,p.b);
  el(g,16,9,6,5,p.c||tint(p.b,.4));rc(g,13,8,2,2,p.acc);rc(g,17,8,2,2,p.acc);
  rc(g,13,12,1,2,'#fff');rc(g,18,12,1,2,'#fff');hl(g,13,18,11,p.m);}
 else{poly(g,[[16,1],[23,8],[25,14],[7,14],[9,8]],p.b);put(g,17,0,p.b);
  el(g,16,10,5,4,'#141021');rc(g,13,9,2,2,p.acc);rc(g,17,9,2,2,p.acc);}
 poly(g,[[11,13],[21,13],[26,30],[6,30]],p.b);hl(g,11,21,17,p.s);
 for(var x=7;x<=25;x+=3)put(g,x,30,p.s);
 if(o.vampire){put(g,16,16,p.acc);put(g,16,17,p.acc);}
 else{rc(g,13,18,6,3,p.s);
  var fc=(o.undead)?'#e8e3d0':(p.c||tint(p.b,.35));
  rc(g,14,19,2,2,fc);rc(g,16,19,2,2,fc);put(g,16,15,p.acc);put(g,15,16,p.acc);}
 if(o.staff){vl(g,27,7,29,'#7a5a38');el(g,27,5,2,2,p.acc);put(g,26,4,'#fff');}},
dragon:function(g,p){poly(g,[[20,12],[27,2],[31,4],[29,9],[31,12],[27,14]],p.sec);
 hl(g,24,28,7,p.ss);hl(g,27,30,10,p.ss);
 ln(g,24,20,30,26,p.b,2);poly(g,[[29,25],[31,23],[31,28]],p.acc);
 el(g,17,18,8,6,p.b);el(g,15,20,5,4,p.c||tint(p.b,.35));
 hl(g,12,18,20,p.s);hl(g,12,18,22,p.s);
 poly(g,[[13,11],[15,11],[14,8]],p.acc);poly(g,[[17,9],[19,9],[18,6]],p.acc);poly(g,[[21,10],[23,10],[22,7]],p.acc);
 rc(g,11,12,3,3,p.b);rc(g,10,9,3,4,p.b);rc(g,4,6,9,5,p.b);rc(g,1,8,4,3,p.b);put(g,2,9,p.m);
 hl(g,3,9,11,p.s);put(g,4,11,'#fff');put(g,7,11,'#fff');
 rc(g,7,7,2,2,p.acc);put(g,6,6,p.s);poly(g,[[11,4],[13,1],[14,6]],p.c||'#e8dfc9');
 rc(g,12,23,3,5,p.b);put(g,12,28,p.acc);put(g,14,28,p.acc);
 el(g,22,22,3,4,p.b);hl(g,20,25,27,p.b);put(g,20,28,p.acc);put(g,25,28,p.acc);},
demon:function(g,p,o,f){f=f||0;o=o||{};var claw=p.c||'#e8dfc9';
 if(o.bwings){var Lb=(f%2===0)?[[10,14],[0,4],[2,16],[6,14],[3,24],[9,20]]
                             :[[10,14],[1,2],[2,14],[6,13],[4,22],[9,19]];
  poly(g,Lb,p.sec);poly(g,mirPts(Lb),p.sec);
  ln(g,4,7,7,14,p.ss);ln(g,26,7,24,14,p.ss);}
 ln(g,9,6,5,1,claw,2);ln(g,22,6,26,1,claw,2);
 el(g,16,8,8,7,p.b);hl(g,10,21,5,p.s);
 rc(g,11,8,3,2,p.acc);rc(g,18,8,3,2,p.acc);
 hl(g,11,20,13,'#2a1016');rc(g,12,12,1,2,'#fff');rc(g,19,12,1,2,'#fff');
 poly(g,[[10,15],[22,15],[25,27],[7,27]],p.b);hl(g,12,19,18,p.s);
 vl(g,16,19,25,p.s);hl(g,12,19,21,p.s);
 rc(g,4,17,4,9,p.b);rc(g,24,17,4,9,p.b);
 put(g,5,26,claw);put(g,4,27,claw);put(g,6,27,claw);
 put(g,26,26,claw);put(g,25,27,claw);put(g,27,27,claw);
 rc(g,11,27,4,4,p.b);rc(g,17,27,4,4,p.b);
 rc(g,11,30,4,2,tint(p.b,-.45));rc(g,17,30,2,tint(p.b,-.45));
 ln(g,24,26,30,30,p.b);poly(g,[[29,29],[31,27],[31,31]],claw);},

/* ── 인간형 직업 캐릭터 베이스 ── */
hero:function(g,p,o,f){f=f||0;o=o||{};
 var skin=o.skin||'#f0c8a0',hairC=o.hairC||'#5f4632';
 var pants=o.pants||tint(p.b,-0.35),boot=tint(p.b,-0.5);
 if(o.antlers){var ac='#7a5a38';
  ln(g,11,5,8,2,ac);ln(g,10,4,7,4,ac);
  ln(g,20,5,23,2,ac);ln(g,21,4,24,4,ac);}
 if(o.halo){hl(g,12,20,2,'#ffe680');put(g,11,3,'#ffe680');put(g,21,3,'#ffe680');}
 if(o.cape){poly(g,[[12,13],[20,13],[24,27+(f%2)],[8,27+((f+1)%2)]],p.sec);}
 if(o.robe){poly(g,[[11,15],[21,15],[24,30],[8,30]],p.b);hl(g,9,23,30,p.s);
  rc(g,12,30,3,1,boot);rc(g,17,30,3,1,boot);}
 else{rc(g,11,22,10,2,pants);
  rc(g,12,24,3,5,pants);rc(g,17,24,3,5,pants);
  rc(g,11,29,4,2,boot);rc(g,17,29,4,2,boot);}
 var wide=o.big?2:0,armC=o.bare?skin:p.b,torsoC=o.bare?skin:p.b;
 if(o.bare){rc(g,11,15,10,7,skin);ln(g,12,15,20,21,p.acc);}
 else{rc(g,11-wide,15,10+wide*2,7,torsoC);}
 if(o.shoulder){rc(g,9-wide,14,4,3,p.s);rc(g,19+wide,14,4,3,p.s);}
 hl(g,11-wide,21+wide,21,tint(torsoC,-0.45));
 if(!o.bare)put(g,16,21,p.acc);
 if(o.emblem)put(g,16,18,p.acc);
 rc(g,8-wide,16,3,5,armC);rc(g,21+wide,16,3,5,armC);
 el(g,9-wide,22,1.4,1.4,skin);el(g,22+wide,22,1.4,1.4,skin);
 if(o.weapon==='fist'){rc(g,8-wide,20,3,3,p.acc);rc(g,21+wide,20,3,3,p.acc);
  if(f%2){put(g,6,18,'#fff');put(g,25,18,'#fff');}}
 el(g,16,9,5,4.5,skin);
 if(o.helm==='full'){rc(g,10,4,12,7,p.b);poly(g,[[16,1],[18,5],[14,5]],p.acc);
  rc(g,11,8,10,2,'#141021');put(g,13,9,p.acc);put(g,19,9,p.acc);}
 else{
  if(o.helm==='half'){hl(g,11,21,6,p.acc);vl(g,16,6,9,tint(p.b,-0.2));}
  var hs=o.hairstyle;
  if(hs==='spiky'){poly(g,[[10,9],[11,4],[13,7],[15,3],[17,7],[19,4],[21,7],[22,9]],hairC);}
  else if(hs==='long'){el(g,16,7,5.6,3.4,hairC);rc(g,10,8,2,9,hairC);rc(g,20,8,2,9,hairC);}
  else if(hs==='bob'||hs==='short'){el(g,16,7.5,6,3.6,hairC);
   rc(g,10,7,2,hs==='bob'?6:3,hairC);rc(g,20,7,2,hs==='bob'?6:3,hairC);}
  else if(hs==='ponytail'){el(g,16,7.5,5.6,3.4,hairC);el(g,23,6,1.6,1.6,hairC);
   ln(g,23,7,27,11,hairC);put(g,22,7,p.acc);}
  else if(hs==='topknot'){el(g,16,7.5,5.6,3.4,hairC);el(g,16,3,1.6,1.6,hairC);put(g,16,5,p.acc);}
  else if(hs==='bald'){put(g,13,6,tint(skin,0.35));}
  if(o.hat==='wizard'){poly(g,[[16,0],[23,8],[9,8]],p.acc);
   hl(g,7,25,8,p.acc);hl(g,7,25,9,tint(p.acc,-0.25));put(g,17,5,'#fff');}
  else if(o.hat==='hood'){poly(g,[[16,1],[24,13],[8,13]],p.sec);
   rc(g,11,6,10,7,'#141021');put(g,14,9,p.acc);put(g,18,9,p.acc);}
  else if(o.hat==='bandana'){rc(g,10,5,12,3,p.acc);put(g,9,6,p.acc);
   ln(g,9,7,5,11,p.acc);ln(g,9,7,6,12,tint(p.acc,-0.2));
   if(o.pirate){put(g,13,6,'#fff');put(g,18,6,'#fff');}}
  else if(o.hat==='beret'){el(g,16,5,6,2.5,p.acc);put(g,16,2,tint(p.acc,-0.3));
   if(o.feather)poly(g,[[21,4],[27,1],[22,6]],'#e05aa0');}
  if(o.hat!=='hood'){
   if(o.mask){rc(g,11,10,10,4,p.sec);}
   else put(g,16,11,tint(skin,-0.3));
   put(g,14,9,'#181225');put(g,18,9,'#181225');
   if(o.eyepatch){hl(g,10,21,8,'#141021');rc(g,12,8,4,3,'#141021');}
   if(o.gog){rc(g,11,7,10,2,'#3a3a44');rc(g,12,7,3,2,p.acc);rc(g,17,7,3,2,p.acc);}
   if(o.headband){rc(g,10,6,12,2,'#d94f4f');put(g,9,7,'#d94f4f');ln(g,9,8,4,12,'#d94f4f');}
   if(o.circlet){hl(g,11,20,6,p.acc);put(g,16,6,'#ff6a8a');}
  }}
 if(o.offhand==='shield'){rc(g,4,15,5,9,p.b);
  hl(g,4,8,15,p.s);hl(g,4,8,23,p.s);vl(g,4,15,23,p.s);put(g,6,19,p.acc);}
 if(o.orb){el(g,5,19-(f%2),2,2,p.acc);put(g,3,19,p.acc);put(g,7,18,p.acc);}
 var wd='#dfe8f2',wood='#8a6a42',dk='#5f4632';
 switch(o.weapon){
 case'sword':rc(g,25,7,2,11,wd);put(g,25,6,'#fff');hl(g,24,28,18,p.acc);rc(g,25,19,2,3,dk);break;
 case'greatsword':rc(g,25,3,3,15,'#cfd8e2');vl(g,26,4,16,'#eef4fa');
  hl(g,23,30,18,p.acc);rc(g,26,19,2,4,dk);put(g,27,23,p.acc);break;
 case'axe':vl(g,26,6,24,wood);poly(g,[[26,5],[31,7],[31,14],[26,12]],'#cfd8e2');vl(g,30,7,13,'#eef4fa');break;
 case'lance':vl(g,27,6,27,wood);poly(g,[[25,6],[27,1],[29,6]],wd);poly(g,[[27,7],[31,9],[27,11]],p.acc);break;
 case'bow':poly(g,[[25,6],[27,10],[27,18],[25,22],[24,20],[26,14],[24,8]],wood);
  vl(g,25,8,20,'#e8e0c8');ln(g,17,14,25,14,wood);put(g,26,14,wd);
  put(g,17,13,'#fff');put(g,17,15,'#fff');break;
 case'crossbow':rc(g,20,13,8,2,wood);hl(g,19,30,10,'#8a5a2a');hl(g,19,30,18,'#8a5a2a');
  vl(g,29,11,17,'#e8e0c8');ln(g,18,14,28,14,'#6e4a2f');break;
 case'dagger':rc(g,25,15,2,5,wd);hl(g,24,28,20,p.acc);rc(g,25,21,2,2,'#3a2f2f');
  rc(g,5,15,2,5,wd);hl(g,4,8,20,p.acc);rc(g,5,21,2,2,'#3a2f2f');break;
 case'katana':ln(g,23,19,29,6,'#e8f0f8');put(g,28,7,'#fff');put(g,22,20,p.acc);ln(g,21,22,22,20,'#2f2a3f');break;
 case'staff':vl(g,27,7,27,'#7a5a38');el(g,27,5,2,2,p.acc);put(g,(f%2)?25:29,3,'#fff');break;
 case'skullstaff':vl(g,26,8,27,'#4f4038');el(g,27,5,2.5,2.5,'#e8e3d0');
  put(g,26,5,'#141021');put(g,28,5,'#141021');put(g,25,3,'#e8e3d0');put(g,29,3,'#e8e3d0');break;
 case'mace':vl(g,27,11,24,'#6e4a2f');el(g,27,8,2.5,2.5,'#b8c4d0');
  put(g,25,7,wd);put(g,29,7,wd);put(g,27,5,wd);break;
 case'lute':el(g,24,19,3.2,4,'#8a5a2a');put(g,24,19,'#3a2412');
  ln(g,23,15,26,10,'#5f3f1f');rc(g,25,9,2,2,'#5f3f1f');vl(g,24,15,17,'#e8e0c8');break;
 case'flask':rc(g,24,7,2,2,'#cfd8e2');put(g,24,6,'#8a5a2a');
  el(g,25,11,2.5,3,'#7fe0d0');if(f%2)put(g,24,10,'#fff');break;
 case'hourglass':hl(g,24,29,5,'#8a6a42');hl(g,24,29,12,'#8a6a42');
  vl(g,24,5,12,'#8a6a42');vl(g,29,5,12,'#8a6a42');
  poly(g,[[25,6],[28,6],[26,9]],'#ffd24f');poly(g,[[25,11],[28,11],[27,8]],'#ffd24f');
  put(g,26,9+(f%3),'#ffd24f');break;
 case'book':rc(g,23,15,5,6,'#5f2f3f');rc(g,24,16,3,4,'#e8e0c8');put(g,25,18,p.acc);break;}
 if(o.aura==='holy'){var hq=[[9,4],[23,5],[8,12],[24,11],[16,1]];
  put(g,hq[f][0],hq[f][1],'#ffe680');put(g,hq[(f+2)%5][0],hq[(f+2)%5][1],'#fff6c0');}
 if(o.aura==='dark'){var dq=[[7,18],[25,16],[10,24],[22,25],[5,8]];
  put(g,dq[f][0],dq[f][1],'#9a4fd9');put(g,dq[(f+3)%5][0],dq[(f+3)%5][1],'#6a3fa9');}
}
};

/* ===== 애니메이션 빌드 ===== */
var FLY={ghost:1,flame:1,eye:1,fish:1,bat:1,kraken:1};
function shift(g,dx,dy){var out=mkG(),y,x;
 for(y=0;y<H;y++)for(x=0;x<W;x++)
  out[y][x]=(g[y-dy]&&g[y-dy][x-dx])||null;
 return out;}
function squish(g,k){if(!k)return g;
 var out=mkG(),sy=1+k,sx=1-k*0.6,y,x;
 for(y=0;y<H;y++)for(x=0;x<W;x++){
  var yy=H-1-Math.round((H-1-y)/sy);
  var xx=16+Math.round((x-16)/sx);
  out[y][x]=(g[yy]&&g[yy][xx])||null;}
 return out;}
function build(m,f){f=f||0;
 var g=mkG(),p=mkPal(m.c),o=m.o||{};
 if(m.sp==='robed'){SP.robed(g,p,Object.assign({undead:true},o),f);}
 else if(m.sp){SP[m.sp](g,p,o,f);}
 else{SP.hero(g,p,o,f);}   /* 직업 캐릭터(sp 없음)는 hero로 그림 */
 lightShade(g,p);
 if(FLY[m.sp]){g=shift(g,0,[0,-1,-1,0][f]);}
 else{g=squish(g,[0,0.07,0,-0.06][f]);}
 outline(g,p.out);return g;}

/* ===== 데이터: 던전 10 ===== */
var DG=[
{"no":1,"name":"잊혀진 숲길","rec":"Lv 1~6","hue":"#5fbf6a","desc":"모험의 시작. 이끼 낀 고대 숲의 비밀 통로."},
{"no":2,"name":"이끼 낀 묘지","rec":"Lv 6~11","hue":"#9aa5b8","desc":"안개 낀 묘지. 언데드가 밤마다 뒤집힌다."},
{"no":3,"name":"무너진 드워프 광산","rec":"Lv 11~16","hue":"#d9a04f","desc":"버려진 지하 광산. 고블린과 코볼트가 광맥을 사이두었다."},
{"no":4,"name":"영구동토 설산 동굴","rec":"Lv 16~21","hue":"#7fd0ea","desc":"빙하 동굴. 냉기의 포식자들이 잠들어 있다."},
{"no":5,"name":"왕도 하수구","rec":"Lv 21~26","hue":"#8fbf4f","desc":"왕국의 그림자. 독이 물밑을 지배한다."},
{"no":6,"name":"무너진 붉은 마탑","rec":"Lv 26~31","hue":"#e06a6a","desc":"폭주한 마법실험 탑. 주문이 살아 움직인다."},
{"no":7,"name":"용암이 끓는 화산 심장부","rec":"Lv 31~36","hue":"#ff7a3f","desc":"대지의 심장이 뛰는 곳. 화염의 생명체가 재로 운다."},
{"no":8,"name":"가라앉은 심해 신전","rec":"Lv 36~41","hue":"#4f8fd9","desc":"물막힌 고대 유적. 심해의 왕이 옥좌를 지킨다."},
{"no":9,"name":"저주받은 황무지","rec":"Lv 41~46","hue":"#a06ad9","desc":"전쟁의 상처가 썩은 땅. 죽음이 권력을 쥐고 있다."},
{"no":10,"name":"심연의 차원틈","rec":"Lv 46~52","hue":"#e055a0","desc":"세계의 가장자리가 찢어진 종착점."}
];

/* ===== 데이터: 몬스터 66종 (id: 1~100 예약) ===== */
var M=[
{"n":"새싹 슬라임","sp":"slime","c":["#58c94a","#d8f5a0"],"lv":1,"hp":14,"at":4,"df":2,"sd":4,"el":"무관","r":1,"d":1,"dep":"입구","t":"분열 — 쓰러질 때 50% 확률로 둘로 갈라져 재등장(1회)"},
{"n":"포자버섯","sp":"shroom","c":["#d9534f","#ffe9c9","#f2e3c9"],"lv":2,"hp":18,"at":5,"df":3,"sd":3,"el":"독","r":1,"d":1,"dep":"입구","t":"포자 분사 — 타격 시 30% 확률로 중독"},
{"n":"꼬마 청서","sp":"rodent","c":["#a97c50","#e89aa0"],"lv":2,"hp":16,"at":5,"df":2,"sd":6,"el":"무관","r":1,"d":1,"dep":"입구","t":"도약 물기 — 항상 선제 공격"},
{"n":"잎새박쥐","sp":"bat","c":["#7aa05a","#e8f0c8","#4c6e3a"],"lv":3,"hp":20,"at":6,"df":2,"sd":8,"el":"바람","r":1,"d":1,"dep":"입구","t":"흡혈 — 준 피해의 30% HP 회복"},
{"n":"고블린 스카웃","sp":"imp","c":["#6fae4e","#caa06a"],"lv":4,"hp":26,"at":8,"df":4,"sd":6,"el":"자연","r":1,"d":1,"dep":"중층","t":"투석 — 원거리 선제 타격 1회"},
{"n":"가시애벌레","sp":"bug","c":["#93c94f","#5a8a2e"],"lv":4,"hp":30,"at":6,"df":6,"sd":2,"el":"자연","r":1,"d":1,"dep":"중층","t":"가시껍질 — 근접 공격자에게 반사 피해 2","o":{"larva":1}},
{"n":"무당버섯","sp":"shroom","c":["#9b59b6","#f2dff5"],"lv":5,"hp":28,"at":9,"df":4,"sd":4,"el":"독","r":2,"d":1,"dep":"심층","t":"혼란 포자 — 25% 확률로 대상이 아군을 공격"},
{"n":"고목 수호자 엘더우드","sp":"treant","c":["#7a5a38","#8fce6a","#4f9f4f"],"lv":6,"hp":120,"at":14,"df":10,"sd":3,"el":"자연","r":3,"d":1,"dep":"BOSS","t":"뿌리 속박(행동 봉인 1턴) / 낙엽 폭풍(전체 12)","drop":"정령의 심목재"},
{"n":"해골 병사","sp":"skel","c":["#e8e3d0","#7fe0d0"],"lv":7,"hp":30,"at":11,"df":6,"sd":6,"el":"어둠","r":1,"d":2,"dep":"입구","t":"뼈 창 — 방어력 관통 3"},
{"n":"이끼 좀비","sp":"zomb","c":["#7a9a5a","#4c5e3a"],"lv":7,"hp":40,"at":10,"df":5,"sd":3,"el":"독","r":1,"d":2,"dep":"입구","t":"물어뜯기 — 중독 부여"},
{"n":"무덤 박쥐","sp":"bat","c":["#6b6b7a","#c9c9dc","#46465a"],"lv":8,"hp":28,"at":12,"df":3,"sd":9,"el":"어둠","r":1,"d":2,"dep":"중층","t":"급강하 — 회피율 20%"},
{"n":"신음유령","sp":"ghost","c":["#bcd7e8","#8fb8d9"],"lv":8,"hp":32,"at":12,"df":2,"sd":7,"el":"정신","r":2,"d":2,"dep":"중층","t":"원한 — 사망 시 처치자 저주(공격력 -20%)"},
{"n":"무덤 골렘 파편","sp":"golem","c":["#8d8d84","#5f5f57"],"lv":9,"hp":55,"at":13,"df":12,"sd":2,"el":"땅","r":2,"d":2,"dep":"심층","t":"묘비 낙하 — 선제 스턴 1턴"},
{"n":"굶주린 구울","sp":"zomb","c":["#b8a98a","#6e5f46"],"lv":9,"hp":48,"at":15,"df":6,"sd":5,"el":"어둠","r":2,"d":2,"dep":"심층","t":"포식 — 적 처치 시 HP 30% 회복"},
{"n":"무덤 기사 그레이브하트","sp":"knight","c":["#7d8a96","#c9a13b"],"lv":11,"hp":160,"at":20,"df":16,"sd":5,"el":"어둠","r":3,"d":2,"dep":"BOSS","t":"저주 검격 / 파수의 방벽(방어 2배 2턴)","o":{"weapon":1},"drop":"그레이브하트의 대검"},
{"n":"광부 고블린","sp":"imp","c":["#c98a3f","#8a5a2a"],"lv":12,"hp":45,"at":16,"df":8,"sd":7,"el":"땅","r":1,"d":3,"dep":"입구","t":"곡괭이 — 처치 시 골드 2배"},
{"n":"코볼트 척후병","sp":"imp","c":["#4f9f9f","#2f6e6e"],"lv":12,"hp":42,"at":17,"df":7,"sd":9,"el":"땅","r":1,"d":3,"dep":"입구","t":"경적 — 2턴 후 동료 추가 등장"},
{"n":"동굴거미","sp":"spider","c":["#5d4a6e","#c9b9e0"],"lv":13,"hp":48,"at":18,"df":7,"sd":8,"el":"독","r":1,"d":3,"dep":"중층","t":"점착 거미줄 — 대상 속도 절반"},
{"n":"자갈 골렘","sp":"golem","c":["#9a9a92","#6e6e66"],"lv":13,"hp":80,"at":16,"df":16,"sd":2,"el":"땅","r":1,"d":3,"dep":"중층","t":"바위 던지기 — 원거리 타격"},
{"n":"폭탄 딱정벌레","sp":"bug","c":["#c94f3f","#2e2e2e"],"lv":14,"hp":35,"at":24,"df":6,"sd":10,"el":"화염","r":2,"d":3,"dep":"심층","t":"자폭 — 2턴 후 광역 30 피해","o":{"larva":1}},
{"n":"광석 슬라임","sp":"slime","c":["#b9c2c9","#7d8890"],"lv":14,"hp":70,"at":14,"df":14,"sd":3,"el":"금속","r":2,"d":3,"dep":"심층","t":"경질 점액 — 받는 물리 피해 -30%"},
{"n":"드릴 골렘 스틸모스","sp":"golem","c":["#c9853f","#6e4a2a"],"lv":16,"hp":220,"at":26,"df":20,"sd":4,"el":"금속","r":3,"d":3,"dep":"BOSS","t":"회전 드릴(열 관통) / 광산 함몰(전체 20+스턴)","o":{"drill":1},"drop":"드릴 코어"},
{"n":"서리 늑대","sp":"wolf","c":["#bcd9ec","#ffffff"],"lv":17,"hp":60,"at":22,"df":9,"sd":11,"el":"냉기","r":1,"d":4,"dep":"입구","t":"브리자드 바이트 — 대상 속도 -3(중첩)"},
{"n":"아기 예티","sp":"brute","c":["#eef4f8","#cfdde8"],"lv":17,"hp":75,"at":20,"df":12,"sd":6,"el":"냉기","r":1,"d":4,"dep":"입구","t":"손뼉 충격 — 전방 범위"},
{"n":"얼음 정령","sp":"ghost","c":["#a8dff0","#ffffff"],"lv":18,"hp":55,"at":23,"df":6,"sd":8,"el":"냉기","r":2,"d":4,"dep":"중층","t":"냉기 오라 — 근접 공격자 감소"},
{"n":"펭귄 창기병","sp":"bird","c":["#3f4f5f","#f5c542"],"lv":18,"hp":58,"at":21,"df":11,"sd":7,"el":"냉기","r":1,"d":4,"dep":"중층","t":"미끄럼 돌진 — 2연속 타격","o":{"penguin":1}},
{"n":"눈보라 올빼미","sp":"bird","c":["#dfe8f0","#8a9aad"],"lv":19,"hp":52,"at":25,"df":8,"sd":12,"el":"냉기","r":2,"d":4,"dep":"심층","t":"실명 습격 — 명중률 -30%"},
{"n":"서리 트롤 글라시아","sp":"brute","c":["#cfe8f2","#5fa8cf"],"lv":21,"hp":320,"at":30,"df":18,"sd":6,"el":"냉기","r":3,"d":4,"dep":"BOSS","t":"빙결의 일격(스턴) / 초재생(매턴 HP 5%)","o":{"horns":1},"drop":"영동(永凍)의 모피"},
{"n":"역병 대왕쥐","sp":"rodent","c":["#8a7a5a","#c9b98a"],"lv":22,"hp":70,"at":26,"df":10,"sd":10,"el":"독","r":1,"d":5,"dep":"입구","t":"역병 물기 — 중독 + 방어 -10%"},
{"n":"맹독 슬라임","sp":"slime","c":["#8a4fbf","#d9a8f0"],"lv":22,"hp":90,"at":24,"df":10,"sd":5,"el":"독","r":1,"d":5,"dep":"입구","t":"부식액 — 방어력 -20%(중첩)"},
{"n":"리저드맨 창병","sp":"lizard","c":["#5f8f4f","#c9d98a"],"lv":23,"hp":85,"at":27,"df":14,"sd":8,"el":"무관","r":1,"d":5,"dep":"중층","t":"긴창 — 원거리 선제","o":{"spear":1}},
{"n":"독거미 유생","sp":"spider","c":["#7a3f6e","#e8c9dc"],"lv":23,"hp":72,"at":28,"df":9,"sd":9,"el":"독","r":2,"d":5,"dep":"중층","t":"독니 — 즉사 5%(보스 제외)"},
{"n":"진흙 트롤","sp":"brute","c":["#6e5f3f","#9aa85f"],"lv":24,"hp":150,"at":26,"df":16,"sd":4,"el":"땅","r":2,"d":5,"dep":"심층","t":"재생 — 매턴 HP 4%(화염 2배)"},
{"n":"촉수 벌레","sp":"bug","c":["#bf6f8a","#f0c9d6"],"lv":24,"hp":95,"at":29,"df":11,"sd":6,"el":"독","r":2,"d":5,"dep":"심층","t":"촉수 채찍 — 2명 동시 타격","o":{"larva":1}},
{"n":"히드라 포이즌테일","sp":"serpent","c":["#4f8f5f","#d9f05a"],"lv":26,"hp":360,"at":34,"df":20,"sd":7,"el":"독","r":3,"d":5,"dep":"BOSS","t":"3두 연격 / 맹독 분비(전체 중독)","o":{"heads":1},"drop":"독신(毒神)의 송곳니"},
{"n":"감시 눈알","sp":"eye","c":["#e8dfd0","#c94f4f"],"lv":27,"hp":80,"at":30,"df":10,"sd":9,"el":"정신","r":1,"d":6,"dep":"입구","t":"마나 광선 — 방어 절반 관통"},
{"n":"말썽 임프","sp":"imp","c":["#bf3f3f","#f0c960"],"lv":27,"hp":76,"at":31,"df":9,"sd":11,"el":"화염","r":1,"d":6,"dep":"입구","t":"불장난 — 화상 2"},
{"n":"룬 골렘","sp":"golem","c":["#4f6fbf","#a0c9f0"],"lv":28,"hp":140,"at":28,"df":22,"sd":3,"el":"마법","r":2,"d":6,"dep":"중층","t":"룬 반사막 — 마법 피해 50% 반사","o":{"runes":1}},
{"n":"떠도는 촛농","sp":"flame","c":["#f0a050","#ffd24f"],"lv":28,"hp":70,"at":33,"df":7,"sd":10,"el":"화염","r":2,"d":6,"dep":"중층","t":"인화 — 접촉 시 화상 3"},
{"n":"탑의 까마귀","sp":"bird","c":["#2e2e38","#8f7fd9"],"lv":29,"hp":74,"at":34,"df":9,"sd":13,"el":"어둠","r":2,"d":6,"dep":"심층","t":"사술(使役) — 아군 사망 시 공격력 흡수"},
{"n":"붉은 마법사 카르만","sp":"robed","c":["#8f2f3f","#f0c040"],"lv":31,"hp":380,"at":38,"df":16,"sd":9,"el":"화염","r":3,"d":6,"dep":"BOSS","t":"메테오(전체 60) / 얼어붙는 안개(전체 감속)","o":{"staff":1},"drop":"현자의 룬핵"},
{"n":"불꽃 정령","sp":"flame","c":["#ff7a2f","#ffd24f"],"lv":32,"hp":100,"at":38,"df":10,"sd":12,"el":"화염","r":1,"d":7,"dep":"입구","t":"발화 — 사망 시 폭발"},
{"n":"용암 골렘","sp":"golem","c":["#bf5a2f","#ffb04f"],"lv":33,"hp":190,"at":36,"df":24,"sd":3,"el":"화염","r":1,"d":7,"dep":"중층","t":"녹아내린 주먹 — 화상 3"},
{"n":"잿빛 화염박쥐","sp":"bat","c":["#8f4f4f","#ffb08a","#5a3030"],"lv":33,"hp":86,"at":37,"df":9,"sd":13,"el":"화염","r":1,"d":7,"dep":"중층","t":"잿더미 수습 — 화상 2"},
{"n":"살라맨더","sp":"lizard","c":["#d95f2f","#f5c542"],"lv":34,"hp":110,"at":40,"df":14,"sd":9,"el":"화염","r":2,"d":7,"dep":"심층","t":"불꽃 침 — 방어 관통 8"},
{"n":"마그마 유충","sp":"bug","c":["#ff8f4f","#7a2f1f"],"lv":34,"hp":130,"at":36,"df":16,"sd":4,"el":"화염","r":2,"d":7,"dep":"심층","t":"용암 잠복 — 기습(첫 타격 2배)","o":{"larva":1}},
{"n":"화염룡 이그니스","sp":"dragon","c":["#d94f2f","#ffd24f","#8f2f1f"],"lv":37,"hp":520,"at":48,"df":26,"sd":10,"el":"화염","r":3,"d":7,"dep":"BOSS","t":"용의 숨결(직선 70) / 날개 폭풍(밀치기+화상)","drop":"이그니스의 역린"},
{"n":"심해 아귀","sp":"fish","c":["#3f4f6e","#c9e84f"],"lv":37,"hp":120,"at":42,"df":14,"sd":8,"el":"어둠","r":1,"d":8,"dep":"입구","t":"유혹의 등불 — 명중률 -25%","o":{"angler":1}},
{"n":"심해 투구게","sp":"crab","c":["#4f6f8f","#d9e8f0"],"lv":38,"hp":150,"at":40,"df":22,"sd":5,"el":"무관","r":1,"d":8,"dep":"입구","t":"집게 올려막기 — 피해 50% 감소"},
{"n":"전격 뱀장어","sp":"serpent","c":["#e8c84f","#4fc9f0"],"lv":38,"hp":115,"at":45,"df":11,"sd":12,"el":"번개","r":2,"d":8,"dep":"중층","t":"마비 방전 — 3턴마다 전체 마비","o":{"electric":1}},
{"n":"트리톤 전사","sp":"lizard","c":["#2f6f8f","#c9f0e8"],"lv":39,"hp":145,"at":46,"df":18,"sd":9,"el":"무관","r":2,"d":8,"dep":"중층","t":"삼지창 연격 — 3연속 타격","o":{"spear":1}},
{"n":"유령 해파리","sp":"ghost","c":["#b9d9f0","#7fa8e8"],"lv":39,"hp":105,"at":44,"df":8,"sd":10,"el":"번개","r":2,"d":8,"dep":"심층","t":"마비 촉수 — 30% 마비","o":{"tent":1}},
{"n":"심연의 크라켄","sp":"kraken","c":["#5f3f8f","#b98af0"],"lv":42,"hp":600,"at":52,"df":24,"sd":8,"el":"어둠","r":3,"d":8,"dep":"BOSS","t":"촉수 포획(봉인) / 심해의 포효(전체 50+공포)","drop":"심해 진주 왕관"},
{"n":"데스 나이트","sp":"knight","c":["#3f3f4f","#9a4fd9"],"lv":43,"hp":230,"at":56,"df":22,"sd":9,"el":"어둠","r":2,"d":9,"dep":"입구","t":"사신의 낫 — 즉사 10%","o":{"weapon":1}},
{"n":"켈베로스 새끼","sp":"wolf","c":["#2e2222","#ff5a2f"],"lv":43,"hp":180,"at":58,"df":16,"sd":14,"el":"화염","r":2,"d":9,"dep":"입구","t":"업화 — 화상 4","o":{"flames":1}},
{"n":"흡혈귀 후보생","sp":"robed","c":["#7a2530","#f0d0c0","#4f1520"],"lv":44,"hp":200,"at":60,"df":15,"sd":12,"el":"어둠","r":2,"d":9,"dep":"중층","t":"생명 흡수 — 피해의 50% 회복","o":{"vampire":1}},
{"n":"텅 빈 갑주","sp":"knight","c":["#6e6e66","#2e2e2a"],"lv":44,"hp":240,"at":54,"df":28,"sd":6,"el":"어둠","r":2,"d":9,"dep":"중층","t":"저주 갑주 — 상태이상 면역"},
{"n":"미라 귀족","sp":"zomb","c":["#c9b98a","#4f3f2f"],"lv":45,"hp":210,"at":57,"df":18,"sd":7,"el":"어둠","r":2,"d":9,"dep":"심층","t":"속박 붕대 — 행동 봉인 1턴","o":{"band":1}},
{"n":"리치왕 모르드렉","sp":"robed","c":["#2f2f4f","#7ff0d9"],"lv":47,"hp":700,"at":64,"df":20,"sd":10,"el":"어둠","r":3,"d":9,"dep":"BOSS","t":"죽음의 안개(전체 55+중독) / 뼈 감옥(봉인 2턴)","o":{"staff":1},"drop":"망자왕의 관"},
{"n":"심안 감시자","sp":"eye","c":["#3f2f5f","#ff4fd9"],"lv":47,"hp":220,"at":66,"df":16,"sd":11,"el":"정신","r":2,"d":10,"dep":"입구","t":"정신 파동 — 전체 혼란"},
{"n":"카오스 임프","sp":"imp","c":["#7a4fbf","#4ff0c9"],"lv":47,"hp":190,"at":68,"df":14,"sd":13,"el":"혼돈","r":2,"d":10,"dep":"입구","t":"혼돈 마법 — 매턴 무작위 효과","o":{"thirdeye":1}},
{"n":"보이드 서펀트","sp":"serpent","c":["#1f1f2e","#9a7fff"],"lv":48,"hp":260,"at":70,"df":18,"sd":12,"el":"어둠","r":2,"d":10,"dep":"중층","t":"차원 물기 — 회피·방어 무시","o":{"hood":false}},
{"n":"추락한 천사","sp":"imp","c":["#d9c9b0","#4f4f6e","#2e2e3e"],"lv":48,"hp":230,"at":69,"df":16,"sd":14,"el":"어둠","r":2,"d":10,"dep":"중층","t":"타락의 고함 — 전체 공격 -20%","o":{"wings":1}},
{"n":"허무 골렘","sp":"golem","c":["#26262e","#b94fff"],"lv":49,"hp":420,"at":66,"df":30,"sd":4,"el":"어둠","r":2,"d":10,"dep":"심층","t":"허무 삼킴 — 최대 HP 15% 고정 피해"},
{"n":"지옥 척후병","sp":"demon","c":["#8f2f3f","#ffb04f"],"lv":49,"hp":280,"at":72,"df":20,"sd":11,"el":"화염","r":2,"d":10,"dep":"심층","t":"지옥불 검 — 화상 5"},
{"n":"심연의 군주 아비스","sp":"demon","c":["#2e1f3f","#ff3f6e","#16101f"],"lv":53,"hp":999,"at":80,"df":28,"sd":12,"el":"어둠","r":5,"d":10,"dep":"BOSS","t":"멸망의 손아귀(전체 80+봉인) / 절망의 오라(전 능력 -15%)","o":{"bwings":1},"drop":"차원틈의 조각"}
];

/* ===== 데이터: 직업 20종 (id: 101~ 예약, sp 없음→hero) ===== */
var CATS=["근접","원거리","마법","지원"];
var CATC={"근접":"#e06a6a","원거리":"#5fbf6a","마법":"#5f7fe8","지원":"#f5c542"};
var J=[
{"n":"전사","role":"근접 탱·딜러","cat":"근접","diff":2,"c":["#8f9aa8","#c94f4f","#5f6a78"],"o":{"hairstyle":"spiky","hairC":"#6e4a2f","weapon":"sword","offhand":"shield"},"hp":130,"at":15,"df":12,"sd":6,"t":"철벽의 자세 — 방어 시 피해 20% 감소","t2":"사선 베기 — 대각선 3체 타격"},
{"n":"광전사","role":"高风险高回收 딜러","cat":"근접","diff":3,"c":["#a85f4f","#ffd24f","#6e3f35"],"o":{"hairstyle":"long","hairC":"#2e2222","weapon":"axe","bare":1,"horns":1,"big":1},"hp":150,"at":19,"df":8,"sd":7,"t":"피가 끓는다 — HP 낮을수록 공격 최대 +40%","t2":"회전베기 — 자기 주변 전체 타격"},
{"n":"기사","role":"완전 방어 탱커","cat":"근접","diff":1,"c":["#5f6f8f","#c9a13b","#4a5568"],"o":{"hairstyle":"bald","helm":"full","weapon":"lance","cape":1},"hp":145,"at":15,"df":15,"sd":4,"t":"중장갑 — 받는 치명타 피해 50% 감소","t2":"돌진 찌르기 — 직선 관통 + 밀치기"},
{"n":"팔라딘","role":"성기사 탱·힐","cat":"근접","diff":2,"c":["#e8e0c8","#f5c542","#c9b98a"],"o":{"hairstyle":"bob","hairC":"#c9a86a","weapon":"greatsword","offhand":"shield","aura":"holy"},"hp":135,"at":16,"df":13,"sd":5,"t":"성스러운 가호 — 매턴 HP 3% 회복","t2":"심판의 일격 — 언데드에게 2배 피해"},
{"n":"다크나이트","role":"흡혈 딜러","cat":"근접","diff":3,"c":["#3f3f4f","#9a4fd9","#26263a"],"o":{"hairstyle":"long","hairC":"#1f1f2e","helm":"half","weapon":"greatsword","cape":1,"aura":"dark"},"hp":140,"at":18,"df":11,"sd":6,"t":"생명 흡수 — 준 피해의 15% HP 회복","t2":"어둠의 참격 — 방어 관통 10"},
{"n":"궁수","role":"원거리 딜러","cat":"원거리","diff":2,"c":["#5f8f4f","#c9d98a","#4a6e3a"],"o":{"hairstyle":"ponytail","hairC":"#8a5a2a","weapon":"bow","headband":1},"hp":95,"at":17,"df":7,"sd":10,"t":"매의 눈 — 명중률 95% 고정","t2":"관통 화살 — 적 열 전체 타격"},
{"n":"사냥꾼","role":"함정·원거리","cat":"원거리","diff":2,"c":["#6e5f3f","#d98a4f","#4a3f2a"],"o":{"hairstyle":"ponytail","hairC":"#3f2f1f","weapon":"crossbow","gog":1},"hp":100,"at":15,"df":8,"sd":9,"t":"추적자 — 적 처치 시 다음 행동 즉시","t2":"덫 설치 — 선제 스턴 1턴"},
{"n":"도적","role":"암살자","cat":"근접","diff":3,"c":["#4f4f5f","#c94f4f","#35354a"],"o":{"hairstyle":"short","hairC":"#2e2e38","hat":"hood","weapon":"dagger","scarf":1},"hp":90,"at":18,"df":6,"sd":12,"t":"급소 간파 — 20% 확률 1.5배 크리티컬","t2":"그림자 걸음 — 1턴 회피 + 즉발 재행동"},
{"n":"닌자","role":"속공 암살","cat":"근접","diff":4,"c":["#2e3444","#c94f4f","#1a2030"],"o":{"hairstyle":"ponytail","hairC":"#141821","weapon":"dagger","mask":1,"scarf":1},"hp":85,"at":19,"df":5,"sd":14,"t":"분신술 — 회피 성공 시 반격","t2":"수리검 난사 — 3연속 원거리 타격"},
{"n":"사무라이","role":"일격필살 딜러","cat":"근접","diff":3,"c":["#4f3f5f","#e05a5a","#3a3050"],"o":{"hairstyle":"topknot","hairC":"#1f1f2e","weapon":"katana","shoulder":1},"hp":115,"at":19,"df":10,"sd":8,"t":"거합 — 전투 첫 공격 위력 2배","t2":"참격 연무 — 2연속 타격 + 출혈"},
{"n":"몽크","role":"격투가","cat":"근접","diff":2,"c":["#c98a5a","#d94f4f","#a06a3f"],"o":{"hairstyle":"bald","weapon":"fist","headband":1,"bare":1,"pants":"#8a5a2a"},"hp":110,"at":17,"df":7,"sd":11,"t":"기공 — 연속 공격할수록 위력 증가","t2":"파장권 — 원거리 충격파"},
{"n":"마법사","role":"마법 딜러","cat":"마법","diff":2,"c":["#4f6fbf","#a0c9f0","#3a5494"],"o":{"hairstyle":"long","hairC":"#c9a86a","hat":"wizard","weapon":"staff"},"hp":75,"at":7,"df":5,"sd":7,"t":"정신 집중 — 매턴 MP 10% 회복","t2":"파이어볼 — 단일 대미지 + 화상"},
{"n":"흑마법사","role":"저주 마법","cat":"마법","diff":3,"c":["#3f2f5f","#7fe0d0","#2a2040"],"o":{"hairstyle":"bald","hat":"wizard","weapon":"skullstaff","aura":"dark"},"hp":72,"at":8,"df":5,"sd":6,"t":"대가(代價) — 시전 시 HP 소모, 위력 +30%","t2":"저주 — 적 전체 능력치 -15%"},
{"n":"사제","role":"힐러","cat":"지원","diff":1,"c":["#f0ead8","#f5c542","#d9cfb8"],"o":{"hairstyle":"bob","hairC":"#c9a86a","weapon":"mace","halo":1,"robe":1},"hp":85,"at":9,"df":7,"sd":6,"t":"축복 — 아군 사망 1회 무효(전투당)","t2":"힐 웨이브 — 아군 전체 HP 30 회복"},
{"n":"드루이드","role":"자연 마법","cat":"마법","diff":3,"c":["#5f8f4f","#8fce6a","#3f6e35"],"o":{"hairstyle":"long","hairC":"#6e4a2f","antlers":1,"weapon":"staff","cape":1},"hp":95,"at":12,"df":8,"sd":7,"t":"자연의 공명 — 지형 디버프 무시","t2":"태풍 호출 — 전체 바람 피해 + 밀치기"},
{"n":"소환사","role":"하수인 운용","cat":"마법","diff":3,"c":["#6f5f9f","#ffb04f","#574a80"],"o":{"hairstyle":"long","hairC":"#c96a8a","circlet":1,"weapon":"book","orb":1},"hp":78,"at":6,"df":5,"sd":7,"t":"정령 친화 — 소환수 능력치 +20%","t2":"정령 소환 — 전투에 동료 1기 추가"},
{"n":"연금술사","role":"버프·디버프","cat":"마법","diff":2,"c":["#8fbf4f","#7fe0d0","#6e9a3a"],"o":{"hairstyle":"short","hairC":"#c9a86a","gog":1,"weapon":"flask","robe":1},"hp":88,"at":10,"df":6,"sd":8,"t":"폭주 조합 — 물약 중복 사용 가능","t2":"강산 투척 — 대상 방어력 -30%"},
{"n":"시간술사","role":"시간 조작","cat":"마법","diff":4,"c":["#4f5f8f","#ffd24f","#3a4a70"],"o":{"hairstyle":"bob","hairC":"#c9a86a","hat":"wizard","weapon":"hourglass","cape":1},"hp":74,"at":7,"df":5,"sd":9,"t":"예견 — 적의 선제 공격 25% 회피","t2":"헤이스트 — 아군 속도 2배(2턴)"},
{"n":"음유시인","role":"서포터","cat":"지원","diff":1,"c":["#d98a4f","#f0e0b0","#b06a35"],"o":{"hairstyle":"ponytail","hairC":"#6e4a2f","hat":"beret","feather":1,"weapon":"lute","robe":1},"hp":92,"at":11,"df":6,"sd":9,"t":"여운 — 노래 효과 1턴 연장","t2":"전투 산조 — 아군 전체 공격 +15%(2턴)"},
{"n":"해적","role":"근접 난타","cat":"근접","diff":2,"c":["#c94f4f","#f0c040","#8f3030"],"o":{"hairstyle":"long","hairC":"#3f2f1f","hat":"bandana","pirate":1,"eyepatch":1,"weapon":"sword"},"hp":125,"at":16,"df":9,"sd":8,"t":"나쁜 짐 — 골드 획득 1.5배","t2":"포격 요청 — 무작위 지역 폭격 3회"}
];

/* ===== 렌더링 상수 ===== */
var ELC={"무관":"#9aa2ad","독":"#9a59d9","화염":"#e0603f","냉기":"#5fc0e8","번개":"#e8c84f",
 "어둠":"#6a4f9a","자연":"#5fbf6a","땅":"#a97c50","금속":"#8a97a8","바람":"#6fc9a8",
 "정신":"#e07fa8","마법":"#5f7fe8","혼돈":"#e84fd9"};

/* ── 프레임 비트맵 캐시 (LRU) ── */
var FCNT=4;
var BAKED={},LRU=[],LRU_MAX=140;   /* 140종×4프레임×4KB ≈ 최대 ~2.3MB */
function bakeOne(m,f){
 var g=build(m,f);
 var c=document.createElement('canvas');c.width=W;c.height=H;
 var ctx=c.getContext('2d'),img=ctx.createImageData(W,H),y,x,i,t;
 for(y=0;y<H;y++)for(x=0;x<W;x++){var cc=g[y][x];i=(y*W+x)*4;
  if(cc){t=rgb(cc);img.data[i]=t[0];img.data[i+1]=t[1];img.data[i+2]=t[2];img.data[i+3]=255;}}
 ctx.putImageData(img,0,0);
 return c;}                          /* 비트맵만 반환, g는 가비지로 폐기 */
function framesOf(m){
 var id=m.id,b=BAKED[id],k;
 if(b){k=LRU.indexOf(id);if(k>-1){LRU.splice(k,1);LRU.push(id);}return b;}
 b=[];for(var f=0;f<FCNT;f++)b.push(bakeOne(m,f));
 BAKED[id]=b;LRU.push(id);
 while(LRU.length>LRU_MAX)delete BAKED[LRU.shift()];
 return b;}
function blit(cv,frame){
 var ctx=cv.__x||(cv.__x=cv.getContext('2d'));
 if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
 ctx.clearRect(0,0,W,H);ctx.drawImage(frame,0,0);}

/* ===== 유틸 ===== */
function findAny(id){var i;
 for(i=0;i<M.length;i++)if(M[i].id===id)return M[i];
 for(i=0;i<J.length;i++)if(J[i].id===id)return J[i];
 return null;}
function cp(m){return Math.round(m.hp/8+m.at*1.5+m.df*1.2+m.sd);}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}

/* ===== 카드 HTML 생성 ===== */
function cardHTML(m){
 var boss=(m.dep==='BOSS'),style=boss?' style="border-color:#f5c54288"':'';
 return '<div class="card" data-id="'+m.id+'"'+style+'>'
 +'<div class="nm">'+esc(m.n)+'</div>'
 +'<div class="meta"><span class="el" style="background:'+ELC[m.el]+'">'+esc(m.el)+'</span> · '+'★'.repeat(m.r)+'</div>'
 +'<div class="spr"><canvas data-spr="'+m.id+'"></canvas></div>'
 +'<div class="st"><span>HP<b>'+m.hp+'</b></span><span>공<b>'+m.at+'</b></span><span>방<b>'+m.df+'</b></span><span>속<b>'+m.sd+'</b></span></div>'
 +'<div class="tr">'+esc(m.t)+'</div></div>';
}
function bossHTML(m){
 return '<div class="boss" data-id="'+m.id+'">'
 +'<div class="spr"><canvas data-spr="'+m.id+'"></canvas></div>'
 +'<div class="binfo"><span class="badge">FIELD BOSS</span>'
 +'<h3>'+esc(m.n)+' <small style="color:var(--sub)">Lv '+m.lv+'</small></h3>'
 +'<div class="stars">'+'★'.repeat(m.r)+'</div>'
 +'<div class="bstats"><span>❤ HP '+m.hp+'</span><span>⚔ 공격 '+m.at+'</span><span>🛡 방어 '+m.df+'</span>'
 +'<span>💨 속도 '+m.sd+'</span><span>⚡ CP '+cp(m)+'</span></div>'
 +'<div class="tr" style="min-height:0">'+esc(m.t)+'</div>'
 +'<div class="drop">🎁 드랍: '+esc(m.drop||'-')+'</div></div></div>';
}
function jobHTML(m){
 return '<div class="card job" data-id="'+m.id+'">'
 +'<div class="nm">'+esc(m.n)+'</div>'
 +'<div class="meta"><span class="catb" style="background:'+CATC[m.cat]+'">'+esc(m.cat)+'</span>'
 +esc(m.role)+' · '+'★'.repeat(m.diff)+'</div>'
 +'<div class="spr"><canvas data-spr="'+m.id+'"></canvas></div>'
 +'<div class="st"><span>HP<b>'+m.hp+'</b></span><span>공<b>'+m.at+'</b></span><span>방<b>'+m.df+'</b></span><span>속<b>'+m.sd+'</b></span></div>'
 +'<div class="tr">패시브 · '+esc(m.t)+'<br>스킬 · '+esc(m.t2)+'</div></div>';
}

/* ===== UI 상태 & 루트 참조 (init에서 바인딩) ===== */
var state={tab:'mon',dun:0,cat:0,mode:'frame',sort:'lv',q:''};
var ROOT=null,BAR=null,APP=null,MODAL=null,MBOX=null;
var SPR_CS=[],mcvM=null,inited=false;

function q(sel){return ROOT.querySelector(sel);}
function qa(sel){return Array.prototype.slice.call(ROOT.querySelectorAll(sel));}

function modeBtns(){
 return '<button class="chip'+(state.mode==='css'?' on':'')+'" data-mode="css">Ⓐ CSS 바운스</button>'
 +'<button class="chip'+(state.mode==='frame'?' on':'')+'" data-mode="frame">Ⓑ 프레임 애니</button>'
 +'<button class="chip'+(state.mode==='off'?' on':'')+'" data-mode="off">⏸ 정지</button>';
}
function renderBar(){
 var html='';
 if(state.tab==='mon'){
  html+='<button class="chip'+(state.dun===0?' on':'')+'" data-d="0">전체</button>';
  DG.forEach(function(d){
   html+='<button class="chip'+(state.dun===d.no?' on':'')+'" data-d="'+d.no+'">'+d.no+'. '+esc(d.name)+'</button>';});
  html+='<select class="srt"><option value="lv">레벨순</option><option value="name">이름순</option><option value="cp">전투력순</option></select>'
   +'<input class="srch" placeholder="이름 검색..." value="'+esc(state.q)+'">';
 }else{
  html+='<button class="chip'+(state.cat===0?' on':'')+'" data-c="0">전체</button>';
  CATS.forEach(function(ct,i){
   html+='<button class="chip'+(state.cat===i+1?' on':'')+'" data-c="'+(i+1)+'">'+ct+'</button>';});
  html+='<input class="srch" placeholder="이름·역할 검색..." value="'+esc(state.q)+'">';
 }
 html+=modeBtns();
 BAR.innerHTML=html;
 Array.prototype.forEach.call(BAR.querySelectorAll('.chip[data-d]'),function(b){
  b.onclick=function(){state.dun=parseInt(b.getAttribute('data-d'),10);renderBar();renderMain();};});
 Array.prototype.forEach.call(BAR.querySelectorAll('.chip[data-c]'),function(b){
  b.onclick=function(){state.cat=parseInt(b.getAttribute('data-c'),10);renderBar();renderMain();};});
 Array.prototype.forEach.call(BAR.querySelectorAll('.chip[data-mode]'),function(b){
  b.onclick=function(){setMode(b.getAttribute('data-mode'));};});
 var srt=BAR.querySelector('.srt');
 if(srt){srt.value=state.sort;
  srt.onchange=function(e){state.sort=e.target.value;renderMain();};}
 var srch=BAR.querySelector('.srch');
 srch.oninput=function(e){state.q=e.target.value.trim();renderMain();
  BAR.querySelector('.srch').focus();};
}

function renderMonsters(){
 var html='';
 var list=M.filter(function(m){
  if(state.dun!==0&&m.d!==state.dun)return false;
  if(state.q&&m.n.indexOf(state.q)<0)return false;
  return true;});
 list.sort(function(a,b){
  if(state.sort==='name')return a.n.localeCompare(b.n,'ko');
  if(state.sort==='cp')return cp(b)-cp(a);
  return a.lv-b.lv;});
 DG.forEach(function(d){
  if(state.dun!==0&&state.dun!==d.no)return;
  var ms=list.filter(function(m){return m.d===d.no;});
  if(!ms.length)return;
  html+='<section style="border-color:'+d.hue+'44">'
   +'<div class="dhead" style="background:'+d.hue+'12">'
   +'<h2 style="color:'+d.hue+'">◈ '+d.no+'. '+esc(d.name)
   +'<span class="rec" style="background:'+d.hue+'">권장 '+esc(d.rec)+'</span></h2>'
   +'<div class="desc">'+esc(d.desc)+'</div></div>';
  ['입구','중층','심층'].forEach(function(dep){
   var grp=ms.filter(function(m){return m.dep===dep;});
   if(!grp.length)return;
   var lo=grp[0].lv,hi=grp[0].lv;
   grp.forEach(function(m){if(m.lv<lo)lo=m.lv;if(m.lv>hi)hi=m.lv;});
   html+='<div class="depth"><b>▸ '+dep+' 구간</b> · 출현 Lv '+lo+'~'+hi+'</div>'
    +'<div class="grid">'+grp.map(cardHTML).join('')+'</div>';});
  var bs=null;
  ms.forEach(function(m){if(m.dep==='BOSS')bs=m;});
  if(bs)html+='<div class="depth"><b>▸ 보스 방</b> — 단독 조우 · 필드보스</div>'
   +'<div class="bosswrap">'+bossHTML(bs)+'</div>';
  html+='</section>';});
 APP.innerHTML=html||'<p style="color:var(--sub)">검색 결과가 없습니다.</p>';
}
function renderJobs(){
 var html='';
 var list=J.filter(function(j){
  if(state.cat!==0&&CATS[state.cat-1]!==j.cat)return false;
  if(state.q&&j.n.indexOf(state.q)<0&&j.role.indexOf(state.q)<0)return false;
  return true;});
 CATS.forEach(function(ct){
  var grp=list.filter(function(j){return j.cat===ct;});
  if(!grp.length)return;
  html+='<section style="border-color:'+CATC[ct]+'44">'
   +'<div class="dhead" style="background:'+CATC[ct]+'12">'
   +'<h2 style="color:'+CATC[ct]+'">◆ '+ct+' 계열'
   +'<span class="rec" style="background:'+CATC[ct]+'">'+grp.length+'종</span></h2></div>'
   +'<div class="grid">'+grp.map(jobHTML).join('')+'</div></section>';});
 APP.innerHTML=html||'<p style="color:var(--sub)">검색 결과가 없습니다.</p>';
}
function renderMain(){
 /* 이전 캔버스들의 가시성 관찰 해제 (메모리 누수 방지) */
 Array.prototype.forEach.call(SPR_CS,function(c){if(VIS)VIS.unobserve(c);});
 if(state.tab==='mon')renderMonsters();else renderJobs();
 /* DOM 스캔은 렌더 시 한 번만 — 루프에서는 캐시된 배열 순회 */
 SPR_CS=qa('canvas[data-spr]');
 SPR_CS.forEach(function(c){
  if(VIS)VIS.observe(c);
  var mm=findAny(parseInt(c.getAttribute('data-spr'),10));
  if(mm)blit(c,framesOf(mm)[0]);});
 Array.prototype.forEach.call(APP.querySelectorAll('[data-id]'),function(node){
  node.onclick=function(){openDlg(parseInt(node.getAttribute('data-id'),10));};});
 applyAnim();
}

/* ── 움직임 모드 ── */
function applyAnim(){
 ROOT.classList.toggle('acss',state.mode==='css');
 qa('canvas[data-spr]').forEach(function(c){
  if(state.mode==='css'){
   var mm=findAny(parseInt(c.getAttribute('data-spr'),10));
   c.setAttribute('data-fly',(mm&&FLY[mm.sp])?'1':'0');
   c.style.animationDelay=(-(((parseInt(c.getAttribute('data-spr'),10)*37)%23)/10)).toFixed(2)+'s';
  }else{c.removeAttribute('data-fly');c.style.animationDelay='';}});
}
function repaintStatic(){
 SPR_CS.forEach(function(c){
  var mm=findAny(parseInt(c.getAttribute('data-spr'),10));
  if(mm)blit(c,framesOf(mm)[0]);});
 var mc=MBOX.querySelector('canvas');
 if(MODAL.classList.contains('on')&&mcvM&&mc)blit(mc,framesOf(mcvM)[0]);
}
function setMode(mo){
 state.mode=mo;
 Array.prototype.forEach.call(BAR.querySelectorAll('.chip[data-mode]'),function(b){
  b.classList.toggle('on',b.getAttribute('data-mode')===mo);});
 if(mo!=='frame')repaintStatic();
 applyAnim();
}

/* ── 모달 ── */
function openDlg(id){
 var m=findAny(id);if(!m)return;
 mcvM=m;
 var head='',rows='',traits='';
 if(m.dep){ /* 몬스터 */
  var d=null;DG.forEach(function(x){if(x.no===m.d)d=x;});
  head=(d?(d.no+'. '+esc(d.name)+' · '):'')+esc(m.dep)+' 구간 · '
   +'<span class="el" style="background:'+ELC[m.el]+'">'+esc(m.el)+'</span> · '
   +'★'.repeat(m.r)+' · CP '+cp(m);
  rows='<div class="dgrid"><span>HP</span><b>'+m.hp+'</b><span>공격력</span><b>'+m.at+'</b>'
   +'<span>방어력</span><b>'+m.df+'</b><span>속도</span><b>'+m.sd+'</b></div>';
  traits='<div style="font-size:12.5px;background:#141126;border-radius:8px;padding:8px">📌 '+esc(m.t)+'</div>'
   +(m.drop?'<div class="drop" style="margin-top:8px">🎁 드랍: '+esc(m.drop)+'</div>':'');
 }else{ /* 직업 */
  head='<span class="catb" style="background:'+CATC[m.cat]+'">'+esc(m.cat)+'</span>'
   +esc(m.role)+' · 난이도 '+'★'.repeat(m.diff)+' · CP '+cp(m);
  rows='<div class="dgrid"><span>HP</span><b>'+m.hp+'</b><span>공격력</span><b>'+m.at+'</b>'
   +'<span>방어력</span><b>'+m.df+'</b><span>속도</span><b>'+m.sd+'</b></div>';
  traits='<div style="font-size:12.5px;background:#141126;border-radius:8px;padding:8px;margin-bottom:6px">🛡 패시브 · '+esc(m.t)+'</div>'
   +'<div style="font-size:12.5px;background:#141126;border-radius:8px;padding:8px">⚡ 스킬 · '+esc(m.t2)+'</div>';
 }
 MBOX.innerHTML='<button class="mclose">✕</button>'
  +'<div style="text-align:center"><canvas></canvas></div>'
  +'<h3 style="margin-top:10px">'+esc(m.n)+(m.lv?' <small style="color:var(--sub)">Lv '+m.lv+'</small>':'')+'</h3>'
  +'<div style="font-size:12px;color:var(--sub);margin:4px 0">'+head+'</div>'
  +rows+traits;
 MODAL.classList.add('on');
 blit(MBOX.querySelector('canvas'),framesOf(m)[0]);
 MBOX.querySelector('.mclose').onclick=function(){MODAL.classList.remove('on');};
 if(state.mode==='css'){MBOX.querySelector('canvas').setAttribute('data-fly',FLY[m.sp]?'1':'0');}
}

/* ── 가시성 추적 (화면 밖 재생 스킵) ── */
var VIS=('IntersectionObserver'in window)?new IntersectionObserver(function(es){
 es.forEach(function(e){e.target.dataset.vis=e.isIntersecting?'1':'0';});},
 {rootMargin:'100px'}):null;

/* ── 프레임 재생 루프 (Ⓑ 모드에서만, 보이는 캔버스만, init 시 1회 시작) ── */
var loopStarted=false,tickN=0,lastTs=0;
function startLoop(){
 if(loopStarted)return;loopStarted=true;
 (function loop(ts){requestAnimationFrame(loop);
  if(state.mode!=='frame')return;
  if(ts-lastTs<150)return;lastTs=ts;tickN++;
  var i,c,id,mm;
  for(i=0;i<SPR_CS.length;i++){
   c=SPR_CS[i];
   if(!c.isConnected||c.dataset.vis==='0')continue;
   id=parseInt(c.getAttribute('data-spr'),10);mm=findAny(id);
   if(mm)blit(c,framesOf(mm)[(tickN+id)%FCNT]);}
  if(MODAL&&MODAL.classList.contains('on')&&mcvM){
   var mc=MBOX.querySelector('canvas');
   if(mc)blit(mc,framesOf(mcvM)[tickN%FCNT]);}
 })(0);
}

/* ═══════════════════════════════════════════
 * 공개 초기화 함수 — 호스트 코드에서 호출
 *   PixelCodex.init()        : 문서의 첫 .pdcx 사용
 *   PixelCodex.init(element) : 지정 루트 사용
 * ═══════════════════════════════════════════ */
function init(root){
 if(inited){console.warn('[PixelCodex] 이미 초기화됨 — 다중 인스턴스 미지원');return;}
 ROOT=root||document.querySelector('.pdcx');
 if(!ROOT){console.error('[PixelCodex] .pdcx 루트를 찾을 수 없습니다.');return;}
 BAR=ROOT.querySelector('.cx-bar');
 APP=ROOT.querySelector('.cx-app');
 MODAL=ROOT.querySelector('.cx-modal');
 MBOX=ROOT.querySelector('.cx-mbox');
 /* ID 자동 부여 (몬스터 1~, 직업 101~ — 몬스터 100종 미만 유지할 것) */
 M.forEach(function(m,i){m.id=i+1;});
 J.forEach(function(j,i){j.id=101+i;});
 /* 탭 바인딩 */
 Array.prototype.forEach.call(ROOT.querySelectorAll('.pdcx-tabs .chip'),function(b){
  b.onclick=function(){
   state.tab=b.getAttribute('data-tab');
   Array.prototype.forEach.call(ROOT.querySelectorAll('.pdcx-tabs .chip'),function(x){
    x.classList.toggle('on',x===b);});
   renderBar();renderMain();};});
 /* 모달 배경 클릭 닫기 */
 MODAL.onclick=function(e){if(e.target===MODAL)MODAL.classList.remove('on');};
 inited=true;
 renderBar();
 renderMain();
 startLoop();
}

/* ===== 외부 API 노출 ===== */
return {
 init:init,                                   /* UI 초기화 (필수, 1회) */
 setMode:setMode,                             /* 'css'|'frame'|'off' */
 openDlg:openDlg,                             /* 숫자 id로 상세 모달 열기 */
 getEntity:findAny,                           /* id → 데이터 엔트리 */
 getFrames:function(id){var m=findAny(id);    /* id → 비트맵 프레임 4개 배열 */
  return m?framesOf(m):null;},
 buildGrid:function(id,f){var m=findAny(id);  /* id → 원본 그리드 (매번 새로 생성) */
  return m?build(m,f||0):null;},
 blit:blit,                                   /* (canvas, frame) 화면 전송 */
 state:state,                                 /* UI 상태 (tab/dun/cat/mode/sort/q) */
 DATA:{monsters:M,jobs:J,dungeons:DG,CATS:CATS,CATC:CATC,ELC:ELC,FLY:FLY,SP:SP}
};
})();

/* ── Codex 기동: 도감 UI는 숨긴 채 스프라이트 공급자로만 사용 ──
   init은 무거운 베이크 작업을 수반하므로 idle 시점으로 지연 */
(function(){
  function boot(){
    try{
      PixelCodex.init(document.querySelector('.pdcx'));
      PixelCodex.setMode('off');   /* 내부 rAF 루프 휴면 — 메인 루프 단일화 유지 */
    }catch(e){console.warn('[PixelCodex] init 실패 — 조우 투어 비활성',e);}
  }
  boot();
})();