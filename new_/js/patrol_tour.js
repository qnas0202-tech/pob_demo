/* ══════════════════════════════════════════════════════════
   🌀 던전 심연 — 순찰 투어 (메인 게임 스크립트)
   의존성: pixelcodex.js / engine-core.js / worldgen.js 가 먼저 로드될 것
   - 엔진 유틸(TS,pack,RND,clampN,normAng,sndOn,AC,initAudio,beep,
     sndPickup/Locked/Win,vib,makeLevels,텍스처/스프라이트 공장,ORIG/THEME)
     → engine-core.js 로 이동됨
   - 월드 생성(MW,MH,DX/DY,TILES,Solver,seedAnchors,CA_*,dmode,caKey,
     GEN_TABLE,nextDungeon,resolveProfile) → worldgen.js 로 이동됨
   ══════════════════════════════════════════════════════════ */
"use strict";

/* ============================================================
   해상도 / 기본 속도
   ============================================================ */
const BASE_MOVE=3.1,BASE_ROT=2.6;
let MOVE_SPD=BASE_MOVE,ROT_SPD=BASE_ROT,LOOK_SENS=0.0052,sensMul=1;
const COLL_R=0.22,GEM_TOTAL=6;

const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
let IW=320,IH=180,img=null,buf32=null,zbuf=null,vignette=null;
let planeLen=0.74,uiS=1,PIX_BUDGET=140000;
const vw_=()=>Math.floor((window.visualViewport||window).width||innerWidth);
const vh_=()=>Math.floor((window.visualViewport||window).height||innerHeight);

function applyRes(){
  const cw=Math.max(1,vw_()),ch=Math.max(1,vh_()),aspect=cw/ch;
  planeLen=aspect>=1?0.74:0.95;
  let ih=Math.sqrt(PIX_BUDGET/aspect);
  ih=Math.min(380,Math.max(150,ih));
  let iw=Math.round(ih*aspect);
  iw=Math.min(620,Math.max(150,iw));
  ih=Math.round(iw/aspect);
  IW=iw;IH=ih;
  cv.width=IW;cv.height=IH;
  img=ctx.createImageData(IW,IH);
  buf32=new Uint32Array(img.data.buffer);
  zbuf=new Float32Array(IW);
  vignette=null;
  uiS=Math.min(1.35,Math.max(0.72,IH/230));
  ctx.imageSmoothingEnabled=false;
  resizeGen();
}
addEventListener('resize',applyRes);
addEventListener('orientationchange',()=>setTimeout(applyRes,300));

/* ============================================================
   맵 데이터 / 배치  (dmode/caKey는 worldgen.js 소유)
   ============================================================ */
let grid,styleG,visited,gems,portal,torches,startPos,startAng,openCells;
let wetG=null,waterG=null,lights=[],decos=[],lakeSeen=false;
let TOTAL_FLOOR=1;

const CEIL_H=()=>dmode==='cave'?0.62:1.0;
const WALLTEX=()=>THEME[dmode].wall;   // THEME ← engine-core.js

function finalizeGrid(cells){
  grid=cells;styleG=new Uint8Array(MW*MH);
  wetG=dmode==='cave'?new Uint8Array(MW*MH):null;
  waterG=null;lakeSeen=false;
  openCells=[];
  for(let i=0;i<MW*MH;i++){
    if(!grid[i]){
      openCells.push(i);
      if(wetG){
        const x=i%MW,y=(i/MW)|0;let adj=false;
        for(let k=0;k<4;k++){
          const nx=x+DX[k],ny=y+DY[k];
          if(nx>=0&&ny>=0&&nx<MW&&ny<MH&&grid[ny*MW+nx]){adj=true;break;}
        }
        wetG[i]=(adj&&Math.random()<0.30)||(Math.random()<0.05)?1:0;
      }
    }
    const r=Math.random();
    if(dmode==='cave')styleG[i]=r<0.5?0:r<0.93?1:2;
    else styleG[i]=r<0.16?1:r<0.24?2:0;
  }
}
const landPass=i=>!grid[i]&&!(waterG&&waterG[i]);

function bfsFar(start){
  const dist=new Int16Array(MW*MH).fill(-1);
  const q=[start];dist[start]=0;let far=start,fd=0;
  while(q.length){
    const c=q.shift(),d=dist[c],x=c%MW,y=(c/MW)|0;
    if(d>fd){fd=d;far=c;}
    for(let k=0;k<4;k++){
      const nx=x+DX[k],ny=y+DY[k];
      if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
      const ni=ny*MW+nx;
      if(landPass(ni)&&dist[ni]<0){dist[ni]=d+1;q.push(ni);}
    }
  }
  return{dist,far,fd};
}
function bfsDist(start){
  const dist=new Int16Array(MW*MH).fill(-1);
  const q=[start];dist[start]=0;
  while(q.length){
    const c=q.shift(),d=dist[c],x=c%MW,y=(c/MW)|0;
    for(let k=0;k<4;k++){
      const nx=x+DX[k],ny=y+DY[k];
      if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
      const ni=ny*MW+nx;
      if(landPass(ni)&&dist[ni]<0){dist[ni]=d+1;q.push(ni);}
    }
  }
  return dist;
}
function placeEntities(){
  if(openCells.length<150)return false;
  const a=bfsFar(openCells[0]);
  const comp=openCells.filter(i=>a.dist[i]>=0);
  if(comp.length<150)return false;
  TOTAL_FLOOR=comp.length;
  const b=bfsFar(a.far);
  const spawn=a.far,port=b.far;
  if(b.fd<20)return false;
  startPos={x:(spawn%MW)+.5,y:((spawn/MW)|0)+.5};
  portal={x:(port%MW)+.5,y:((port/MW)|0)+.5};
  {
    const sx=spawn%MW,sy=(spawn/MW)|0;let vx=0,vy=0;
    for(let k=0;k<4;k++){
      const nx=sx+DX[k],ny=sy+DY[k];
      if(nx>=0&&ny>=0&&nx<MW&&ny<MH&&!grid[ny*MW+nx]){vx+=DX[k];vy+=DY[k];}
    }
    startAng=(vx===0&&vy===0)?0:Math.atan2(vy,vx);
  }
  const pd=bfsDist(port),sd=bfsDist(spawn);
  const cand=comp.filter(i=>pd[i]>0&&sd[i]>5).sort((p,q)=>pd[q]-pd[p]);
  gems=[];const taken=[port,spawn];
  for(const c of cand){
    if(gems.length>=GEM_TOTAL)break;
    const x=c%MW,y=(c/MW)|0;
    if(taken.every(t=>Math.abs((t%MW)-x)+Math.abs(((t/MW)|0)-y)>=7)){
      gems.push({x:x+.5,y:y+.5,got:false,phase:Math.random()*7});taken.push(c);
    }
  }
  while(gems.length<GEM_TOTAL&&cand.length>gems.length){
    const c=cand[gems.length];
    gems.push({x:(c%MW)+.5,y:((c/MW)|0)+.5,got:false,phase:Math.random()*7});
  }
  lights=[];decos=[];
  const busy=i=>i===spawn||i===port||gems.some(gm=>((gm.x|0)+(gm.y|0)*MW)===i);
  for(const c of comp){
    const x=c%MW,y=(c/MW)|0;
    let wd=-1;
    for(let k=0;k<4;k++){
      const nx=x+DX[k],ny=y+DY[k];
      if(nx>=0&&ny>=0&&nx<MW&&ny<MH&&grid[ny*MW+nx]){wd=k;break;}
    }
    if(dmode==='cave'){
      if(wd>=0&&Math.random()<0.07&&lights.length<14&&!busy(c)){
        lights.push({x:x+.5+DX[wd]*0.40,y:y+.5+DY[wd]*0.40,seed:Math.random()*10,cry:true,ci:c});
      }
      if(Math.random()<0.05&&decos.length<22&&!busy(c)){
        decos.push({x:x+.5+RND(-.17,.17),y:y+.5+RND(-.17,.17),hW:RND(0.34,0.58),flip:Math.random()<.5,ci:c});
      }
    }else{
      if(wd>=0&&Math.random()<0.085&&lights.length<16&&!busy(c)){
        lights.push({x:x+.5+DX[wd]*0.42,y:y+.5+DY[wd]*0.42,seed:Math.random()*10,cry:false,ci:c});
      }
    }
  }
  visited=new Uint8Array(MW*MH);
  return true;
}

/* ============================================================
   🌊 지하호수 생성 (연결성 보장 + 보호구역 회피)
   ============================================================ */
function connectedLand(a,b){
  const st=[a],seen=new Set([a]);
  while(st.length){
    const c=st.pop();
    if(c===b)return true;
    const x=c%MW,y=(c/MW)|0;
    for(let k=0;k<4;k++){
      const nx=x+DX[k],ny=y+DY[k];
      if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
      const ni=ny*MW+nx;
      if(landPass(ni)&&!seen.has(ni)){seen.add(ni);st.push(ni);}
    }
  }
  return false;
}
function countLand(){let n=0;for(let i=0;i<MW*MH;i++)if(landPass(i))n++;return n;}
function recountTotalFloor(){
  const s=(startPos.y|0)*MW+(startPos.x|0);
  if(!landPass(s))return;
  const seen=new Uint8Array(MW*MH);seen[s]=1;
  const st=[s];let n=1;
  while(st.length){
    const c=st.pop(),x=c%MW,y=(c/MW)|0;
    for(let k=0;k<4;k++){
      const nx=x+DX[k],ny=y+DY[k];
      if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
      const ni=ny*MW+nx;
      if(landPass(ni)&&!seen[ni]){seen[ni]=1;n++;st.push(ni);}
    }
  }
  TOTAL_FLOOR=n;
}
function genLake(){
  waterG=null;lakeSeen=false;
  if(dmode!=='cave')return;
  waterG=new Uint8Array(MW*MH);
  const spawnI=(startPos.y|0)*MW+(startPos.x|0);
  const portI=(portal.y|0)*MW+(portal.x|0);
  const prot=new Set([spawnI,portI]);
  for(const gm of gems)prot.add((gm.y|0)*MW+(gm.x|0));
  for(const tc of lights)prot.add(tc.ci);
  for(const dc of decos)prot.add(dc.ci);
  const land=[];for(let i=0;i<MW*MH;i++)if(!grid[i])land.push(i);
  const ds=bfsDist(spawnI),dp=bfsDist(portI);
  const seeds=land.filter(i=>ds[i]>7&&dp[i]>7&&!prot.has(i));
  if(seeds.length<10){waterG=null;return;}
  for(const frac of[0.13,0.09,0.06]){
    const target=Math.max(12,Math.floor(land.length*frac));
    const inLake=new Set();
    const q=[seeds[(Math.random()*seeds.length)|0]];
    inLake.add(q[0]);
    while(q.length&&inLake.size<target){
      const c=q.splice((Math.random()*q.length)|0,1)[0];
      const x=c%MW,y=(c/MW)|0;
      for(let k=0;k<4;k++){
        const nx=x+DX[k],ny=y+DY[k];
        if(nx<1||ny<1||nx>=MW-1||ny>=MH-1)continue;
        const ni=ny*MW+nx;
        if(grid[ni]||prot.has(ni)||inLake.has(ni))continue;
        inLake.add(ni);q.push(ni);
      }
    }
    if(inLake.size<8)continue;
    for(const i of inLake)waterG[i]=1;
    if(connectedLand(spawnI,portI)&&countLand()>=150){
      for(const i of inLake){
        const x=i%MW,y=(i/MW)|0;
        for(let k=0;k<4;k++){
          const nx=x+DX[k],ny=y+DY[k];
          if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
          const ni=ny*MW+nx;
          if(!grid[ni]&&!waterG[ni]&&wetG&&Math.random()<0.92)wetG[ni]=1;
        }
      }
      recountTotalFloor();
      return;
    }
    for(const i of inLake)waterG[i]=0;
  }
  waterG=null;
}
function waterNearby(){
  if(!waterG)return false;
  const cx=px|0,cy=py|0;
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    const gx=cx+dx,gy=cy+dy;
    if(gx<0||gy<0||gx>=MW||gy>=MH)continue;
    if(waterG[gy*MW+gx])return true;
  }
  return false;
}

/* ---------- 폴백 & 생성 함수 ---------- */
function fallbackMaze(){
  const cells=new Uint8Array(MW*MH).fill(1);
  const st=[[1,1]];cells[MW+1]=0;
  while(st.length){
    const[cx,cy]=st[st.length-1];
    const dirs=[[2,0],[-2,0],[0,2],[0,-2]].sort(()=>Math.random()-.5);
    let moved=false;
    for(const[dx,dy]of dirs){
      const nx=cx+dx,ny=cy+dy;
      if(nx>0&&ny>0&&nx<MW-1&&ny<MH-1&&cells[ny*MW+nx]===1){
        cells[(cy+dy/2)*MW+cx+dx/2]=0;cells[ny*MW+nx]=0;
        st.push([nx,ny]);moved=true;break;
      }
    }
    if(!moved)st.pop();
  }
  for(let y=1;y<MH-1;y++)for(let x=1;x<MW-1;x++){
    if(cells[y*MW+x]!==1)continue;
    const h=!cells[y*MW+x-1]&&!cells[y*MW+x+1];
    const v=!cells[(y-1)*MW+x]&&!cells[(y+1)*MW+x];
    if((h^v)&&Math.random()<0.13)cells[y*MW+x]=0;
  }
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)
    if(x===0||y===0||x===MW-1||y===MH-1)cells[y*MW+x]=1;
  finalizeGrid(cells);
}
function genMazeSync(){
  for(let a=0;a<80;a++){
    const s=new Solver();seedAnchors(s);
    let r;while((r=s.step())==='ok'){}
    if(r==='done'){
      const cells=new Uint8Array(MW*MH);
      for(let i=0;i<MW*MH;i++)cells[i]=s.val[i]===0?1:0;
      finalizeGrid(cells);
      if(placeEntities())return true;
    }
  }
  fallbackMaze();placeEntities();return true;
}
function genCaveSync(){
  const P=CA_PRESETS[caKey];
  const b=buildCave(P);
  if(b)finalizeGrid(b.final);
  else fallbackMaze();
  if(placeEntities())genLake();
  return true;
}
function genMapSync(){return dmode==='cave'?genCaveSync():genMazeSync();}

/* ============================================================
   게임 상태
   ============================================================ */
let px=1.5,py=1.5,ang=0,bobPhase=0,bobAmt=0,lastStepPh=0;
let gotCount=0,walkCount=0,lastWalkCell='',gameState='title',playTime=0,clearTime=0;
let msgQueue=[],resultBanner=null;
const keys=new Set();

let showCtl=matchMedia('(pointer:coarse)').matches;   // sndOn은 engine-core 소유
function setSens(v){
  sensMul=clampN(v,0.5,2);
  MOVE_SPD=BASE_MOVE*(0.85+0.15*sensMul);
  ROT_SPD=BASE_ROT*sensMul;
  LOOK_SENS=0.0052*sensMul;
  const el=document.getElementById('sensV');
  if(el)el.textContent=Math.round(sensMul*100)+'%';
}

/* ============================================================
   🤖 Frontier-Based Exploration AI
   ============================================================ */
const AI={
  known:null,knownFloor:0,path:[],tgtType:'',state:'explore',
  clock:0,refX:0,refY:0,stuckT:0,replans:0,trail:[],trailLast:{x:0,y:0},
};
const ALIGN=0.25,WP_REACH=0.34,STUCK_TIME=1.4,STUCK_DIST=0.22;
let aiActive=false,lastAiCellX=-1,lastAiCellY=-1,lastTickSnd=0;

