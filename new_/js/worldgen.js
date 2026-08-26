/* ══════════════════════════════════════════════════════════
   worldgen.js — 던전 생성 계층 (WFC · CA · BFS · 프로필)
   의존성: engine-core의 clampN (런타임 호출이라 로드 순서 무관)
           PixelCodex.DATA (던전 이름 표시용, 없으면 폴백)
   game.js가 읽는 값: dmode, caKey, curDun, curProfile, MW/MH, DX/DY
   ══════════════════════════════════════════════════════════ */
"use strict";

/* ────────────── 공용 격자 상수 ────────────── */
const MW=33,MH=33;
const DX=[0,1,0,-1],DY=[-1,0,1,0],OPP=[2,3,0,1];
let dmode='maze';

/* ════════════ WFC (미로 모드) ════════════ */
const TL=(n,e,s,w,wt)=>({s:[n,e,s,w],wt});
const TILES=[
  TL(0,0,0,0,24),TL(1,1,1,1,6),TL(0,1,0,1,3),TL(1,0,1,0,3),
  TL(1,1,0,0,3),TL(0,1,1,0,3),TL(0,0,1,1,3),TL(1,0,0,1,3),
  TL(1,1,1,0,1.2),TL(1,1,0,1,1.2),TL(1,0,1,1,1.2),TL(0,1,1,1,1.2),
  TL(1,0,0,0,1.0),TL(0,1,0,0,1.0),TL(0,0,1,0,1.0),TL(0,0,0,1,1.0),
];
const NT=TILES.length;
const COMP=TILES.map(t=>[0,1,2,3].map(d=>{
  const arr=[];
  for(let i=0;i<NT;i++)if(t.s[d]===TILES[i].s[OPP[d]])arr.push(i);
  return arr;
}));
class Solver{
  constructor(){
    this.poss=[];this.collapsed=new Uint8Array(MW*MH);
    this.val=new Int8Array(MW*MH).fill(-1);
    for(let i=0;i<MW*MH;i++)this.poss.push(Array.from({length:NT},(_,k)=>k));
    this.stack=[];this.failed=false;this.finished=false;
    this.lastCi=-1;this.lastT=0;this.collapsedCount=0;
  }
  assign(ci,t){
    this.poss[ci]=[t];this.val[ci]=t;this.collapsed[ci]=1;
    this.collapsedCount++;this.lastCi=ci;this.lastT=performance.now();
    this.stack.push(ci);
    return this.propagate();
  }
  propagate(){
    while(this.stack.length){
      const ci=this.stack.pop();
      const cx=ci%MW,cy=(ci/MW)|0,pc=this.poss[ci];
      for(let d=0;d<4;d++){
        const nx=cx+DX[d],ny=cy+DY[d];
        if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
        const ni=ny*MW+nx;
        if(this.collapsed[ni])continue;
        const pn=this.poss[ni];
        if(pn.length===1)continue;
        const np=pn.filter(t2=>{
          for(const t of pc)if(COMP[t][d].indexOf(t2)>=0)return true;
          return false;
        });
        if(np.length===0){this.failed=true;return false;}
        if(np.length<pn.length){
          this.poss[ni]=np;this.stack.push(ni);
          if(np.length===1){this.val[ni]=np[0];this.collapsed[ni]=1;this.collapsedCount++;}
        }
      }
    }
    return true;
  }
  weightedPick(arr){
    let tot=0;for(const t of arr)tot+=TILES[t].wt;
    let r=Math.random()*tot;
    for(const t of arr){r-=TILES[t].wt;if(r<=0)return t;}
    return arr[arr.length-1];
  }
  step(){
    if(this.failed)return'fail';
    if(this.finished)return'done';
    let best=Infinity,cand=[];
    for(let i=0;i<MW*MH;i++){
      const L=this.poss[i].length;
      if(L<=1)continue;
      if(L<best){best=L;cand=[i];}else if(L===best)cand.push(i);
    }
    if(!cand.length){this.finished=true;return'done';}
    const ci=cand[(Math.random()*cand.length)|0];
    if(!this.assign(ci,this.weightedPick(this.poss[ci])))return'fail';
    return'ok';
  }
}
function seedAnchors(s){
  const cx=MW>>1,cy=MH>>1,pts=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)pts.push([cx+dx,cy+dy]);
  pts.push([cx,4],[cx,MH-5],[4,cy],[MW-5,cy]);
  for(const[x,y]of pts)s.assign(y*MW+x,1);
}

/* ════════════ 🕳️ CA 동굴 생성 — 프리셋 3종 ════════════
   규칙: 다음 상태 = (자신 + 이웃 벽 수) >= 5 ? 벽 : 바닥  (클래식 4/5 규칙) */
const CA_PRESETS={
  tunnel:{key:'tunnel',label:'좁은 동굴',icon:'🪨',
    init:.56,iters:5,minSize:100,minDia:24,pocket:0,
    tip:'촘촘히 엮인 미로형 터널'},
  hall:{key:'hall',label:'대공동',icon:'🏛️',
    init:.40,iters:4,minSize:200,minDia:16,pocket:0,
    tip:'넓은 홀과 지하호수'},
  sponge:{key:'sponge',label:'해면질',icon:'🧽',
    init:.47,iters:2,minSize:150,minDia:18,pocket:34,
    tip:'무작위 포켓이 가득한 스위스 치즈 지형'},
};
const CA_KEYS=['tunnel','hall','sponge'];
let caKey='tunnel';     // ← 프로필(nextDungeon)이 덮어쓰므로 초기값은 불문

function caveRand(p){
  const c=new Uint8Array(MW*MH);
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)
    c[y*MW+x]=(x===0||y===0||x===MW-1||y===MH-1||Math.random()<p)?1:0;
  return c;
}
function caveStep(src){
  const out=new Uint8Array(MW*MH);
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    let n=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy)continue;
      const nx=x+dx,ny=y+dy;
      if(nx<0||ny<0||nx>=MW||ny>=MH||src[ny*MW+nx])n++;
    }
    out[y*MW+x]=(src[y*MW+x]+n)>=5?1:0;
  }
  for(let x=0;x<MW;x++){out[x]=1;out[(MH-1)*MW+x]=1;}
  for(let y=0;y<MH;y++){out[y*MW]=1;out[y*MW+MW-1]=1;}
  return out;
}
function carvePockets(cells,K){
  for(let k=0;k<K;k++){
    let x=1+((Math.random()*(MW-2))|0);
    let y=1+((Math.random()*(MH-2))|0);
    const len=3+((Math.random()*6)|0);
    for(let s=0;s<len;s++){
      cells[y*MW+x]=0;
      x=clampN(x+((Math.random()*3)|0)-1,1,MW-2);
      y=clampN(y+((Math.random()*3)|0)-1,1,MH-2);
    }
  }
}
function largestRegion(cells){
  const reg=new Int16Array(MW*MH).fill(-1);
  let best=-1,bestSize=0,rn=0;
  for(let i=0;i<MW*MH;i++){
    if(cells[i]||reg[i]>=0)continue;
    let size=0;
    const q=[i];reg[i]=rn;
    while(q.length){
      const c=q.pop();size++;
      const x=c%MW,y=(c/MW)|0;
      for(let k=0;k<4;k++){
        const nx=x+DX[k],ny=y+DY[k];
        if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
        const ni=ny*MW+nx;
        if(!cells[ni]&&reg[ni]<0){reg[ni]=rn;q.push(ni);}
      }
    }
    if(size>bestSize){bestSize=size;best=rn;}
    rn++;
  }
  return{reg,best,bestSize};
}
const openOf=cells=>{const o=[];for(let i=0;i<MW*MH;i++)if(!cells[i])o.push(i);return o;};
function bfsOn(cells,start){
  const dist=new Int16Array(MW*MH).fill(-1);
  const q=[start];dist[start]=0;let far=start,fd=0;
  while(q.length){
    const c=q.shift(),d=dist[c],x=c%MW,y=(c/MW)|0;
    if(d>fd){fd=d;far=c;}
    for(let k=0;k<4;k++){
      const nx=x+DX[k],ny=y+DY[k];
      if(nx<0||ny<0||nx>=MW||ny>=MH)continue;
      const ni=ny*MW+nx;
      if(!cells[ni]&&dist[ni]<0){dist[ni]=d+1;q.push(ni);}
    }
  }
  return{dist,far,fd};
}
function buildCave(P){
  for(let a=0;a<60;a++){
    let cells=caveRand(P.init);
    const frames=[cells.slice()];
    for(let i=0;i<P.iters;i++){cells=caveStep(cells);frames.push(cells.slice());}
    if(P.pocket){carvePockets(cells,P.pocket);frames.push(cells.slice());}
    const{reg,best,bestSize}=largestRegion(cells);
    if(bestSize<P.minSize)continue;
    const fin=new Uint8Array(MW*MH);
    for(let i=0;i<MW*MH;i++)fin[i]=(!cells[i]&&reg[i]===best)?0:1;
    const st=openOf(fin)[0];
    if(st===undefined)continue;
    const d1=bfsOn(fin,st);
    const d2=bfsOn(fin,d1.far);
    if(d2.fd<P.minDia)continue;
    return{frames,final:fin};
  }
  return null;
}