function aiReset(){
  AI.known=new Uint8Array(MW*MH);
  AI.knownFloor=0;AI.path=[];AI.tgtType='';
  AI.state='explore';AI.clock=0;AI.stuckT=0;AI.replans=0;
  AI.trail=[];AI.trailLast={x:px,y:py};
  AI.refX=px;AI.refY=py;
}
const solidAt=(x,y)=>{
  x|=0;y|=0;
  if(x<0||y<0||x>=MW||y>=MH)return true;
  const i=y*MW+x;
  return grid[i]===1||(waterG&&waterG[i]===1);
};
function moveWithCollision(vx,vy){
  const free=(x,y)=>!(solidAt(x-COLL_R,y-COLL_R)||solidAt(x+COLL_R,y-COLL_R)||solidAt(x-COLL_R,y+COLL_R)||solidAt(x+COLL_R,y+COLL_R));
  if(free(px+vx,py))px+=vx;
  if(free(px,py+vy))py+=vy;
}
function aiSense(){
  const cx=px|0,cy=py|0;
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
    if(dx*dx+dy*dy>8)continue;
    const gx=cx+dx,gy=cy+dy;
    if(gx<0||gy<0||gx>=MW||gy>=MH)continue;
    const i=gx+gy*MW;
    if(AI.known[i]===0){
      if(grid[i])AI.known[i]=2;
      else if(waterG&&waterG[i])AI.known[i]=3;
      else{AI.known[i]=1;AI.knownFloor++;}
    }
  }
}
function bfsKnown(start,goalTest){
  const prev=new Int32Array(MW*MH).fill(-2);
  const q=[start];prev[start]=-1;
  let goal=-1;
  while(q.length){
    const c=q.shift();
    if(goalTest(c)){goal=c;break;}
    const x=c%MW,y=(c/MW)|0;
    for(let k=0;k<4;k++){
      const nx=x+DX[k],ny=y+DY[k];
      if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
      const ni=ny*MW+nx;
      if(AI.known[ni]===1&&prev[ni]===-2){prev[ni]=c;q.push(ni);}
    }
  }
  if(goal<0)return null;
  const p=[];let c=goal;
  while(c!==start){p.push(c);c=prev[c];}
  p.reverse();
  return p.map(i=>({x:(i%MW)+.5,y:((i/MW)|0)+.5}));
}
const hasGemAt=i=>gems.some(gm=>!gm.got&&((gm.x|0)+(gm.y|0)*MW)===i);
const isFrontier=i=>{
  if(AI.known[i]!==1)return false;
  const x=i%MW,y=(i/MW)|0;
  for(let k=0;k<4;k++){
    const nx=x+DX[k],ny=y+DY[k];
    if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
    if(AI.known[nx+ny*MW]===0)return true;
  }
  return false;
};
function losClear(x0,y0,x1,y1){
  const d=Math.hypot(x1-x0,y1-y0),n=Math.ceil(d/0.08);
  for(let i=1;i<n;i++){
    const t=i/n,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t;
    if(solidAt(x-COLL_R,y-COLL_R)||solidAt(x+COLL_R,y-COLL_R)||solidAt(x-COLL_R,y+COLL_R)||solidAt(x+COLL_R,y+COLL_R))
      return false;
  }
  return true;
}
function aiDecide(){
  const start=(py|0)*MW+(px|0);
  if(AI.state==='explore'||AI.state==='collect'){
    const gp=bfsKnown(start,hasGemAt);
    const fp=AI.state==='explore'?bfsKnown(start,isFrontier):null;
    if(gp&&(AI.state==='collect'||!fp||gp.length<fp.length)){AI.path=gp;AI.tgtType='G';return;}
    if(fp){AI.path=fp;AI.tgtType='F';return;}
    AI.state=gems.some(g=>!g.got)?'collect':'exit';
  }
  if(AI.state==='collect'){
    const gp=bfsKnown(start,hasGemAt);
    if(gp){AI.path=gp;AI.tgtType='G';return;}
    AI.state='exit';
  }
  if(AI.state==='exit'){
    const pi=(portal.y|0)*MW+(portal.x|0);
    const pp=bfsKnown(start,i=>i===pi);
    if(pp){AI.path=pp;AI.tgtType='P';return;}
    AI.state='explore';
  }
}
function aiUpdate(dt,silent){
  AI.clock+=dt;
  aiSense();
  if(AI.path.length){
    if(AI.tgtType==='P'&&gotCount<GEM_TOTAL)AI.path=[];
    if(AI.tgtType==='G'&&AI.path.length){
      const w=AI.path[AI.path.length-1];
      if(!hasGemAt((w.y|0)*MW+(w.x|0)))AI.path=[];
    }
  }
  if(!AI.path.length){
    aiDecide();
    if(!AI.path.length)return;
    AI.refX=px;AI.refY=py;AI.stuckT=0;
  }
  let wp=AI.path[0];
  while(wp&&Math.hypot(wp.x-px,wp.y-py)<WP_REACH){AI.path.shift();wp=AI.path[0];}
  if(!wp)return;
  while(AI.path.length>=2&&losClear(px,py,AI.path[1].x,AI.path[1].y))AI.path.shift();
  wp=AI.path[0];
  const want=Math.atan2(wp.y-py,wp.x-px);
  const diff=normAng(want-ang);
  ang+=clampN(diff,-ROT_SPD*dt,ROT_SPD*dt);
  const ad=Math.abs(diff);
  const sp=ad<ALIGN?MOVE_SPD:(ad<0.75?MOVE_SPD*0.5:0);
  let moved=false;
  if(sp>0){
    const ox=px,oy=py;
    moveWithCollision(Math.cos(ang)*sp*dt,Math.sin(ang)*sp*dt);
    moved=Math.hypot(px-ox,py-oy)>1e-5;
  }
  if(Math.hypot(px-AI.trailLast.x,py-AI.trailLast.y)>0.28){
    AI.trail.push({x:px,y:py});
    if(AI.trail.length>3200)AI.trail.shift();
    AI.trailLast={x:px,y:py};
  }
  if(moved){
    const d=Math.hypot(px-AI.refX,py-AI.refY);
    if(d>STUCK_DIST){AI.refX=px;AI.refY=py;AI.stuckT=0;}
    else{
      AI.stuckT+=dt;
      if(AI.stuckT>STUCK_TIME){
        AI.path=[];AI.stuckT=0;AI.replans++;
        ang+=(Math.random()-0.5)*1.6;
        if(AI.replans>8){aiActive=false;pushMsg('🤖 AI 포기 — 수동 전환');refreshAIBtns();}
      }
    }
  }
  if(!silent&&moved){
    const cx=px|0,cy=py|0;
    if(cx!==lastAiCellX||cy!==lastAiCellY){
      lastAiCellX=cx;lastAiCellY=cy;
      const n=performance.now();
      if(n-lastTickSnd>140){lastTickSnd=n;beep(240,.03,'square',.02);}
    }
  }
}
const aiPhaseLabel=()=>gameState==='demoEnd'?'✔ 완료':
  AI.state==='explore'?'🔍 탐색':AI.state==='collect'?'💎 수집':'🚪 탈출';

/* ============================================================
   🚶 만남 투어 (gameState:'tour') — PixelCodex 연동
   ============================================================ */
const TOUR_APPEAR=340,TOUR_LEAVE=360,CODEX_TEX_MAX=40;
let TOUR=null,tourSpeed=1;
const CODEX_TEX={};
const tourDelay=ms=>ms/tourSpeed;
function setTourSpeed(v){
  tourSpeed=v;
  const el=document.getElementById('tourSpeedToggle');
  if(el){el.textContent='x'+v;el.classList.add('on');}
}
function cycleTourSpeed(){
  setTourSpeed(tourSpeed===1?2:tourSpeed===2?4:1);
  beep(520+tourSpeed*80,.05,'triangle',.06);
}

function codexReady(){
  if(typeof window.PixelCodex==='undefined'||typeof PixelCodex.getEntity!=='function')return false;
  if(PixelCodex.getEntity(1))return true;
  try{
    PixelCodex.init(document.querySelector('.pdcx'));
    PixelCodex.setMode('off');
  }catch(e){}
  return PixelCodex.getEntity(1)!==null;
}

function stripBorderDark(base,w,h){
  const seen=new Uint8Array(w*h),q=[];
  const dark=i=>{
    const v=base[i],a=v>>>24,r=v&255,g=(v>>>8)&255,b=(v>>>16)&255;
    return a>80&&r<42&&g<42&&b<48;
  };
  const push=i=>{if(i>=0&&i<seen.length&&!seen[i]&&dark(i)){seen[i]=1;q.push(i);}};
  for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}
  for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
  for(let qi=0;qi<q.length;qi++){
    const i=q[qi],x=i%w,y=(i/w)|0;
    if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);
  }
  return seen;
}

function codexTex(id){
  /* ⚠ texFromImage 사용 금지(알파 255 강제) — 알파 채널 보존 변환 */
  if(CODEX_TEX[id])return CODEX_TEX[id];
  if(!codexReady())return null;
  const src=PixelCodex.getFrames(id);
  if(!src)return null;
  const out=[];
  for(const c of src){
    const w=c.width,h=c.height,n=w*h;
    const base=new Uint32Array(c.getContext('2d').getImageData(0,0,w,h).data.buffer);
    const levels=[];
    const clearBg=stripBorderDark(base,w,h);
    for(let l=0;l<16;l++){
      const f=l/15,arr=new Uint32Array(n);
      for(let i=0;i<n;i++){
        const v=base[i];
        if(clearBg[i]){arr[i]=0;continue;}
        arr[i]=pack(((v&255)*f)|0,(((v>>>8)&255)*f)|0,(((v>>>16)&255)*f)|0,v>>>24);
      }
      levels.push(arr);
    }
    out.push({levels,tw:w,th:h});
  }
  const ks=Object.keys(CODEX_TEX);
  if(ks.length>=CODEX_TEX_MAX)delete CODEX_TEX[ks[0]];
  CODEX_TEX[id]=out;
  return out;
}

/* ---------- 만남 대상 선정 (현재 던전 한정) ---------- */
const ENC_FROM_DUNGEON=true;   // false로 끄면 전체 풀
function pickTourId(){
  const D=window.PixelCodex.DATA,r=Math.random();
  const inScope=m=>!ENC_FROM_DUNGEON||!curDun||m.d===curDun;
  if(r<0.24)return D.jobs[(Math.random()*D.jobs.length)|0].id;   // 용사는 전역 풀
  if(r<0.31){                                                    // 보스
    let p=D.monsters.filter(m=>inScope(m)&&m.dep==='BOSS');
    if(!p.length)p=D.monsters.filter(m=>m.dep==='BOSS');
    return p[(Math.random()*p.length)|0].id;
  }
  let p=D.monsters.filter(m=>inScope(m)&&m.dep!=='BOSS');        // 일반 몬스터
  if(!p.length)p=D.monsters.filter(m=>m.dep!=='BOSS');
  return p[(Math.random()*p.length)|0].id;
}

/* ============================================================
   🎲 사건 선택 이벤트 (만남 트리거의 30%) — 서사형 선택지
   ============================================================ */
const TOUR_EVENTS=[
{icon:'🕯️',title:'꺼지지 않는 초',
 desc:'복도 끝에 세 개의 초가 꽂혀 있다. 가운데 초만 이상하게 꺼지지 않는다.',
 choices:[
  {label:'💨 입으로 불어본다',result:'초가 꺼졌다가 스스로 다시 타오른다. 벽의 그림자가 하나 늘어난 기분이 들지만 눈을 감고 지나쳤다.'},
  {label:'🕯️ 초를 주워 담는다',result:'손에 넣은 순간 심장이 한층 따뜻해진다. 심연에서도 불은 반가운 법이다.'},
  {label:'무시하고 지나간다',result:'등 뒤에서 초가 하나씩 저절로 꺼졌다. 걸음을 서둘렀다.'}]},
{icon:'⛲',title:'말라붙은 분수',
 desc:'바닥에 동전 같은 것이 반짝이는 마른 분수. 벽면 각인: "소원은 깊이만큼".',
 choices:[
  {label:'🪙 동전을 던진다',result:'동전이 바닥에 닿기 전에 어딘가로 굴러 사라졌다. 소원이 전달된 걸까?'},
  {label:'🖐️ 바닥 동전을 줍는다',result:'낡은 동전 몇 닢을 챙겼다. 분수 입이 약간 씁쓸해 보인다.'},
  {label:'💧 손을 씻는다',result:'신기하게 시원한 물기가 남는다. 피로가 조금 가신다.'}]},
{icon:'📜',title:'찢어진 일지',
 desc:'모험가의 유해 옆에 반쯤 탄 일지가 있다. 마지막 문장: "보물은 거짓, 출구는 진실—" 여기서 끊겼다.',
 choices:[
  {label:'📖 끝까지 읽으려 한다',result:'남은 장이 그을려 읽을 수 없었다. 다만 "돌아가라"는 단어만 또렷했다.'},
  {label:'⚰️ 유해를 묻어준다',result:'겸손한 무덤을 만들자 복도의 공기가 한결 부드러워진다. 좋은 짓은 배신당하지 않는 법.'},
  {label:'🗺️ 낡은 지도를 챙긴다',result:'첫 페이지의 낙서 지도를 뗐다. 유용할지도, 저주일지도.'}]},
{icon:'🧪',title:'의문의 물약',
 desc:'석상의 손 위에 에메랄드 물약이 놓여 있다. 라벨: "마시지 마시오 — 관리자".',
 choices:[
  {label:'🥤 원샷한다',result:'입안이 얼얼… 하지만 온몸이 화창해진다. 관리자, 미안합니다.'},
  {label:'🎒 가방에 넣는다',result:'나중에 필요할 게다. 석상의 눈이 조금 따라온 것 같기도 하다.'},
  {label:'🚫 그대로 둔다',result:'경고는 존중하는 편이 좋다. 고개를 끄덕이니 석상도 끄덕여준 것 같았다.'}]},
{icon:'💀',title:'갑주 무더기',
 desc:'녹슨 갑주 수십 벌이 무너져 있다. 하나는 헬멧 안에서 아직 뭔가 웅크리고 있다.',
 choices:[
  {label:'👋 두드려 본다',result:'헬멧 안에서 "…비켜"라는 목소리. 알겠습니다, 알겠어요.'},
  {label:'⚔️ 상태 좋은 갑주를 챙긴다',result:'녹슬지 않은 왼팔 장갑 한 짝. 용도는 나중에 생각하기로 했다.'},
  {label:'조용히 지나간다',result:'웅크린 실루엣이 곤란한 듯 어깨를 움츠리는 게 보였다. 지혜는 때로 침묵이다.'}]},
{icon:'🐀',title:'쥐들의 행렬',
 desc:'수십 마리의 쥐가 등에 작은 촛불을 이고 한 줄로 행진한다. 완벽한 질서다.',
 choices:[
  {label:'🛕 길을 비켜준다',result:'선두 쥐가 잠깐 멈춰 고개를 끄덕인다. 묘하게 뿌듯한 기분이다.'},
  {label:'🔥 촛불을 관찰한다',result:'그 불은 차갑다. 심연의 생태는 여전히 미스터리다.'},
  {label:'👟 발로 건든다',result:'행렬이 순식간에 흩어지고 촛불이 전부 꺼졌다. 사과하고 싶어지는 복도가 되었다.'}]},
{icon:'🎻',title:'멈춘 오르골',
 desc:'돌 받침 위 오르골이 한 음 직전에서 멈춰 있다. 태엽은 아직 남아 있다.',
 choices:[
  {label:'🎵 태엽을 돌린다',result:'경쾌한 왈츠가 복도에 울려 퍼진다. 어디선가 발소리가 춤추는 것 같다.'},
  {label:'🔧 뚜껑을 연다',result:'내부는 정교한 기어의 미로. 조심스레 닫으니 노래는 계속되었다.'},
  {label:'🎧 소리 없이 지나친다',result:'멀어지는 등 뒤에서 홀로 한 음, 딱. 인사였을까.'}]},
{icon:'🚪',title:'잠긴 철문',
 desc:'굵은 사슬이 걸린 철문 너머에서 보석 같은 빛이 새어 나온다.',
 choices:[
  {label:'🔨 사슬을 건드린다',result:'사슬이 스르륵 풀리더니 다시 굳는다. 아직 때가 아닌 모양이다.'},
  {label:'👁️ 틈새를 들여다본다',result:'빛은 사실 반딧불 떼였다. 보물이라기엔 너무 아름다웠다.'},
  {label:'↩️ 조용히 돌아선다',result:'문 너머에서 작은 탕 소리. 뭔가가 문을 잠근 것 같다. 현명한 선택이었을지도.'}]},
];

/* ---------- 자동 보행 ---------- */
function tourPlan(){
  const start=(py|0)*MW+(px|0);
  const prev=new Int32Array(MW*MH).fill(-2);
  const dist=new Int16Array(MW*MH).fill(-1);
  const q=[start];prev[start]=-1;dist[start]=0;
  for(let h=0;h<q.length;h++){
    const c=q[h],x=c%MW,y=(c/MW)|0;
    for(let k=0;k<4;k++){
      const nx=x+DX[k],ny=y+DY[k];
      if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
      const ni=ny*MW+nx;
      if(prev[ni]!==-2||!landPass(ni))continue;
      prev[ni]=c;dist[ni]=dist[c]+1;q.push(ni);
    }
  }
  let goal=-1,bestD=-1;
  for(let i=0;i<MW*MH;i++)if(dist[i]>bestD){bestD=dist[i];goal=i;}
  if(bestD>14){
    const cand=[];
    for(let i=0;i<MW*MH;i++)if(dist[i]>14)cand.push(i);
    goal=cand[(Math.random()*cand.length)|0];
  }
  const path=[];let c=goal;
  while(c!==start&&c>=0){path.push({x:(c%MW)+.5,y:((c/MW)|0)+.5});c=prev[c];}
  path.reverse();
  TOUR.path=path;
  if(!path.length)TOUR.nextEncAt=Math.min(TOUR.nextEncAt,performance.now()+tourDelay(800));
}

function collectNearbyGems(){
  let collected=0;
  for(const gm of gems){
    if(gm.got)continue;
    if((px-gm.x)**2+(py-gm.y)**2<0.42*0.42){
      gm.got=true;gotCount++;collected++;sndPickup();vib(20);
      const line=`보석 발견 ${gotCount}`;
      pushMsg(`💎 ${line}`);
      if(TOUR?.result)TOUR.result.logs.push(line);
      if(gotCount===GEM_TOTAL){pushMsg('✨ 모든 보석을 발견했다');sndWin();vib([30,40,30]);}
    }
  }
  return collected;
}

function markWalkCell(){
  const cell=`${px|0},${py|0}`;
  if(cell===lastWalkCell)return false;
  lastWalkCell=cell;walkCount++;
  if(TOUR&&TOUR.maxSteps&&walkCount>=TOUR.maxSteps&&!TOUR.ending){
    TOUR.ending=true;
    TOUR.result.steps=walkCount;
    TOUR.result.logs.push(`${walkCount}걸음 도달. 순찰을 마치고 귀환했다.`);
    showResultBanner('순찰 완료', `${walkCount}/${TOUR.maxSteps}걸음`, 'ok');
    setTimeout(()=>endTour(),900);
  }
  return true;
}
function tourWalk(dt){
  if(!TOUR.path.length){tourPlan();return;}
  let wp=TOUR.path[0];
  while(wp&&Math.hypot(wp.x-px,wp.y-py)<WP_REACH){TOUR.path.shift();wp=TOUR.path[0];}
  if(!wp){tourPlan();return;}
  const want=Math.atan2(wp.y-py,wp.x-px);
  const diff=normAng(want-ang);
  ang+=clampN(diff,-ROT_SPD*dt,ROT_SPD*dt);
  const ad=Math.abs(diff);
  const sp=ad<ALIGN?MOVE_SPD*0.85:(ad<0.75?MOVE_SPD*0.45:0);
  if(sp>0){
    const ox=px,oy=py;
    moveWithCollision(Math.cos(ang)*sp*dt,Math.sin(ang)*sp*dt);
    if(Math.hypot(px-ox,py-oy)>1e-5){
      bobPhase+=dt*9.5;bobAmt=Math.min(1,bobAmt+dt*6);
      if(((bobPhase/Math.PI)|0)!==((lastStepPh/Math.PI)|0))sndStep();
      lastStepPh=bobPhase;
      markWalkCell();
      collectNearbyGems();
    }else bobAmt=Math.max(0,bobAmt-dt*6);
  }else bobAmt=Math.max(0,bobAmt-dt*6);
  const cx=px|0,cy=py|0;
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)
    if(dx*dx+dy*dy<=8){
      const gx=cx+dx,gy=cy+dy;
      if(gx>=0&&gy>=0&&gx<MW&&gy<MH)visited[gx+gy*MW]=1;
    }
}

/* ---------- 만남 판정 & 생성 ---------- */
function openAt(x,y,r=0.32){
  const pts=[[0,0],[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,r],[r,-r],[-r,-r]];
  for(const pt of pts){
    const gx=(x+pt[0])|0,gy=(y+pt[1])|0;
    if(gx<=0||gy<=0||gx>=MW-1||gy>=MH-1||!landPass(gy*MW+gx))return false;
  }
  return true;
}
function findTourSpot(dx,dy,maxD){
  const far=Math.min(3.15,Math.max(1.9,maxD-0.35));
  for(let d=far;d>=1.75;d-=0.18){
    const ex=px+dx*d,ey=py+dy*d;
    if(openAt(ex,ey)&&losClear(px,py,ex,ey))return {x:ex,y:ey};
  }
  return null;
}
function tourTryEncounter(now){
  const dx=Math.cos(ang),dy=Math.sin(ang);
  for(let d=1.5;d<=4.001;d+=0.25){
    const cx=(px+dx*d)|0,cy=(py+dy*d)|0;
    if(cx<=0||cy<=0||cx>=MW-1||cy>=MH-1)break;
    if(!landPass(cy*MW+cx))break;
    if(d<1.7)continue;
    const spot=findTourSpot(dx,dy,d);
    if(spot)return tourSpawn(spot.x,spot.y,now);
  }
  return false;
}
function tourSpawn(ex,ey,now){
  const id=pickTourId(),ent=PixelCodex.getEntity(id),tex=codexTex(id);
  if(!ent||!tex)return false;
  const boss=ent.dep==='BOSS';
  const hold=boss?5200:3800+RND(0,1400);
  const isHero=!!ent.role,dun=curDun||1;
  const foeHp=isHero?20+dun*8:Math.max(28,ent.hp||50),foeAtk=isHero?2+dun*2:Math.max(4,ent.at||8);
  TOUR.enc={kind:boss?'boss':(ent.role?'hero':'monster'),
    ent,id,x:ex,y:ey,tex,cvs:PixelCodex.getFrames(id),
    t0:now,phase:0,frame:(Math.random()*4)|0,frameT:0,hold,
    bossHp:TOUR.result?.hp ?? TOUR.bossHp,bossMax:TOUR.bossMax,bossLag:1,bossAtk:TOUR.bossAtk,bossDef:TOUR.bossDef,bossHurt:0,
    foeHp,foeMax:foeHp,foeLag:1,foeAtk,foeHurt:0,hitT:0,turn:'boss',turnWait:0,
    baseHW:boss?0.78:0.46,total:TOUR_APPEAR+hold+TOUR_LEAVE};
  ang=Math.atan2(ey-py,ex-px);
  TOUR.path=[];TOUR.count++;
  if(boss){sndLocked();beep(92,.5,'sawtooth',.09,58);pushMsg(`💀 필드보스 — ${ent.n}!!`);}
  else if(ent.role){sndPickup();pushMsg(`⚠ 용사 ${ent.n} 출현`);}
  else{beep(430,.08,'triangle',.05);beep(760,.08,'triangle',.04,980,.08);
       pushMsg(`🤝 떠돌이 ${ent.n}(을)를 만났다`);}
  vib(boss?[40,60,40]:18);
  return true;
}
function tourFinishEncounter(now){
  const e=TOUR&&TOUR.enc;if(!e)return;
  pushMsg(e.kind==='hero'?'🚶 전투를 마치고 다시 걷는다':e.kind==='monster'?'🤝 회유를 마치고 다시 걷는다':'🚶 숨을 고르고 다시 길을 나선다');
  TOUR.enc=null;
  TOUR.nextEncAt=now+tourDelay(5200+RND(0,4300));
  tourPlan();
}
function tourUpdate(dt,now){
  if(TOUR.ev)return;
  if(TOUR.enc){
    const e=TOUR.enc,t=(now-e.t0)*tourSpeed;
    e.frameT+=dt*1000*tourSpeed;
    while(e.frameT>=150){e.frameT-=150;e.frame=(e.frame+1)&3;}
    e.bossLag=Math.max(e.bossHp/e.bossMax, e.bossLag+(e.bossHp/e.bossMax-e.bossLag)*0.08);
    e.foeLag=Math.max(e.foeHp/e.foeMax, e.foeLag+(e.foeHp/e.foeMax-e.foeLag)*0.08);
    e.bossHurt=Math.max(0,e.bossHurt-dt*tourSpeed);
    e.foeHurt=Math.max(0,e.foeHurt-dt*tourSpeed);
    if(e.phase===0&&t>=TOUR_APPEAR)e.phase=1;
    if(e.phase===1&&!e.resolved){
      if(e.kind==='monster'){
        if(!e.awaitingChoice&&!e.choiceDone)tourOpenRecruitChoice(e);
        return;
      }else if(e.kind==='boss'){
        if(!e.awaitingChoice&&!e.choiceDone)tourOpenBossChoice(e);
        return;
      }else{
        if(!e.awaitingChoice&&!e.choiceDone){tourOpenHeroChoice(e);return;}
        if(e.awaitingChoice)return;
        e.turnWait=Math.max(0,(e.turnWait||0)-dt*tourSpeed);
        if(e.turnWait>0)return;
        e.hitT+=dt*tourSpeed;
        if(e.hitT>=0.75){
          e.hitT=0;e.foeLag=Math.max(e.foeLag,e.foeHp/e.foeMax);e.bossLag=Math.max(e.bossLag,e.bossHp/e.bossMax);
          if((e.turn||'boss')==='boss'){
            e.foeHp=Math.max(0,e.foeHp-e.bossAtk);
            e.foeHurt=0.24;vib(12);beep(180,.04,'square',.035);
            if(e.foeHp<=0){
              e.resolved=true;
              TOUR.result.soul+=20;TOUR.result.notoriety+=10;TOUR.result.exp+=20;
              TOUR.result.logs.push(`${e.ent.n} 격퇴 / Soul +20 / 악명 +10 / EXP +20`);
              showResultBanner('전투 승리', `Soul +20 / 악명 +10 / EXP +20`, 'win');
              e.phase=2;e.tOut=now;
              return;
            }
            e.turn='hero';e.turnWait=0.45;
            return;
          }
          e.bossHp=Math.max(0,e.bossHp-Math.max(1,e.foeAtk-(e.bossDef||0)));
          e.bossHurt=0.24;TOUR.result.hp=e.bossHp;TOUR.bossHp=e.bossHp;vib(10);beep(120,.04,'square',.03);
          if(e.bossHp<=0){
            e.resolved=true;TOUR.result.hp=0;
            TOUR.result.logs.push(`${e.ent.n}와의 전투에서 ${TOUR.bossName||'순찰자'}이 기절했다.`);
            showResultBanner('기절', `${TOUR.bossName||'순찰자'} 강제 귀환`, 'fail');
            pushMsg(`${TOUR.bossName||'순찰자'}이 기절했다. 강제 귀환한다.`);
            TOUR.ending=true;setTimeout(()=>endTour(),1200);return;
          }
          e.turn='boss';e.turnWait=0.45;
        }
      }
    }
    else if(e.phase===2&&now-e.tOut>=tourDelay(TOUR_LEAVE))tourFinishEncounter(now);
    return;
  }
  tourWalk(dt*tourSpeed);
  if(now>=TOUR.nextEncAt){
    if(!tourTryEncounter(now))
      TOUR.nextEncAt=now+tourDelay(1200);
  }
}

function tourChoice(title, desc, choices){
  TOUR.ev={choice:true};
  document.getElementById('cmdTitle').textContent=title;
  document.getElementById('cmdDesc').textContent=desc;
  const box=document.getElementById('cmdButtons');
  box.innerHTML='';
  choices.forEach(ch=>{
    const btn=document.createElement('button');
    btn.className='cmdBtn '+(ch.kind||'gray');
    btn.textContent=ch.label;
    btn.onclick=ch.fn;
    box.appendChild(btn);
  });
  document.getElementById('cmdPanel').classList.remove('hidden');
}
function closeTourChoice(){
  TOUR.ev=null;
  const p=document.getElementById('cmdPanel');if(p)p.classList.add('hidden');
}
function tourOpenRecruitChoice(e){
  e.awaitingChoice=true;
  tourChoice('몬스터 발견', `${e.ent.n}을(를) 발견했다.`, [
    {label:'영입',kind:'green',fn:()=>tourOpenRecruitMethod(e)},
    {label:'지나침',kind:'gray',fn:()=>{TOUR.result.logs.push(`${e.ent.n}을(를) 지나쳤다.`);finishTourChoiceEncounter(e,`🚶 ${e.ent.n}을(를) 지나쳤다`);}}
  ]);
}
function tourOpenRecruitMethod(e){
  tourChoice('영입 방식', `${e.ent.n}에게 어떻게 제안할까?`, [
    {label:'힘으로 제압',kind:'red',fn:()=>resolveTourRecruit(e,'force')},
    {label:'먹을 것 주기',kind:'gold',fn:()=>resolveTourRecruit(e,'soul')},
    {label:'취소',kind:'gray',fn:()=>{TOUR.result.logs.push(`${e.ent.n} 영입을 포기했다.`);finishTourChoiceEncounter(e,`🚶 ${e.ent.n} 영입을 포기했다`);}}
  ]);
}
function resolveTourRecruit(e,method){
  const great=Math.random()<0.12, success=great||Math.random()<(method==='soul'?0.7:0.55);
  if(method==='force'){TOUR.result.hp=Math.max(1,(TOUR.result.hp||90)-1);TOUR.bossHp=TOUR.result.hp;}
  else TOUR.result.soul-=1;
  TOUR.result.exp+=success?(great?14:8):3;
  if(success)TOUR.result.households+=great?2:1;
  const line=`${e.ent.n} ${great?'영입 대성공':success?'영입 성공':'영입 실패'}`;
  TOUR.result.logs.push(line);
  showResultBanner(great?'영입 대성공!':success?'영입 성공':'영입 실패', e.ent.n, success?'ok':'fail');
  finishTourChoiceEncounter(e,`🤝 ${line}`);
}