/* ══════════════════════════════════════════════════════════
   🗺️ 던전 프로필 (시스템 주도 — 선택 UI 없음)
     gen  : 'maze'(WFC) | 'cave'(CA)
     caKey: 'tunnel'(좁은) | 'hall'(대공동) | 'sponge'(해면질)
     규칙: 미지정({}) → 미로 / 동굴인데 caKey 생략 → 좁은 동굴
     ▶ 추후 상황별 분류는 표의 해당 번호만 채움.
       예) 7:{gen:'cave',caKey:'hall'}
   ══════════════════════════════════════════════════════════ */
const GEN_ICON ={maze:'🧱',tunnel:'🪨',hall:'🏛️',sponge:'🧽'};
const GEN_LABEL={maze:'미로 던전',tunnel:'좁은 동굴',hall:'대공동',sponge:'해면질'};
/* 현 단계: 10개 던전 전부 디폴트(미로) */
const GEN_TABLE={1:{},2:{},3:{},4:{},5:{},6:{},7:{},8:{},9:{},10:{}};

let curDun=0, curProfile=null;

function resolveProfile(no){
  const t  =GEN_TABLE[no]||{};
  const gen=(t.gen==='cave')?'cave':'maze';
  const key=(gen==='cave'&&['tunnel','hall','sponge'].includes(t.caKey))?t.caKey:'tunnel';
  const gk =gen==='cave'?key:'maze';
  const dg =(window.PixelCodex&&window.PixelCodex.DATA)
           ?window.PixelCodex.DATA.dungeons.find(d=>d.no===no):null;
  return{no,dmode:gen,caKey:key,
    icon:GEN_ICON[gk],genLabel:GEN_LABEL[gk],
    dunName:dg?dg.name:'심연의 차원틈',hue:dg?dg.hue:'#7ef3ff'};
}
function nextDungeon(no=null){
  curDun=no ? Math.max(1, Math.min(10, Number(no)||1)) : 1+((Math.random()*10)|0);
  curProfile=resolveProfile(curDun);
  dmode=curProfile.dmode;               // 생성기·렌더러가 읽는 전역 세팅
  caKey=curProfile.caKey;
  syncProfileUI();
  return curProfile;
}
function syncProfileUI(){               // 구 syncPresetUI 대체 (읽기전용 표시)
  if(!curProfile)return;
  const md=document.getElementById('modeDesc');
  if(md)md.textContent=`${curProfile.no}. ${curProfile.dunName} · ${curProfile.genLabel}`;
  const mi=document.getElementById('mMapInfo');
  if(mi)mi.textContent=`🗺️ ${curProfile.no}. ${curProfile.dunName}`;
}