function tourOpenBossChoice(e){
  e.awaitingChoice=true;
  tourChoice('필드보스 대면', `${e.ent.n}와 힘을 겨룬다.`, [
    {label:'복종시킨다',kind:'red',fn:()=>resolveTourBossRecruit(e)},
    {label:'지나간다',kind:'gray',fn:()=>{TOUR.result.logs.push(`${e.ent.n}을(를) 지나쳤다.`);finishTourChoiceEncounter(e,`🚶 ${e.ent.n}을(를) 지나쳤다`);}}
  ]);
}
function resolveTourBossRecruit(e){
  const bossPower=(TOUR.bossAtk||18)*3+(TOUR.bossMax||80)*0.45+(TOUR.bossDef||0)*2;
  const targetPower=(e.ent.at||18)*3+(e.ent.hp||80)*0.45+(e.ent.df||0)*2;
  const chance=Math.max(0.18,Math.min(0.82,0.45+(bossPower-targetPower)/180));
  const success=Math.random()<chance;
  TOUR.result.exp+=success?24:10;
  if(success){
    TOUR.result.bossRecruit={id:e.ent.id,name:e.ent.n};
    TOUR.result.logs.push(`${e.ent.n} 힘겨루기 승리 / 필드보스 영입 / EXP +24`);
    showResultBanner('복종 성공', `${e.ent.n} 영입`, 'win');
    finishTourChoiceEncounter(e,`👑 ${e.ent.n}이(가) 복종했다`);
  }else{
    TOUR.result.hp=Math.max(1,(TOUR.result.hp||TOUR.bossHp||80)-8);TOUR.bossHp=TOUR.result.hp;
    TOUR.result.logs.push(`${e.ent.n} 힘겨루기 실패 / HP -8 / EXP +10`);
    showResultBanner('복종 실패', `HP -8 / EXP +10`, 'fail');
    finishTourChoiceEncounter(e,`💥 ${e.ent.n}이(가) 버텼다`);
  }
}

function tourOpenHeroChoice(e){
  e.awaitingChoice=true;
  tourChoice('용사 출현', `${e.ent.n}가 모습을 드러냈다.`, [
    {label:'싸움',kind:'red',fn:()=>{closeTourChoice();e.awaitingChoice=false;e.choiceDone=true;pushMsg(`⚔ ${e.ent.n}와 전투 시작`);}},
    {label:'도망',kind:'gray',fn:()=>{
      if(Math.random()<0.68){TOUR.result.logs.push(`${e.ent.n}에게서 도망쳤다.`);finishTourChoiceEncounter(e,`🏃 ${e.ent.n}에게서 도망쳤다`);}
      else{closeTourChoice();e.awaitingChoice=false;e.choiceDone=true;pushMsg(`⚔ 도망 실패 — ${e.ent.n}와 전투`);}
    }}
  ]);
}
function finishTourChoiceEncounter(e,msg){
  closeTourChoice();
  e.awaitingChoice=false;e.choiceDone=true;e.phase=2;e.tOut=performance.now();
  pushMsg(msg);
}

/* ---------- 🎲 사건 오버레이(DOM) ---------- */
function tourOpenEvent(){
  const E=TOUR_EVENTS[(Math.random()*TOUR_EVENTS.length)|0];
  TOUR.ev=E;TOUR.path=[];
  document.getElementById('evTitle').textContent=`${E.icon} ${E.title}`;
  document.getElementById('evDesc').textContent=E.desc;
  const box=document.getElementById('evChoices');
  box.innerHTML='';box.classList.remove('hidden');
  const rEl=document.getElementById('evResult');
  rEl.style.display='none';rEl.textContent='';
  document.getElementById('evClose').classList.add('hidden');
  E.choices.forEach(ch=>{
    const btn=document.createElement('button');
    btn.className='mbtn sub';
    btn.style.cssText='width:auto;padding:10px 14px;max-width:none';
    btn.textContent=ch.label;
    btn.onclick=()=>{
      box.classList.add('hidden');
      rEl.textContent=ch.result;rEl.style.display='';
      document.getElementById('evClose').classList.remove('hidden');
      sndPickup();
    };
    box.appendChild(btn);
  });
  document.getElementById('evOv').classList.remove('hidden');
  beep(430,.09,'triangle',.05);
  pushMsg(`${E.icon} 무언가 발견했다…`);
}
function tourCloseEvent(){
  if(!TOUR||!TOUR.ev)return;
  TOUR.ev=null;
  const ov=document.getElementById('evOv');
  if(ov)ov.classList.add('hidden');
  TOUR.nextEncAt=performance.now()+tourDelay(5200+RND(0,4300));
  tourPlan();
  beep(360,.06,'triangle',.05);
}

/* ---------- 진입/종료 ---------- */
function startTour(){
  initAudio();mobileBoot();
  if(!codexReady()){pushMsg('⚠ PixelCodex 초기화 중 — 잠시 후 다시 시도');return;}
  const params = new URLSearchParams(location.search);
  const forcedDungeon = params.get('dungeon');
  const tourBossName = params.get('boss') || '순찰자';
  const tourBossHp = Math.max(0, Number(params.get('hp')) || 90);
  const tourBossMaxHp = Math.max(1, Number(params.get('maxHp')) || tourBossHp || 90);
  const tourBossAtk = Math.max(1, Number(params.get('atk')) || 18);
  const tourBossDef = Math.max(0, Number(params.get('def')) || 0);
  const tourMaxSteps = Math.max(1, Number(params.get('maxSteps')) || 32);
  const prof=nextDungeon(forcedDungeon);          // 보드에서 선택한 순찰 구역 기준
  let ok=false;
  for(let a=0;a<4&&!ok;a++){genMapSync();ok=!!startPos;}
  if(!ok)return;
  px=startPos.x;py=startPos.y;ang=startAng;
  bobPhase=0;bobAmt=0;lastStepPh=0;walkCount=0;lastWalkCell=`${px|0},${py|0}`;msgQueue=[];hideJoy();keys.clear();
  TOUR={path:[],enc:null,ev:null,count:0,maxSteps:tourMaxSteps,bossName:tourBossName,bossHp:tourBossHp,bossMax:tourBossMaxHp,bossAtk:tourBossAtk,bossDef:tourBossDef,nextEncAt:performance.now()+tourDelay(2800+RND(0,2600)),result:{soul:0,notoriety:0,households:0,hp:tourBossHp,steps:0,exp:0,logs:[]}};
  tourPlan();
  gameState='tour';
  document.exitPointerLock?.();
  ['overlay','menuOv','evOv'].forEach(i=>$(i).classList.add('hidden'));
  genCv.classList.add('hidden');
  refreshUI();
  nextDrip=performance.now()+900;nextLap=performance.now()+1600;
  setDrone(true);
  pushMsg(`${prof.icon} ${prof.no}. ${prof.dunName} 순찰 개시`);
  pushMsg(`🚶 생성식: ${prof.genLabel}`);
}
function endTour(){
  if(!TOUR || TOUR.sent)return;
  TOUR.sent=true;
  if(TOUR.result)TOUR.result.steps=walkCount;
  try{ parent && parent !== window && parent.postMessage({type:'pob-tour-complete',result:TOUR&&TOUR.result}, '*'); }catch(e){}
  TOUR=null;setDrone(false);hideJoy();keys.clear();
  const ov=document.getElementById('evOv');if(ov)ov.classList.add('hidden');
  gameState='title';
  $('overlay').classList.remove('hidden');
  refreshUI();beep(300,.07,'triangle',.06);
}

/* ---------- 만남 대화창 ---------- */
function wrapCx(txt,maxW,font){
  ctx.font=font;
  const out=[];let cur='';
  for(const ch of String(txt)){
    if(cur&&ctx.measureText(cur+ch).width>maxW){out.push(cur);cur=ch;}
    else cur+=ch;
  }
  if(cur)out.push(cur);
  return out;
}
function drawEncDialog(now){
  const e=TOUR.enc,ent=e.ent,hero=e.kind==='hero',D=PixelCodex.DATA;
  const ui=Math.min(0.86,Math.max(.56,IH/360));
  const u=v=>Math.round(v*ui);
  const FB=s=>`bold ${u(s)}px monospace`,FN=s=>`${u(s)}px monospace`;
  const pad=u(6);
  const port=Math.round(clampN(IH*0.18,30,46));
  ctx.font=FN(9);
  const colW=Math.min(IW-port-pad*3-8,u(190));
  const tr=wrapCx('📌 '+ent.t,colW,FN(9)).slice(0,2);
  const sk=hero?wrapCx('⚡ '+ent.t2,colW,FN(9)).slice(0,1):[];
  const lh=u(10.5);
  const textH=u(37)+lh*(tr.length+sk.length);
  const w=Math.round(clampN(port+colW+pad*3,150,IW-16));
  const h=Math.min(Math.round(IH*0.28), pad*2+Math.max(port,textH));
  const x0=(IW-w)>>1;
  const y0=IH-h-u(34);

  ctx.fillStyle='rgba(8,10,17,.88)';
  ctx.fillRect(x0,y0,w,h);
  ctx.strokeStyle=e.kind==='boss'?'#ff8a8a':'#ffd76a';ctx.lineWidth=1.5;
  ctx.strokeRect(x0+.5,y0+.5,w-1,h-1);

  ctx.imageSmoothingEnabled=false;
  if(e.cvs&&e.cvs[e.frame])ctx.drawImage(e.cvs[e.frame],x0+pad,y0+pad,port,port);
  ctx.strokeStyle='#3d4a63';ctx.lineWidth=1;
  ctx.strokeRect(x0+pad+.5,y0+pad+.5,port-1,port-1);

  const tx=x0+port+pad*2,ty=y0+pad;
  ctx.textAlign='left';ctx.textBaseline='top';
  ctx.font=FB(10);ctx.fillStyle='#fff0a6';
  ctx.fillText(`${ent.n}${ent.lv?' Lv.'+ent.lv:''}`,tx,ty);
  ctx.font=FN(8.5);
  const badge=hero?ent.cat:ent.el;
  const bw=ctx.measureText(badge).width;
  const bc=hero?(D.CATC[ent.cat]||'#9aa2ad'):(D.ELC[ent.el]||'#9aa2ad');
  ctx.fillStyle=bc;ctx.fillRect(tx,ty+u(15),bw+6,u(10));
  ctx.fillStyle='#111';ctx.fillText(badge,tx+3,ty+u(16));
  const stars=hero?'★'.repeat(ent.diff):'★'.repeat(ent.r);
  ctx.fillStyle=e.kind==='boss'?'#ff8a8a':'#9fb4d8';
  ctx.fillText(stars+(e.kind==='boss'?' BOSS':''),tx+bw+10,ty+u(16));
  ctx.font=FN(8);ctx.fillStyle='#cfd8e3';
  ctx.fillText(`HP ${ent.hp} · 공 ${ent.at} · 방 ${ent.df} · 속 ${ent.sd}`,tx,ty+u(28));
  let yy=ty+u(38);
  ctx.font=FN(9);
  ctx.fillStyle='#cdc6ea';for(const s of tr){ctx.fillText(s,tx,yy);yy+=lh;}
  ctx.fillStyle='#9fd8ff';for(const s of sk){ctx.fillText(s,tx,yy);yy+=lh;}

  const prog=clampN((now-e.t0)/e.total,0,1);
  ctx.fillStyle='rgba(255,255,255,.10)';
  ctx.fillRect(x0+pad,y0+h-pad-4,w-pad*2,3);
  ctx.fillStyle='#7ef3ff';
  ctx.fillRect(x0+pad,y0+h-pad-4,(w-pad*2)*(1-prog),3);
}

function drawTourHpBar(x,y,w,label,hp,max,lag,hurt){
  const r=clampN(hp/max,0,1),flash=hurt>0&&Math.floor(hurt*40)%2===0;
  ctx.textAlign='left';ctx.textBaseline='top';ctx.font=`bold ${Math.max(11,Math.round(IH*.032))}px monospace`;
  ctx.fillStyle=flash?'#ffb2a8':'#f4f1e8';ctx.fillText(label,x,y-18);
  ctx.fillStyle=flash?'rgba(80,10,10,.92)':'rgba(10,12,12,.92)';ctx.fillRect(x,y,w,9);
  ctx.strokeStyle='rgba(255,255,255,.35)';ctx.strokeRect(x+.5,y+.5,w-1,8);
  ctx.fillStyle=flash?'#ff9b2f':'#f0b24b';ctx.fillRect(x,y,w*clampN(lag,0,1),9);
  ctx.fillStyle=r>.35?'#54c845':'#d8483a';ctx.fillRect(x,y,w*r,9);
  ctx.font=`bold ${Math.max(9,Math.round(IH*.026))}px monospace`;ctx.fillStyle='#cfd8e3';ctx.fillText(`${hp}/${max}`,x,y+12);
}
function drawTourBattleHud(e){
  const w=Math.min(150,Math.floor(IW*.38)),y=Math.floor(IH*.72);
  drawTourHpBar(12,y,w,TOUR?.bossName||'필드보스',e.bossHp,e.bossMax,e.bossLag,e.bossHurt);
  drawTourHpBar(IW-w-12,y,w,e.ent.n||'적',e.foeHp,e.foeMax,e.foeLag,e.foeHurt);
}

function drawEncNameTag(e, dirX, dirY, plX, plY, hz) {
  const ent = e.ent;
  const invDet = 1 / (plX * dirY - dirX * plY);
  const rx = e.x - px, ry = e.y - py;
  const trX = invDet * (dirY * rx - dirX * ry);
  const trY = invDet * (-plY * rx + plX * ry);
  if (trY <= 0.1) return;
  const sx = (IW / 2) * (1 + trX / trY);
  const size = e.kind === 'boss' ? 0.86 : 0.54;
  const sprH = size * IH / trY;
  const y = hz + (IH / (2 * trY)) - sprH - 12;
  if (sx < 18 || sx > IW - 18 || y < 18 || y > IH - 24) return;
  const name = ent.n || '???';
  const badge = e.kind === 'boss' ? 'FIELD BOSS' : e.kind === 'hero' ? 'HERO' : 'MONSTER';
  const font = `${Math.max(9, Math.round(IH * 0.032))}px monospace`;
  const small = `${Math.max(7, Math.round(IH * 0.022))}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = small;
  const bw = ctx.measureText(badge).width + 10;
  ctx.fillStyle = e.kind === 'boss' ? 'rgba(120,34,34,.88)' : e.kind === 'hero' ? 'rgba(87,35,35,.88)' : 'rgba(25,46,30,.88)';
  ctx.fillRect(Math.round(sx - bw / 2), Math.round(y - 20), Math.round(bw), 12);
  ctx.fillStyle = e.kind === 'boss' ? '#ffd76a' : e.kind === 'hero' ? '#ffb2a8' : '#9cff8a';
  ctx.fillText(badge, sx, y - 14);
  ctx.font = font;
  const tw = Math.min(IW - 22, ctx.measureText(name).width + 18);
  ctx.fillStyle = 'rgba(5,6,10,.78)';
  ctx.fillRect(Math.round(sx - tw / 2), Math.round(y - 5), Math.round(tw), 20);
  ctx.strokeStyle = 'rgba(255,215,106,.65)';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(sx - tw / 2) + .5, Math.round(y - 5) + .5, Math.round(tw) - 1, 19);
  ctx.fillStyle = '#f4f1e8';
  ctx.fillText(name, sx, y + 5);
}

/* ---------- UI 바인딩 ($ 정의보다 앞서므로 getElementById 직접 사용) ---------- */
(function bindTourUI(){
  const b=document.getElementById('tourBtn');
  if(b)b.addEventListener('click',()=>startTour());
  const x=document.getElementById('tourExit');
  if(x)x.addEventListener('click',()=>{if(gameState==='tour')endTour();});
  const s=document.getElementById('tourSkip');
  if(s)s.addEventListener('click',()=>{
    if(gameState!=='tour'||!TOUR)return;
    if(TOUR.ev&&TOUR.ev.choice)return;
    if(TOUR.ev)tourCloseEvent();
    else if(TOUR.enc&&!TOUR.enc.awaitingChoice)tourFinishEncounter(performance.now());
    else{TOUR.nextEncAt=0;beep(720,.05,'triangle',.06);}
  });
  const c=document.getElementById('evClose');
  if(c)c.addEventListener('click',()=>{if(gameState==='tour'&&TOUR)tourCloseEvent();});
  const spd=document.getElementById('tourSpeedToggle');
  if(spd)spd.addEventListener('click',cycleTourSpeed);
  setTourSpeed(1);
})();
cv.addEventListener('pointerdown',()=>{
  if(gameState==='tour'&&TOUR&&TOUR.enc&&!TOUR.enc.awaitingChoice)tourFinishEncounter(performance.now());
});

/* ============================================================
   입력
   ============================================================ */
const joyVec={f:0,s:0};
const joyBase=document.getElementById('joyBase');
const joyKnob=document.getElementById('joyKnob');
const RJ=64;
const activeT=new Map();
const vk={fwd:false,back:false,left:false,right:false,tl:false,tr:false};

function refreshAIBtns(){
  document.getElementById('aiBtn').classList.toggle('on',aiActive);
  document.getElementById('mAiBtn').textContent=aiActive?'🤖 자동조종: 켬 (탭 정지)':'🤖 자동조종: 끔';
}
function aiToggle(){
  if(gameState!=='play')return;
  aiActive=!aiActive;
  if(aiActive){aiSense();pushMsg('🤖 자동조종 개시');}
  else pushMsg('🤖 자동조종 해제');
  refreshAIBtns();beep(aiActive?700:380,.07,'triangle',.07);
}
function noteManual(){
  if(aiActive&&gameState==='play'){aiActive=false;refreshAIBtns();pushMsg('🤖 수동 조작 전환');}
}
function showJoy(info){
  joyBase.style.display='block';
  joyBase.style.left=(info.sx-RJ)+'px';
  joyBase.style.top=(info.sy-RJ)+'px';
  joyKnob.style.transform='translate(0px,0px)';
}
function updateJoy(info){
  let dx=info.x-info.sx,dy=info.y-info.sy;
  const max=RJ*0.58,d=Math.hypot(dx,dy);
  if(d>max){dx*=max/d;dy*=max/d;}
  joyKnob.style.transform=`translate(${dx}px,${dy}px)`;
  if(Math.hypot(dx,dy)<9){joyVec.f=0;joyVec.s=0;}
  else{joyVec.f=-dy/max;joyVec.s=dx/max;}
}
function hideJoy(){joyBase.style.display='none';joyVec.f=0;joyVec.s=0;}

cv.addEventListener('touchstart',e=>{
  if(gameState==='tour')return;
  e.preventDefault();initAudio();noteManual();
  const hasMove=[...activeT.values()].some(v=>v.side==='move');
  const hasLook=[...activeT.values()].some(v=>v.side==='look');
  for(const t of e.changedTouches){
    let side='look';
    if(t.clientX<vw_*0.45&&!hasMove)side='move';
    else if(hasLook)side='dead';
    activeT.set(t.identifier,{side,sx:t.clientX,sy:t.clientY,x:t.clientX,y:t.clientY});
    if(side==='move')showJoy(activeT.get(t.identifier));
  }
},{passive:false});
cv.addEventListener('touchmove',e=>{
  if(gameState==='tour')return;
  e.preventDefault();
  for(const t of e.changedTouches){
    const info=activeT.get(t.identifier);
    if(!info)continue;
    const dx=t.clientX-info.x,dy=t.clientY-info.y;
    info.x=t.clientX;info.y=t.clientY;
    if(info.side==='look')ang+=dx*LOOK_SENS;
    else if(info.side==='move')updateJoy(info);
  }
},{passive:false});
function endTouch(e){
  if(gameState==='tour'){activeT.clear();return;}
  e.preventDefault();
  for(const t of e.changedTouches){
    const info=activeT.get(t.identifier);
    if(!info)continue;
    if(info.side==='move')hideJoy();
    activeT.delete(t.identifier);
  }
}
cv.addEventListener('touchend',endTouch,{passive:false});
cv.addEventListener('touchcancel',endTouch,{passive:false});

function bindHold(el,prop){
  el.addEventListener('pointerdown',e=>{
    e.preventDefault();initAudio();noteManual();
    el.setPointerCapture?.(e.pointerId);
    vk[prop]=true;el.classList.add('on');
  });
  const off=()=>{vk[prop]=false;el.classList.remove('on');};
  el.addEventListener('pointerup',off);
  el.addEventListener('pointercancel',off);
  el.addEventListener('lostpointercapture',off);
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
bindHold(document.getElementById('dUp'),'fwd');
bindHold(document.getElementById('dDown'),'back');
bindHold(document.getElementById('dLeft'),'left');
bindHold(document.getElementById('dRight'),'right');
bindHold(document.getElementById('lTurnL'),'tl');
bindHold(document.getElementById('lTurnR'),'tr');
document.getElementById('aiBtn').addEventListener('click',()=>{initAudio();aiToggle();});

addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))noteManual();
  keys.add(e.code);
  if(gameState==='gen'){
    if(e.code==='Space')cycleSpeed();
    if(e.code==='Enter'&&gen.kind==='wfc')gen.speed=2;
  }
  if(e.code==='KeyT'&&gameState==='play')aiToggle();
  if(e.code==='Escape'){
    const texOv=document.getElementById('texOv');
    if(texOv&&!texOv.classList.contains('hidden'))closeTexEd();
    else if(gameState==='tour'&&TOUR&&TOUR.ev)tourCloseEvent();
    else if(gameState==='tour')endTour();
    else if(gameState==='play')openMenu();
    else if(gameState==='pause')closeMenu();
  }
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();hideJoy();});

let locked=false;
const isCoarse=matchMedia('(pointer:coarse)').matches;
cv.addEventListener('click',()=>{if(gameState==='play'&&!locked&&!isCoarse)cv.requestPointerLock?.();});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===cv;});
document.addEventListener('mousemove',e=>{
  if(locked&&gameState==='play'){noteManual();ang+=e.movementX*LOOK_SENS;}
});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('gesturestart',e=>e.preventDefault());

/* ============================================================
   사운드 (기초 beep/vib 등은 engine-core.js 소유)
   ============================================================ */
const sndStep=()=>{
  if(dmode==='cave'){beep(64,.07,'sine',.05);beep(64,.05,'sine',.018,0,.09);}
  else beep(70,.05,'triangle',.05);
};
let lastTick=0;
const sndTick=e=>{const n=performance.now();if(n-lastTick>85){lastTick=n;beep(260+e*40,.03,'square',.028);}};

// 물방울 + 🌊 호수 물소리 (🚶 투어에서도 재생)
let nextDrip=0,nextLap=0;
function tryDrip(now){
  if(dmode!=='cave'||!sndOn||!AC)return;
  if(gameState!=='play'&&gameState!=='demo'&&gameState!=='tour')return;
  if(now<nextDrip)return;
  nextDrip=now+1200+Math.random()*3200;
  const f=1200+Math.random()*700;
  beep(f,.1,'sine',.045,f*.35);
  beep(f,.09,'sine',.016,f*.35,.16);
}
function sndLap(){
  const f=170+Math.random()*130;
  beep(f,.16,'sine',.03,f*.6);
  beep(f,.13,'sine',.012,f*.6,.22);
}
function tryLap(now){
  if(dmode!=='cave'||!sndOn||!AC||!waterG)return;
  if(gameState!=='play'&&gameState!=='demo'&&gameState!=='tour')return;
  if(now<nextLap)return;
  const near=waterNearby();
  nextLap=now+(near?1400+Math.random()*2600:5000+Math.random()*6000);
  if(near)sndLap();
}
let drone=null;
function setDrone(on){
  if(!AC)return;
  if(on&&!drone&&sndOn&&dmode==='cave'){
    const o1=AC.createOscillator(),o2=AC.createOscillator(),gN=AC.createGain();
    o1.type='sine';o1.frequency.value=52;
    o2.type='sine';o2.frequency.value=55.5;
    gN.gain.value=0.016;
    o1.connect(gN);o2.connect(gN);gN.connect(AC.destination);
    o1.start();o2.start();
    drone={o1,o2,gN};
  }else if(!on&&drone){
    try{drone.o1.stop();drone.o2.stop();}catch(e){}
    drone=null;
  }
}

function pushMsg(txt){msgQueue.push({txt,until:performance.now()+2800});if(msgQueue.length>4)msgQueue.shift();}
function showResultBanner(title, sub='', kind='ok'){
  resultBanner={title,sub,kind,t0:performance.now(),until:performance.now()+1800};
}
async function reqWakeLock(){try{await navigator.wakeLock?.request('screen');}catch(e){}}

/* ============================================================
   메뉴 / UI
   ============================================================ */
const $=id=>document.getElementById(id);
function refreshUI(){
  const inGame=(gameState==='play'||gameState==='pause');
  $('menuBtn').classList.toggle('hidden',!inGame);
  $('ctlLayer').classList.toggle('hidden',!(inGame&&showCtl));
  const demo=(gameState==='demo'||gameState==='demoEnd');
  $('demoBar').classList.toggle('hidden',!demo);
  $('demoClose').classList.toggle('hidden',!demo);
  $('tourBar').classList.toggle('hidden',gameState!=='tour');
  if(demo)updateDemoBar();
  updateDomHud();
}

function updateDomHud(){
  const show=(gameState==='play'||gameState==='tour'||gameState==='demo'||gameState==='demoEnd');
  const hud=$('domHud'),log=$('domLog');
  hud.classList.toggle('hidden',!show);
  log.classList.toggle('hidden',!show);
  if(!show)return;
  const el=clearTime||playTime;
  const hpNow=TOUR?.result?.hp ?? TOUR?.bossHp ?? null;
  const hpMax=TOUR?.bossMax ?? null;
  const bossEl=hud.querySelector('.boss');
  const hpEl=hud.querySelector('.hp');
  if(gameState==='tour'&&TOUR){
    bossEl.style.display='block';hpEl.style.display='block';
    bossEl.textContent=TOUR.bossName||'하수인';
    hpEl.textContent=`HP ${hpNow}/${hpMax}`;
  }else{bossEl.style.display='none';hpEl.style.display='none';}
  hud.querySelector('.gem').textContent=`💎 ${gotCount}`;
  hud.querySelector('.time')
     .textContent=`${curProfile?curProfile.icon:'🧱'} 걸음 ${walkCount}`;
  const ai=hud.querySelector('.ai');
  if(aiActive){
    const cov=TOTAL_FLOOR?Math.min(100,AI.knownFloor/TOTAL_FLOOR*100):0;
    ai.textContent=`🤖 ${aiPhaseLabel()} ${cov.toFixed(0)}%`;
    ai.style.display='block';
  }else ai.style.display='none';
  log.innerHTML='';
  msgQueue.slice(-3).forEach(m=>{
    const d=document.createElement('div');
    d.textContent=m.txt;
    log.appendChild(d);
  });
}
function updateDemoBar(){
  const ended=gameState==='demoEnd';
  ['spd0','spd1','spd2','skipBtn','demoNew'].forEach(id=>$(id).classList.toggle('hidden',ended));
  $('playThis').classList.toggle('hidden',!ended);
}
function openMenu(){
  if(gameState!=='play')return;
  gameState='pause';hideJoy();
  $('menuOv').classList.remove('hidden');
  document.exitPointerLock?.();
  refreshUI();beep(300,.06,'triangle',.06);
}
function closeMenu(){
  if(gameState!=='pause')return;
  $('menuOv').classList.add('hidden');
  gameState='play';refreshUI();beep(430,.06,'triangle',.06);
}
$('menuBtn').addEventListener('click',()=>{initAudio();openMenu();});
$('resumeBtn').addEventListener('click',closeMenu);
$('mAiBtn').addEventListener('click',()=>{
  $('menuOv').classList.add('hidden');
  gameState='play';refreshUI();aiToggle();
});
$('mNewBtn').addEventListener('click',()=>{
  $('menuOv').classList.add('hidden');
  nextDungeon();                    // ★ 새 던전 = 번호 재추첨 포함
  genMapSync();beginPlay();
});
$('mSoundBtn').addEventListener('click',()=>{
  sndOn=!sndOn;
  $('mSoundBtn').textContent=sndOn?'🔊 효과음: 켬':'🔇 효과음: 끔';
  if(!sndOn)setDrone(false);
  else{setDrone(true);beep(700,.07,'triangle',.08);}
});
$('mCtlBtn').addEventListener('click',()=>{
  showCtl=!showCtl;
  $('mCtlBtn').textContent=showCtl?'🕹 화면 버튼: 켬':'🕹 화면 버튼: 끔';
  refreshUI();
});
$('sensP').addEventListener('click',()=>{setSens(sensMul+0.25);beep(600,.05,'triangle',.06);});
$('sensM').addEventListener('click',()=>{setSens(sensMul-0.25);beep(420,.05,'triangle',.06);});

/* ============================================================
   🎨 텍스처 편집기 — 슬롯 교체 · 업로드 · D&D · 붙여넣기 · 필터 · 저장
   (texFromImage/texFromFile/ORIG/THEME ← engine-core.js)
   ============================================================ */
const LS_TEX='abyssTexV1';
let texSaved={};
try{texSaved=JSON.parse(localStorage.getItem(LS_TEX)||'{}');}catch(e){texSaved={};}

let selSlot=null;
function slotDefs(){
  const m=dmode,list=[];
  [0,1,2].forEach(i=>list.push({k:`${m}.wall.${i}`,
    label:['벽 1','벽 2','벽 3★'][i],get:()=>THEME[m].wall[i]}));
  list.push({k:`${m}.floor`,label:'바닥',get:()=>THEME[m].floor});
  list.push({k:`${m}.ceil`,label:'천장',get:()=>THEME[m].ceil});
  if(m==='cave')list.push({k:'cave.wet',label:'젖은 바닥',get:()=>THEME.cave.wet});
  return list;
}
function setSlot(key,pair){
  const[m,role,idxS]=key.split('.');
  if(pair){
    if(role==='wall')THEME[m].wall[+idxS]=pair.tex; else THEME[m][role]=pair.tex;
    try{texSaved[key]=pair.canvas.toDataURL('image/png');}catch(e){}
  }else{
    if(role==='wall')THEME[m].wall[+idxS]=ORIG[m].wall[+idxS]; else THEME[m][role]=ORIG[m][role];
    delete texSaved[key];
  }
  try{localStorage.setItem(LS_TEX,JSON.stringify(texSaved));}catch(e){}
}
function applySavedKey(key,dataUrl){
  const im=new Image();
  im.onload=()=>{
    const{tex}=texFromImage(im);
    const[m,role,i]=key.split('.');
    if(!THEME[m])return;
    if(role==='wall')THEME[m].wall[+i]=tex; else THEME[m][role]=tex;
    if(typeof refreshTexGrid==='function'&&selSlot)refreshTexGrid();
  };
  im.src=dataUrl;
}
function bootLoadTextures(){
  for(const key in texSaved)applySavedKey(key,texSaved[key]);
}
function texHintMsg(txt,isErr){
  const h=$('texHint');
  h.textContent=txt;
  h.style.color=isErr?'#ff8a8a':'#7ef3ff';
}
function refreshTexGrid(){
  const gEl=$('texGrid');gEl.innerHTML='';
  for(const s of slotDefs()){
    const b=document.createElement('button');
    b.style.cssText=`border:2px solid ${selSlot===s.k?'#ffd76a':'#33405c'};
      border-radius:10px;background:#141b29;padding:5px;color:#aab8cc;
      font-family:inherit;font-size:11px;cursor:pointer;text-align:center`;
    const c=document.createElement('canvas');c.width=c.height=64;
    c.style.cssText='width:100%;image-rendering:pixelated;border-radius:5px';
    const g2d=c.getContext('2d'),im=g2d.createImageData(TS,TS);
    new Uint32Array(im.data.buffer).set(s.get().levels[12]);
    g2d.putImageData(im,0,0);
    b.appendChild(c);b.insertAdjacentHTML('beforeend',`<br>${s.label}`);
    b.onclick=()=>{selSlot=s.k;refreshTexGrid();
      texHintMsg(`선택됨: ${s.label} — 이미지를 지정하거나 필터를 누르세요`);
      beep(600,.04,'triangle',.05);};
    gEl.appendChild(b);
  }
  const cur=slotDefs().find(s=>s.k===selSlot);
  if(cur)texHintMsg(`선택됨: ${cur.label} — 이미지를 지정하거나 필터를 누르세요`);
  else texHintMsg('슬롯을 선택하세요');
}
function openTexEd(){
  $('menuOv').classList.add('hidden');
  $('texModeLbl').textContent=dmode==='cave'?'(동굴 모드)':'(미로 모드)';
  $('texOv').classList.remove('hidden');
  refreshTexGrid();
}
function closeTexEd(){
  $('texOv').classList.add('hidden');
  if(gameState==='pause')$('menuOv').classList.remove('hidden');
  beep(430,.06,'triangle',.06);
}
$('mTexBtn').addEventListener('click',()=>{initAudio();openTexEd();beep(520,.06,'triangle',.06);});
$('texClose').addEventListener('click',closeTexEd);

// ① 파일 업로드
$('texFile').addEventListener('change',e=>{
  if(!selSlot){texHintMsg('먼저 위에서 슬롯을 선택하세요',true);e.target.value='';return;}
  const ok=texFromFile(e.target.files[0],p=>{setSlot(selSlot,p);refreshTexGrid();sndPickup();});
  if(!ok)texHintMsg('이미지 파일이 아닙니다',true);
  e.target.value='';
});
// ② 드래그&드롭
const texPnl=$('texPanel');
texPnl.addEventListener('dragover',e=>e.preventDefault());
texPnl.addEventListener('drop',e=>{
  e.preventDefault();
  if(!selSlot){texHintMsg('먼저 위에서 슬롯을 선택하세요',true);return;}
  const ok=texFromFile(e.dataTransfer.files[0],p=>{setSlot(selSlot,p);refreshTexGrid();sndPickup();});
  if(!ok)texHintMsg('이미지 파일이 아닙니다',true);
});
// ③ 클립보드 붙여넣기
addEventListener('paste',e=>{
  if($('texOv').classList.contains('hidden'))return;
  if(!selSlot){texHintMsg('먼저 위에서 슬롯을 선택하세요',true);return;}
  for(const it of e.clipboardData?.items||[])
    if(it.type&&it.type.startsWith('image/')){
      const f=it.getAsFile();
      if(f)texFromFile(f,p=>{setSlot(selSlot,p);refreshTexGrid();sndPickup();});
      break;
    }
});
// 복원
$('texResetOne').addEventListener('click',()=>{
  if(!selSlot){texHintMsg('먼저 위에서 슬롯을 선택하세요',true);return;}
  setSlot(selSlot,null);refreshTexGrid();beep(340,.08,'triangle',.06,240);
});
$('texResetAll').addEventListener('click',()=>{
  for(const key of Object.keys(texSaved))setSlot(key,null);
  refreshTexGrid();beep(300,.12,'sawtooth',.06,110);
});

// ④ 원탭 색보정 필터
const FILTERS=[
  {n:'🌅 황혼',   m:[1.15,.25,-.05, .05,.90,.05, -.05,.15,.85]},
  {n:'❄️ 서리',    m:[.72,.95,1.08, .80,.95,1.02, .95,1.05,1.18]},
  {n:'🩸 피의제단', m:[1.20,.38,.20, .15,.50,.15, .12,.10,.38]},
  {n:'☠️ 독연무',  m:[.45,1.05,.35, .50,1.15,.42, .30,.80,.30]},
  {n:'🌌 심연',    m:[.55,.70,.92, .60,.76,.96, .86,1.00,1.22]},
];
function filterVariant(fi){
  if(!selSlot){texHintMsg('먼저 위에서 슬롯을 선택하세요',true);return;}
  const[m,role,i]=selSlot.split('.');
  const orig=role==='wall'?ORIG[m].wall[+i]:ORIG[m][role];
  const mx=FILTERS[fi].m,n=TS*TS,d=new Uint8ClampedArray(n*4);
  const s=orig.levels[15];
  const cl=v=>v<0?0:v>255?255:v;
  for(let j=0;j<n;j++){
    const v=s[j],r=v&255,gg=(v>>>8)&255,bb=(v>>>16)&255;
    d[j*4]  =cl(mx[0]*r+mx[1]*gg+mx[2]*bb);
    d[j*4+1]=cl(mx[3]*r+mx[4]*gg+mx[5]*bb);
    d[j*4+2]=cl(mx[6]*r+mx[7]*gg+mx[8]*bb);
    d[j*4+3]=255;
  }
  const c=document.createElement('canvas');c.width=c.height=TS;
  c.getContext('2d').putImageData(new ImageData(d,TS,TS),0,0);
  setSlot(selSlot,texFromImage(c));refreshTexGrid();sndPickup();
}
FILTERS.forEach((f,i)=>{
  const b=document.createElement('button');
  b.className='mbtn sub';
  b.style.cssText='width:auto;padding:8px 12px;font-size:12px;min-height:38px';
  b.textContent=f.n;
  b.onclick=()=>filterVariant(i);
  $('texFilters').appendChild(b);
});

/* ============================================================
   🌀 생성 시각화 (WFC / CA 겸용 — 현재 투어 플로우에선 대기 상태)
   ============================================================ */
const genCv=$('gen'),g2=genCv.getContext('2d');
function resizeGen(){genCv.width=vw_();genCv.height=vh_();}
const gen={kind:'wfc',solver:null,attempt:0,contras:0,speed:0,doneAt:0,
           frames:null,fi:0,shown:0,tickN:0,holdT:0,final:null};
const SPEEDS=[3,14,Infinity];
const SPD_NAMES=['x1 느리게','x4 빠르게','즉시 완료'];

function newAttempt(){gen.solver=new Solver();gen.attempt++;seedAnchors(gen.solver);}
function startGenWatch(){
  gen.attempt=0;gen.contras=0;gen.speed=0;gen.doneAt=0;gen.tickN=0;
  if(dmode==='cave'){
    gen.kind='cave';
    const P=CA_PRESETS[caKey];
    const b=buildCave(P);
    if(!b){fallbackMaze();placeEntities();beginPlay();return;}
    gen.frames=b.frames;gen.final=b.final;gen.fi=0;gen.shown=0;gen.holdT=0;
  }else{
    gen.kind='wfc';newAttempt();
  }
  gameState='gen';
  $('overlay').classList.add('hidden');
  $('menuOv').classList.add('hidden');
  genCv.classList.remove('hidden');
  refreshUI();resizeGen();
}
function cycleSpeed(){gen.speed=(gen.speed+1)%3;beep(500+gen.speed*180,.06,'triangle',.07);}
function genFinishLayoutFromCells(cells){
  finalizeGrid(cells);
  if(placeEntities()){gen.doneAt=performance.now();sndWin();return true;}
  gen.contras++;return false;
}
function genTick(now){
  if(gen.doneAt)return;
  if(gen.kind==='wfc'){
    if(!gen.solver||gen.solver.finished)return;
    const sp=SPEEDS[gen.speed];
    let n=sp===Infinity?99999:sp;
    while(n-->0){
      if(gen.solver.finished)break;
      const r=gen.solver.step();
      if(r==='fail'){gen.contras++;newAttempt();beep(120,.09,'sawtooth',.05,70);break;}
      if(r==='done'){
        const cells=new Uint8Array(MW*MH);
        for(let i=0;i<MW*MH;i++)cells[i]=gen.solver.val[i]===0?1:0;
        if(genFinishLayoutFromCells(cells))return;
        gen.contras++;newAttempt();break;
      }
      if(sp!==Infinity)sndTick(gen.solver.poss[gen.solver.lastCi]?.length||8);
    }
  }else{
    const sp=SPEEDS[gen.speed];
    const total=MW*MH;
    if(gen.fi===0&&gen.shown<total){
      gen.shown+=sp===Infinity?total:sp*2;
      if(sp!==Infinity&&(gen.tickN++%3===0))beep(300+(gen.shown/total*300),.02,'square',.02);
      if(gen.shown>=total){gen.fi=1;gen.holdT=now;}
      return;
    }
    const hold=sp===Infinity?1:Math.max(120,900/sp);
    if(now-gen.holdT>=hold){
      gen.holdT=now;
      gen.fi++;
      if(gen.fi>=gen.frames.length){
        if(genFinishLayoutFromCells(gen.final))return;
        const nb=buildCave(CA_PRESETS[caKey]);
        if(nb){gen.frames=nb.frames;gen.final=nb.final;gen.fi=0;gen.shown=0;}
        else{fallbackMaze();placeEntities();gen.doneAt=performance.now();}
      }else if(sp!==Infinity)beep(240+gen.fi*60,.04,'triangle',.03);
    }
  }
}
function beginPlay(){
  genCv.classList.add('hidden');
  px=startPos.x;py=startPos.y;ang=startAng;
  bobPhase=0;bobAmt=0;lastStepPh=0;
  gotCount=0;walkCount=0;lastWalkCell=`${px|0},${py|0}`;playTime=0;clearTime=0;msgQueue=[];hideJoy();
  aiActive=false;aiReset();refreshAIBtns();
  lastAiCellX=-1;lastAiCellY=-1;
  gameState='play';
  const P=curProfile||resolveProfile(curDun||1);
  msgQueue=[{txt:`${P.icon} ${P.no}. ${P.dunName} (${P.genLabel}) 진입`,
    until:performance.now()+2800}];
  nextDrip=performance.now()+1500;
  nextLap=performance.now()+2500;
  setDrone(true);
  refreshUI();
}
function genRender(now){
  const w=genCv.width,h=genCv.height;
  g2.fillStyle='#04050a';g2.fillRect(0,0,w,h);
  const topPad=64,botPad=54;
  const bw=Math.min(w-16,h-topPad-botPad);
  const ox=(w-bw)/2,oy=topPad+(h-topPad-botPad-bw)/2;
  const cs=bw/MW;

  g2.strokeStyle='rgba(90,110,160,.10)';g2.lineWidth=1;
  for(let i=0;i<=MW;i++){
    g2.beginPath();g2.moveTo(ox+i*cs,oy);g2.lineTo(ox+i*cs,oy+bw);g2.stroke();
    g2.beginPath();g2.moveTo(ox,oy+i*cs);g2.lineTo(ox+bw,oy+i*cs);g2.stroke();
  }

  let col=0,tot=MW*MH,doneTxt=false;
  if(gen.kind==='wfc'){
    const s=gen.solver;
    if(s){
      for(let cy=0;cy<MH;cy++)for(let cx=0;cx<MW;cx++){
        const ci=cy*MW+cx,x=ox+cx*cs,y=oy+cy*cs;
        if(s.collapsed[ci])drawCollapsedCell(ci,x,y,cs);
        else{
          const L=s.poss[ci].length,k=Math.min(1,L/NT);
          g2.fillStyle=`rgb(${Math.round(21+(89-21)*(1-k))},${Math.round(26+(230-26)*(1-k))},${Math.round(48+(255-48)*(1-k))})`;
          g2.fillRect(x,y,cs+0.5,cs+0.5);
          if(L<=4){
            g2.fillStyle='rgba(255,255,255,'+(0.25+0.2*Math.sin(now*0.02))+')';
            g2.fillRect(x+cs/2-1,y+cs/2-1,2,2);
          }
        }
      }
      if(s.lastCi>=0&&now-s.lastT<300){
        const fx=ox+(s.lastCi%MW)*cs+cs/2,fy=oy+((s.lastCi/MW)|0)*cs+cs/2;
        const p=(now-s.lastT)/300;
        g2.strokeStyle=`rgba(255,255,255,${0.9*(1-p)})`;g2.lineWidth=2;
        g2.beginPath();g2.arc(fx,fy,cs*(0.4+p*0.9),0,7);g2.stroke();
      }
      col=s.collapsedCount;doneTxt=s.finished;
    }
  }else{
    const fr=gen.frames?gen.frames[Math.min(gen.fi,gen.frames.length-1)]:null;
    if(fr){
      const revealAll=gen.fi>0||gen.shown>=MW*MH;
      for(let cy=0;cy<MH;cy++)for(let cx=0;cx<MW;cx++){
        const ci=cy*MW+cx,x=ox+cx*cs,y=oy+cy*cs;
        if(!revealAll&&ci>gen.shown){
          g2.fillStyle='#0a1020';g2.fillRect(x,y,cs+0.5,cs+0.5);
          continue;
        }
        if(fr[ci]){
          const sh=((ci*2654435761)>>>0)%14-7;
          g2.fillStyle=`rgb(${52+sh},${48+sh},${60+sh})`;
        }else{
          let rim=false;
          for(let k=0;k<4;k++){
            const nx=cx+DX[k],ny=cy+DY[k];
            if(nx>=0&&ny>=0&&nx<MW&&ny<MH&&fr[ny*MW+nx]){rim=true;break;}
          }
          g2.fillStyle=rim?'#123044':'#0a1520';
        }
        g2.fillRect(x,y,cs+0.5,cs+0.5);
      }
      col=gen.fi===0?gen.shown:tot;
      doneTxt=gen.fi>=gen.frames.length;
      g2.textAlign='center';
      g2.font=Math.min(12,w*0.03)+'px monospace';
      g2.fillStyle='#5f8fb0';
      const P=CA_PRESETS[caKey];
      const stageTxt=gen.fi===0?'① 무작위 노이즈 ('+Math.round(P.init*100)+'% 벽)'
        :(P.pocket&&gen.fi===gen.frames.length-1)?'③ 포켓 파내기'
        :`② 평활화 ${Math.min(gen.fi,P.iters)}/${P.iters} 회`;
      g2.fillText(stageTxt,w/2,oy+bw+10);
    }
  }

  g2.strokeStyle='#3d4a63';g2.lineWidth=2;
  g2.strokeRect(ox-1,oy-1,bw+2,bw+2);

  const P=CA_PRESETS[caKey];
  const title=gen.kind==='wfc'?'🌀 Wave Function Collapse':`${P.icon} Cellular Automata — ${P.label}`;
  const sub=gen.kind==='wfc'?'Tiled Model · 최소 엔트로피 휴리스틱'
    :'노이즈 → 4/5 규칙 평활화 → 최대 공동 추출'+(P.pocket?' + 포켓':'');
  g2.textAlign='left';g2.textBaseline='top';
  g2.font='bold '+Math.min(18,w*0.042)+'px monospace';
  g2.fillStyle=gen.kind==='wfc'?'#c39bff':'#7ef3ff';
  g2.fillText(title,12,10);
  g2.font=Math.min(12,w*0.03)+'px monospace';
  g2.fillStyle='#7ea8cc';g2.fillText(sub,12,34);
  g2.textAlign='right';
  g2.fillStyle='#9fb4d8';
  g2.fillText(`진행 ${col}/${tot} · 시도 ${gen.attempt} · 실패 ${gen.contras}`,w-12,12);
  g2.fillStyle=doneTxt?'#8affa0':'#ffd76a';
  g2.fillText(doneTxt?'✔ 완료! 잠시 후 입장…':'⏳ 생성 중…',w-12,30);
  g2.fillStyle='rgba(255,255,255,.08)';g2.fillRect(12,h-30,w-24,8);
  g2.fillStyle=gen.kind==='wfc'?'#c39bff':'#7ef3ff';
  g2.fillRect(12,h-30,(w-24)*(col/tot),8);
  g2.textAlign='center';
  g2.font='bold '+Math.min(13,w*0.034)+'px monospace';
  g2.fillStyle=doneTxt?'#667':'#ffd76a';
  g2.fillText(doneTxt?'입장 준비 중…':`탭: 속도 [${SPD_NAMES[gen.speed]}]`,w/2,h-14);
}
function drawCollapsedCell(ci,x,y,cs){
  const v=gen.solver.val[ci];
  if(v===0){
    const sh=((ci*2654435761)>>>0)%16-8;
    g2.fillStyle=`rgb(${56+sh},${50+sh},${62+sh})`;
    g2.fillRect(x,y,cs+0.5,cs+0.5);
    g2.fillStyle='rgba(0,0,0,.4)';
    g2.fillRect(x,y+cs-1,cs+0.5,1);g2.fillRect(x+cs-1,y,1,cs);
    if(cs>7){g2.fillStyle='rgba(255,255,255,.06)';g2.fillRect(x+1,y+1,cs-2,1);}
  }else{
    g2.fillStyle='#0e1118';g2.fillRect(x,y,cs+0.5,cs+0.5);
    g2.strokeStyle='rgba(255,208,128,.9)';
    g2.lineWidth=Math.max(1.2,cs*0.2);g2.lineCap='round';
    const mx=x+cs/2,my=y+cs/2,socks=TILES[v].s;
    for(let d=0;d<4;d++){
      if(!socks[d])continue;
      g2.beginPath();g2.moveTo(mx,my);
      g2.lineTo(mx+DX[d]*cs/2,my+DY[d]*cs/2);g2.stroke();
    }
    if(v===1&&cs>8){
      g2.fillStyle='rgba(140,125,220,.16)';
      g2.beginPath();g2.arc(mx,my,cs*0.36,0,7);g2.fill();
    }
    g2.fillStyle='rgba(255,225,170,.9)';g2.fillRect(mx-1,my-1,2,2);
  }
}
genCv.addEventListener('pointerdown',e=>{
  e.preventDefault();initAudio();
  if(gameState!=='gen')return;
  if(gen.doneAt)return;
  cycleSpeed();
},{passive:false});

/* ============================================================
   🎬 AI 관람 데모 (투어 플로우에서는 대기 상태 — 유지)
   ============================================================ */
const DEMO_SUB=[1,4,16,64];
let demoSpeed=0,demoTime=0;
function startDemo(){
  genMapSync();
  px=startPos.x;py=startPos.y;ang=startAng;
  gotCount=0;walkCount=0;lastWalkCell=`${px|0},${py|0}`;playTime=0;demoTime=0;msgQueue=[];
  aiActive=false;aiReset();
  lastAiCellX=-1;lastAiCellY=-1;
  demoSpeed=0;updateSpdBtns();
  gameState='demo';
  $('overlay').classList.add('hidden');
  $('menuOv').classList.add('hidden');
  genCv.classList.add('hidden');
  resizeGen();refreshUI();
  msgQueue=[{txt:'🤖 AI 탐사 시작 — 미지의 맵 향해 전진',until:performance.now()+2600}];
  nextDrip=performance.now()+800;
  nextLap=performance.now()+1500;
  setDrone(true);
}
function updateSpdBtns(){
  ['spd0','spd1','spd2'].forEach((id,i)=>$(id).classList.toggle('on',demoSpeed===i));
}
['spd0','spd1','spd2'].forEach((id,i)=>{
  $(id).addEventListener('click',()=>{
    demoSpeed=i;updateSpdBtns();
    beep(500+i*160,.05,'triangle',.06);
    updateDemoBar();
  });
});
$('skipBtn').addEventListener('click',()=>{demoSpeed=3;updateSpdBtns();beep(900,.07,'triangle',.07);});
$('demoNew').addEventListener('click',()=>{initAudio();startDemo();});
$('demoClose').addEventListener('click',()=>{
  gameState='title';setDrone(false);
  $('overlay').classList.remove('hidden');
  refreshUI();
});
$('playThis').addEventListener('click',()=>{
  gems.forEach(gm=>gm.got=false);
  gotCount=0;walkCount=0;lastWalkCell=`${px|0},${py|0}`;playTime=0;clearTime=0;
  visited=new Uint8Array(MW*MH);
  px=startPos.x;py=startPos.y;ang=startAng;
  bobPhase=0;bobAmt=0;lastStepPh=0;
  aiActive=false;aiReset();refreshAIBtns();
  gameState='play';
  msgQueue=[{txt:'🎮 이 던전에 도전!',until:performance.now()+2400}];
  refreshUI();
  if(!isCoarse)cv.requestPointerLock?.();
});
function renderTopDown(now){
  const w=genCv.width,h=genCv.height;
  g2.fillStyle='#04050a';g2.fillRect(0,0,w,h);
  const headerH=58,footerH=64;
  const cs=Math.min((w-20)/MW,(h-headerH-footerH)/MH);
  const ox=(w-cs*MW)/2,oy=headerH+(h-headerH-footerH-cs*MH)/2;

  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    const k=AI.known?AI.known[x+y*MW]:0;
    if(k===0)g2.fillStyle='#07080d';
    else if(k===3)g2.fillStyle='#0d2b40';
    else if(k===2)g2.fillStyle='#3f4856';
    else g2.fillStyle=wetG&&wetG[x+y*MW]?'#0e2230':'#12161f';
    g2.fillRect(ox+x*cs,oy+y*cs,cs+0.5,cs+0.5);
  }
  if(gameState==='demo'){
    g2.fillStyle=`rgba(138,255,160,${0.35+0.25*Math.sin(now*0.006)})`;
    for(let i=0;i<MW*MH;i++)
      if(isFrontier(i))
        g2.fillRect(ox+(i%MW)*cs+cs*0.3,oy+((i/MW)|0)*cs+cs*0.3,cs*0.4,cs*0.4);
  }
  if(AI.trail.length>1){
    g2.strokeStyle='rgba(255,215,106,.30)';
    g2.lineWidth=Math.max(1.5,cs*0.16);
    g2.lineJoin='round';g2.lineCap='round';
    g2.beginPath();
    g2.moveTo(ox+AI.trail[0].x*cs,oy+AI.trail[0].y*cs);
    for(const p of AI.trail)g2.lineTo(ox+p.x*cs,oy+p.y*cs);
    g2.lineTo(ox+px*cs,oy+py*cs);
    g2.stroke();
  }
  if(gameState==='demo'&&AI.path.length){
    g2.strokeStyle='rgba(126,243,255,.55)';
    g2.lineWidth=Math.max(1.2,cs*0.1);
    g2.beginPath();g2.moveTo(ox+px*cs,oy+py*cs);
    for(const p of AI.path)g2.lineTo(ox+p.x*cs,oy+p.y*cs);
    g2.stroke();
  }
  for(const gm of gems){
    if(gm.got)continue;
    if(!AI.known||(AI.known[(gm.x|0)+(gm.y|0)*MW]!==1))continue;
    const gx=ox+gm.x*cs,gy=oy+gm.y*cs;
    g2.save();g2.translate(gx,gy);g2.rotate(Math.PI/4);
    g2.fillStyle='#27d7ff';
    const s2=cs*0.32*(1+0.12*Math.sin(now*0.005+gm.phase));
    g2.fillRect(-s2/2,-s2/2,s2,s2);
    g2.restore();
  }
  if(AI.known&&AI.known[(portal.x|0)+(portal.y|0)*MW]===1){
    const gx=ox+portal.x*cs,gy=oy+portal.y*cs;
    const pr=cs*(0.42+0.08*Math.sin(now*0.004));
    g2.fillStyle=gotCount>=GEM_TOTAL?'rgba(195,155,255,.9)':'rgba(106,90,160,.55)';
    g2.beginPath();g2.arc(gx,gy,pr,0,7);g2.fill();
  }
  const ax=ox+px*cs,ay=oy+py*cs;
  g2.fillStyle='rgba(255,215,106,.09)';
  g2.beginPath();g2.moveTo(ax,ay);
  g2.arc(ax,ay,cs*2.8,ang-0.62,ang+0.62);g2.closePath();g2.fill();
  g2.save();g2.translate(ax,ay);g2.rotate(ang);
  g2.fillStyle='#ffd76a';
  g2.beginPath();
  g2.moveTo(cs*0.55,0);g2.lineTo(-cs*0.38,-cs*0.36);g2.lineTo(-cs*0.38,cs*0.36);
  g2.closePath();g2.fill();
  g2.restore();
  g2.strokeStyle='#3d4a63';g2.lineWidth=2;
  g2.strokeRect(ox-1,oy-1,cs*MW+2,cs*MH+2);

  const cov=TOTAL_FLOOR?Math.min(100,AI.knownFloor/TOTAL_FLOOR*100):0;
  g2.textAlign='left';g2.textBaseline='top';
  g2.font='bold '+Math.min(19,w*0.043)+'px monospace';
  g2.fillStyle='#7ef3ff';
  g2.fillText(`🤖 AI 탐사 데모 ${curProfile?curProfile.icon:'🧱'}`,12,8);
  g2.font=Math.min(13,w*0.032)+'px monospace';
  g2.fillStyle=gameState==='demoEnd'?'#8affa0':'#cfd8e3';
  g2.fillText(`${aiPhaseLabel()} · 지도 ${cov.toFixed(1)}%`,12,32);
  g2.textAlign='right';
  g2.fillStyle='#7ef3ff';
  g2.fillText(`💎 ${gotCount}`,w-12,8);
  g2.fillStyle='#cfd8e3';
  g2.fillText(`걸음 ${walkCount}${demoSpeed===3?' (스킵)':''}`,w-12,28);

  msgQueue=msgQueue.filter(m=>m.until>now);
  g2.textAlign='center';
  msgQueue.slice(-2).forEach((m,i,arr)=>{
    const fade=Math.min(1,(m.until-now)/400);
    g2.font='bold '+Math.min(13,w*0.033)+'px monospace';
    g2.fillStyle=`rgba(255,215,106,${0.95*fade})`;
    g2.fillText(m.txt,w/2,oy+cs*MH+8+i*16);
  });

  if(gameState==='demoEnd'){
    const pw=Math.min(w*0.86,420),ph=118;
    const pxp=(w-pw)/2,pyp=h*0.30;
    g2.fillStyle='rgba(6,8,14,.85)';
    g2.strokeStyle='#ffd76a';g2.lineWidth=2;
    g2.beginPath();
    if(g2.roundRect)g2.roundRect(pxp,pyp,pw,ph,12);else g2.rect(pxp,pyp,pw,ph);
    g2.fill();g2.stroke();
    g2.textAlign='center';
    g2.font='bold '+Math.min(21,w*0.05)+'px monospace';
    g2.fillStyle='#ffd76a';
    g2.fillText('🏆 AI 클리어!',w/2,pyp+16);
    g2.font=Math.min(14,w*0.034)+'px monospace';
    g2.fillStyle='#cfd8e3';
    g2.fillText(`⏱ ${mm}:${String(ss).padStart(2,'0')} · 지도 ${cov.toFixed(1)}% · 💎 ${gotCount}/${GEM_TOTAL}`,w/2,pyp+46);
    g2.fillStyle='#7ea8cc';
    g2.fillText('▼ 같은 던전을 직접 도전해 보세요',w/2,pyp+72);
  }
}

/* ============================================================
   시작/재시작
   ============================================================ */
function mobileBoot(){
  if(isCoarse){
    document.documentElement.requestFullscreen?.().catch(()=>{});
    reqWakeLock();
  }
}
$('startBtn').addEventListener('click',()=>{initAudio();mobileBoot();startGenWatch();});
$('quickBtn').addEventListener('click',()=>{
  initAudio();mobileBoot();
  genMapSync();beginPlay();
  if(!isCoarse)cv.requestPointerLock?.();
});
$('demoBtn').addEventListener('click',()=>{initAudio();mobileBoot();startDemo();});
$('againBtn').addEventListener('click',()=>{
  genMapSync();beginPlay();
  if(!isCoarse)cv.requestPointerLock?.();
});
function showResult(){
  setDrone(false);
  $('overlay').classList.remove('hidden');
  $('panelDesc').style.display='none';
  $('startBtn').classList.add('hidden');
  $('quickBtn').classList.add('hidden');
  $('demoBtn').classList.add('hidden');
  $('againBtn').classList.remove('hidden');
  const rt=$('resultTxt');rt.style.display='';
  const m=(clearTime/60)|0,s=(clearTime%60)|0;
  rt.innerHTML=`🏆 <b style="color:#ffd76a">탈출 성공!</b><br>소요 시간 ${m}:${String(s).padStart(2,'0')} · 보석 ${gotCount}/${GEM_TOTAL}`;
  refreshUI();
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&isCoarse&&gameState==='play')reqWakeLock();
});

/* ============================================================
   갱신
   ============================================================ */
function update(dt,now){
  if(aiActive){
    aiUpdate(dt,false);
  }else{
    if(keys.has('ArrowLeft')||vk.tl)ang-=ROT_SPD*dt;
    if(keys.has('ArrowRight')||vk.tr)ang+=ROT_SPD*dt;
    const dirX=Math.cos(ang),dirY=Math.sin(ang);
    const plX=-Math.sin(ang)*planeLen,plY=Math.cos(ang)*planeLen;
    let mvF=((keys.has('KeyW')||keys.has('ArrowUp'))?1:0)-((keys.has('KeyS')||keys.has('ArrowDown'))?1:0)
            +(vk.fwd?1:0)-(vk.back?1:0)+joyVec.f;
    let mvS=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+(vk.right?1:0)-(vk.left?1:0)+joyVec.s;
    const len=Math.hypot(mvF,mvS);
    if(len>1){mvF/=len;mvS/=len;}
    const vx=(dirX*mvF+(plX/planeLen)*mvS)*MOVE_SPD*dt;
    const vy=(dirY*mvF+(plY/planeLen)*mvS)*MOVE_SPD*dt;
    moveWithCollision(vx,vy);
    const moving=len>0.08;
    if(moving){
      bobPhase+=dt*9.5*Math.min(1,len);
      if(((bobPhase/Math.PI)|0)!==((lastStepPh/Math.PI)|0))sndStep();
      lastStepPh=bobPhase;
      bobAmt=Math.min(1,bobAmt+dt*6);
    }else bobAmt=Math.max(0,bobAmt-dt*6);
  }
  {
    const cx=px|0,cy=py|0;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
      if(dx*dx+dy*dy<=8){
        const gx=cx+dx,gy=cy+dy;
        if(gx>=0&&gy>=0&&gx<MW&&gy<MH)visited[gx+gy*MW]=1;
      }
    }
  }
  if(!lakeSeen&&waterNearby()){
    lakeSeen=true;
    pushMsg('🌊 지하호수… 검은 수면이 반짝인다');
    sndLap();
  }
  collectNearbyGems();
  const pdist=Math.hypot(px-portal.x,py-portal.y);
  if(pdist<0.8){
    if(gotCount>=GEM_TOTAL){
      gameState='win';clearTime=playTime;
      sndWin();vib([60,40,60]);
      document.exitPointerLock?.();
      aiActive=false;refreshAIBtns();
      showResult();
    }else if(!update.lw||now-update.lw>2500){
      update.lw=now;sndLocked();vib(35);
      pushMsg(`🔒 포털 잠김 — 남은 보석 ${GEM_TOTAL-gotCount}개`);
    }
  }
}

/* ============================================================
   1인칭 렌더링 (텍스처/스프라이트 ← engine-core.js 경유)
   ============================================================ */
function fogLv(d,flick){
  const f=1-d/(9.0*flick);
  return f<=0?0:Math.min(15,(f*16)|0);
}
function render(now){
  const t=now*0.001;
  const flick=0.94+0.05*Math.sin(t*9)+0.03*Math.sin(t*23+1.7);
  const hz=(IH/2+Math.sin(bobPhase)*3.2*bobAmt)|0;
  const ch=CEIL_H();
  const tFrame=(now/160)|0;
  const dirX=Math.cos(ang),dirY=Math.sin(ang);
  const plX=-Math.sin(ang)*planeLen,plY=Math.cos(ang)*planeLen;
  const rd0x=dirX-plX,rd0y=dirY-plY,rd1x=dirX+plX,rd1y=dirY+plY;
  const posZ=0.5*IH;

  const floorMain=THEME[dmode].floor;
  for(let y=0;y<IH;y++){
    const p=y-hz;
    if(p===0){for(let x=0;x<IW;x++)buf32[y*IW+x]=pack(0,0,0);continue;}
    let rowDist,tex;
    if(p>0){rowDist=posZ/p;tex=floorMain;}
    else{
      if(ch<1)rowDist=((0.5-ch)*IH)/(-p);
      else rowDist=posZ/(-p);
      tex=THEME[dmode].ceil;
    }
    const lv=fogLv(Math.abs(rowDist),flick);
    const tl=tex.levels[lv];
    let fx=px+rowDist*rd0x,fy=py+rowDist*rd0y;
    const sx=rowDist*(rd1x-rd0x)/IW,sy=rowDist*(rd1y-rd0y)/IW;
    let o=y*IW;
    if(p>0&&(wetG||waterG)){
      for(let x=0;x<IW;x++){
        const cxi=fx|0,cyi=fy|0;
        let arr=tl;
        if(cxi>=0&&cyi>=0&&cxi<MW&&cyi<MH){
          const ci=cyi*MW+cxi;
          if(waterG&&waterG[ci]){
            arr=WATER_FRAMES[(tFrame+cxi*5+cyi*3)&3].levels[Math.min(15,lv+1)];
          }else if(wetG&&wetG[ci]){
            arr=THEME.cave.wet.levels[Math.min(15,lv+2)];
          }
        }
        const tx=((fx-(fx|0))*TS)|0,ty=((fy-(fy|0))*TS)|0;
        buf32[o++]=arr[((ty&63)<<6)+(tx&63)];
        fx+=sx;fy+=sy;
      }
    }else{
      for(let x=0;x<IW;x++){
        const tx=((fx-(fx|0))*TS)|0,ty=((fy-(fy|0))*TS)|0;
        buf32[o++]=tl[((ty&63)<<6)+(tx&63)];
        fx+=sx;fy+=sy;
      }
    }
  }
  for(let x=0;x<IW;x++){
    const camX=2*x/IW-1;
    const rdx=dirX+plX*camX,rdy=dirY+plY*camX;
    let mx=px|0,my=py|0;
    const ddx=Math.abs(1/rdx),ddy=Math.abs(1/rdy);
    let stX,stY,sdx,sdy;
    if(rdx<0){stX=-1;sdx=(px-mx)*ddx;}else{stX=1;sdx=(mx+1-px)*ddx;}
    if(rdy<0){stY=-1;sdy=(py-my)*ddy;}else{stY=1;sdy=(my+1-py)*ddy;}
    let side=0,hit=false,guard=0;
    while(!hit&&guard++<96){
      if(sdx<sdy){sdx+=ddx;mx+=stX;side=0;}
      else{sdy+=ddy;my+=stY;side=1;}
      hit=(mx<0||my<0||mx>=MW||my>=MH)||grid[my*MW+mx]===1;
    }
    let perp=side===0?sdx-ddx:sdy-ddy;
    if(perp<0.01)perp=0.01;
    zbuf[x]=perp;
    let wallX=side===0?py+perp*rdy:px+perp*rdx;
    wallX-=Math.floor(wallX);
    let tx=(wallX*TS)|0;
    if((side===0&&rdx>0)||(side===1&&rdy<0))tx=TS-1-tx;
    const lineH=(IH/perp)|0;
    const bottom=hz+lineH/2;
    const top=hz-lineH*(ch-0.5);
    const visH=lineH*ch;
    const step=TS/visH;
    let y0=Math.max(0,Math.ceil(top)),y1=Math.min(IH,Math.ceil(bottom));
    let lv=fogLv(perp,flick);
    if(side===1)lv=Math.max(0,lv-3);
    const gi=my*MW+mx;
    const sty=styleG[gi]||0;
    if(sty===2&&dmode==='cave')lv=Math.max(lv,7);
    const tl=WALLTEX()[sty].levels[Math.min(15,lv)];
    let tp=(y0-top)*step;
    for(let y=y0;y<y1;y++){
      const ty=Math.min(TS-1,tp|0);tp+=step;
      buf32[y*IW+x]=tl[(ty<<6)+tx];
    }
  }
  const list=[];
  const invDet=1/(plX*dirY-dirX*plY);
  function addSpr(x,y,tex,opts={}){
    const rx=x-px,ry=y-py;
    const trX=invDet*(dirY*rx-dirX*ry);
    const trY=invDet*(-plY*rx+plX*ry);
    if(trY>0.1)list.push({trX,trY,tex,z:opts.z||0,hW:opts.hW||0.8,layer:opts.layer||0,
      glow:!!opts.glow,flip:!!opts.flip,front:!!opts.front});
  }
  for(const gm of gems)if(!gm.got)
    addSpr(gm.x,gm.y,sprGem,{z:0.24+0.06*Math.sin(t*3+gm.phase),hW:0.32,glow:false,layer:-1});
  const portHW=dmode==='cave'?0.56:0.95;
  addSpr(portal.x,portal.y,((now/300)|0)%2?sprPortalB:sprPortalA,
    {z:0,hW:portHW+0.03*Math.sin(t*2.4),glow:true});
  for(const tc of lights){
    if(tc.cry)
      addSpr(tc.x,tc.y,((now/260+tc.seed*9)|0)%2?sprCrystalB:sprCrystalA,{z:0,hW:0.36,glow:true});
    else
      addSpr(tc.x,tc.y,((now/130+tc.seed*7)|0)%2?sprTorchB:sprTorchA,{z:0.42,hW:0.62,glow:true});
  }
  for(const dc of decos)
    addSpr(dc.x,dc.y,sprStal,{z:0,hW:dc.hW,flip:dc.flip});
  if(gameState==='tour'&&TOUR&&TOUR.enc){
    const e=TOUR.enc,t=(performance.now()-e.t0)*tourSpeed;
    let k=1;
    if(e.phase===0)k=t/TOUR_APPEAR;
    else if(e.phase===2)k=1-(performance.now()-e.tOut)/TOUR_LEAVE;
    k=clampN(k,0.02,1);
    addSpr(e.x,e.y,e.tex[e.frame],
      {z:0,hW:e.baseHW*k*(1+0.035*Math.sin(t*0.006)),glow:false,front:true,layer:2});
  }
  list.sort((a,b)=>(a.layer-b.layer)||(b.trY-a.trY));
  for(const s of list){
    const scrX=(IW/2)*(1+s.trX/s.trY);
    const pixH=s.hW*IH/s.trY;
    const pixW=pixH*(s.tex.tw/s.tex.th);
    const bottom=hz+(IH/(2*s.trY))-s.z*IH/s.trY;
    const top=bottom-pixH;
    const x0=Math.max(0,Math.ceil(scrX-pixW/2)),x1=Math.min(IW-1,Math.floor(scrX+pixW/2));
    const y0=Math.max(0,Math.ceil(top)),y1=Math.min(IH-1,Math.floor(bottom));
    let lv=fogLv(s.trY,flick);if(s.glow)lv=Math.min(15,lv+8);
    const tl=s.tex.levels[lv],tw=s.tex.tw,th=s.tex.th;
    for(let x=x0;x<=x1;x++){
      if(!s.front&&s.trY>=zbuf[x]+0.14)continue;
      let tx=Math.min(tw-1,((x-(scrX-pixW/2))/pixW*tw)|0);
      if(s.flip)tx=tw-1-tx;
      for(let y=y0;y<=y1;y++){
        const ty=Math.min(th-1,((y-top)/pixH*th)|0);
        const c=tl[ty*tw+tx];
        if((c>>>24)>140)buf32[y*IW+x]=c;
      }
    }
  }
  ctx.putImageData(img,0,0);
  if(!vignette){
    vignette=ctx.createRadialGradient(IW/2,IH/2,IH*0.35,IW/2,IH/2,IW*0.62);
    vignette.addColorStop(0,'rgba(0,0,0,0)');
    vignette.addColorStop(1,'rgba(0,0,0,0.55)');
  }
  ctx.fillStyle=vignette;ctx.fillRect(0,0,IW,IH);
  if(dmode==='cave'){
    ctx.fillStyle='rgba(40,120,160,.05)';
    ctx.fillRect(0,0,IW,IH);
  }
  msgQueue=msgQueue.filter(m=>m.until>now);

  const CS=2.05*Math.min(uiS,0.95),mpW=MW*CS+10,mpH=MH*CS+10,mx0=IW-mpW-8,my0=8;
  ctx.fillStyle='rgba(5,6,10,.88)';ctx.fillRect(mx0,my0,mpW,mpH);
  ctx.strokeStyle='#8fa3bd';ctx.lineWidth=1;ctx.strokeRect(mx0+.5,my0+.5,mpW,mpH);
  for(let y2=0;y2<MH;y2++)for(let x2=0;x2<MW;x2++){
    if(!visited[x2+y2*MW])continue;
    const i2=x2+y2*MW;
    ctx.fillStyle=grid[i2]?'#9aa2ad':(waterG&&waterG[i2])?'#2b8dcc':'#3d4a63';
    ctx.fillRect(mx0+4+x2*CS,my0+4+y2*CS,CS,CS);
  }
  ctx.fillStyle='#7ef3ff';
  for(const gm of gems)if(!gm.got&&visited[(gm.x|0)+(gm.y|0)*MW])
    ctx.fillRect(mx0+4+gm.x*CS-1.5,my0+4+gm.y*CS-1.5,3,3);
  if(visited&&visited[(portal.x|0)+(portal.y|0)*MW]){
    ctx.fillStyle=gotCount>=GEM_TOTAL?'#c39bff':'#5a4a7a';
    ctx.fillRect(mx0+4+portal.x*CS-1.5,my0+4+portal.y*CS-1.5,3,3);
  }
  ctx.save();
  ctx.translate(mx0+4+px*CS,my0+4+py*CS);ctx.rotate(ang);
  ctx.fillStyle='#ffd76a';
  ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(-3,-2.6);ctx.lineTo(-3,2.6);
  ctx.closePath();ctx.fill();
  ctx.restore();

  if(gameState==='tour'&&TOUR&&TOUR.enc){drawEncNameTag(TOUR.enc,dirX,dirY,plX,plY,hz);if(TOUR.enc.kind==='hero')drawTourBattleHud(TOUR.enc);}
  drawResultBanner(now);
}

function drawResultBanner(now){
  if(!resultBanner||now>resultBanner.until){resultBanner=null;return;}
  const age=now-resultBanner.t0;
  const left=resultBanner.until-now;
  const a=Math.min(1,age/180,left/260);
  const pop=1+0.08*Math.sin(Math.min(1,age/220)*Math.PI);
  const w=Math.min(IW-28,280),h=86,x=(IW-w)/2,y=IH*0.42-h/2;
  const colors={ok:['rgba(18,50,26,','#9cff8a'],win:['rgba(60,44,12,','#ffd76a'],fail:['rgba(70,20,18,','#ff9b8a']};
  const c=colors[resultBanner.kind]||colors.ok;
  ctx.save();ctx.globalAlpha=a;ctx.translate(IW/2,y+h/2);ctx.scale(pop,pop);ctx.translate(-IW/2,-y-h/2);
  ctx.fillStyle=c[0]+'.92)';ctx.fillRect(x,y,w,h);
  ctx.strokeStyle=c[1];ctx.lineWidth=2;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  ctx.textAlign='center';ctx.textBaseline='middle';
  const titleFont=`bold ${Math.max(15,Math.round(IH*.043))}px monospace`;
  const subFont=`bold ${Math.max(10,Math.round(IH*.027))}px monospace`;
  ctx.font=titleFont;ctx.fillStyle=c[1];
  const titleLines=wrapCx(resultBanner.title,w-24,titleFont).slice(0,2);
  titleLines.forEach((line,i)=>ctx.fillText(line,IW/2,y+22+i*17));
  if(resultBanner.sub){
    ctx.font=subFont;ctx.fillStyle='#f4f1e8';
    const subLines=wrapCx(resultBanner.sub,w-24,subFont).slice(0,2);
    subLines.forEach((line,i)=>ctx.fillText(line,IW/2,y+56+i*13));
  }
  ctx.restore();
}

/* ============================================================
   부팅 & 메인 루프
   ============================================================ */
applyRes();
nextDungeon();        // ★ 초기 프로필 결정 (무작위 1~10, 현 단계 생성은 디폴트 미로)
genMapSync();
px=startPos.x;py=startPos.y;ang=startAng;
aiReset();
bootLoadTextures();   // 🎨 저장된 커스텀 텍스처 복원
refreshUI();

function autoStartTour(){
  if(gameState==='tour')return;
  if(codexReady())startTour();
  else setTimeout(autoStartTour,80);
}
requestAnimationFrame(autoStartTour);

let last=performance.now(),smoothDt=16,qCool=0;
function loop(now){
  updateDomHud();
  const dtms=Math.min(50,now-last);last=now;
  const dt=dtms/1000;
  smoothDt=smoothDt*0.94+dtms*0.06;
  if(gameState==='play'&&smoothDt>26&&now>qCool&&IW>240){
    PIX_BUDGET*=0.78;applyRes();smoothDt=16;qCool=now+2000;
  }
  if(gameState==='gen'){
    genTick(now);
    genRender(now);
    if(gen.doneAt&&now>gen.doneAt+900)beginPlay();
  }else if(gameState==='demo'){
    tryDrip(now);tryLap(now);
    const sub=DEMO_SUB[demoSpeed],ddt=1/60;
    for(let i=0;i<sub;i++){
      if(gameState!=='demo')break;
      demoTime+=ddt;
      aiUpdate(ddt,true);
      aiSense();
      if(!lakeSeen&&waterNearby()){
        lakeSeen=true;
        pushMsg('🌊 AI가 지하호수를 발견했다');
      }
      for(const gm of gems){
        if(gm.got)continue;
        if((px-gm.x)**2+(py-gm.y)**2<0.42*0.42){
          gm.got=true;gotCount++;sndPickup();vib(15);
          pushMsg(`💎 AI 보석 획득 (${gotCount}/${GEM_TOTAL})`);
        }
      }
      if(Math.hypot(px-portal.x,py-portal.y)<0.8&&gotCount>=GEM_TOTAL){
        gameState='demoEnd';
        sndWin();vib([60,40,60]);
        setDrone(false);
        updateDemoBar();
        break;
      }
    }
    renderTopDown(now);
  }else if(gameState==='demoEnd'){
    renderTopDown(now);
  }else if(gameState==='tour'){
    tryDrip(now);tryLap(now);
    tourUpdate(dt,now);
    render(now);
  }else{
    if(gameState==='play'){
      playTime+=dtms/1000;
      tryDrip(now);tryLap(now);
      update(dt,now);
    }
    render(now);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);