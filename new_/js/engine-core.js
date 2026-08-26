/* ══════════════════════════════════════════════════════════
   engine-core.js — 수학 · SFX · 텍스처 베이커 · 절차 텍스처/스프라이트 공장 · 테마
   의존성: 없음 (game.js / worldgen.js 보다 먼저 로드될 것)
   ══════════════════════════════════════════════════════════ */
"use strict";

/* ────────────── 상수 & 수학 유틸 ────────────── */
const TS=64;
const pack=(r,g,b,a=255)=>((a<<24)|(b<<16)|(g<<8)|r)>>>0;
const RND=(a,b)=>a+Math.random()*(b-a);
const clampN=(v,a,b)=>v<a?a:v>b?b:v;
const normAng=a=>{a=(a+Math.PI)%(Math.PI*2);if(a<0)a+=Math.PI*2;return a-Math.PI;};

/* ────────────── WebAudio 기초 (원본 '사운드' 섹션에서 이동) ────────────── */
let sndOn=true;
let AC=null;
function initAudio(){
  if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  if(AC&&AC.state==='suspended')AC.resume();
}
function beep(f,dur,type='square',vol=.12,slide=0,delay=0){
  if(!AC||!sndOn)return;
  const t0=AC.currentTime+delay;
  const o=AC.createOscillator(),gN=AC.createGain();
  o.type=type;o.frequency.setValueAtTime(f,t0);
  if(slide)o.frequency.exponentialRampToValueAtTime(slide,t0+dur);
  gN.gain.setValueAtTime(vol,t0);
  gN.gain.exponentialRampToValueAtTime(.001,t0+dur);
  o.connect(gN).connect(AC.destination);o.start(t0);o.stop(t0+dur+.02);
}
const sndPickup=()=>{beep(880,.09,'square',.1);beep(1318,.16,'square',.1,0,.07);};
const sndLocked=()=>beep(160,.25,'sawtooth',.08,90);
const sndWin=()=>{[523,659,784,1046,1318].forEach((f,i)=>beep(f,.22,'triangle',.12,0,i*.12));};
const vib=p=>{try{navigator.vibrate&&navigator.vibrate(p);}catch(e){}};

/* ────────────── 안개 16단계 프리베이크 (렌더러와 세트) ────────────── */
function makeLevels(w,h,drawFn){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d');g.imageSmoothingEnabled=false;drawFn(g,w,h);
  const base=new Uint32Array(g.getImageData(0,0,w,h).data.buffer);
  const n=w*h,levels=[];
  for(let l=0;l<16;l++){
    const f=l/15,arr=new Uint32Array(n);
    for(let i=0;i<n;i++){
      const v=base[i];
      arr[i]=pack(((v&255)*f)|0,(((v>>>8)&255)*f)|0,(((v>>>16)&255)*f)|0,(v>>>24)&255);
    }
    levels.push(arr);
  }
  return{levels,tw:w,th:h};
}

/* ────────────── 미로용 텍스처 ────────────── */
const texBrick=makeLevels(TS,TS,g=>{
  g.fillStyle='#232028';g.fillRect(0,0,TS,TS);
  for(let ry=0;ry<8;ry++)for(let rx=0;rx<4;rx++){
    const off=(ry%2)*8,x=rx*16-off,y=ry*8,t=RND(-14,14)|0;
    g.fillStyle=`rgb(${118+t},${68+t*0.6|0},${54+t*0.5|0})`;g.fillRect(x+1,y+1,14,6);
    g.fillStyle='rgba(255,255,255,.08)';g.fillRect(x+1,y+1,14,1);
    g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x+1,y+6,14,1);
  }
  for(let i=0;i<220;i++){
    g.fillStyle=Math.random()<.5?'rgba(0,0,0,.14)':'rgba(255,255,255,.05)';
    g.fillRect(Math.random()*TS|0,Math.random()*TS|0,1,1);
  }
});
const texMoss=makeLevels(TS,TS,g=>{
  g.fillStyle='#191b20';g.fillRect(0,0,TS,TS);
  for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){
    const t=RND(-10,10)|0,v=88+t;
    g.fillStyle=`rgb(${v},${v+4},${v-6})`;g.fillRect(sx*16+1,sy*16+1,14,14);
    g.fillStyle='rgba(0,0,0,.3)';
    g.fillRect(sx*16+1,sy*16+13,14,2);g.fillRect(sx*16+13,sy*16+1,2,14);
  }
  for(let i=0;i<26;i++){
    const x=RND(0,TS),y=RND(0,TS*0.7),r=RND(2,6);
    g.fillStyle=`rgba(${50+RND(0,30)|0},${110+RND(0,40)|0},60,.5)`;
    g.beginPath();g.arc(x,y,r,0,7);g.fill();
  }
});
const texDoor=makeLevels(TS,TS,g=>{
  g.fillStyle='#171310';g.fillRect(0,0,TS,TS);
  for(let p=0;p<4;p++){
    const t=RND(-8,8)|0;
    g.fillStyle=`rgb(${104+t},${72+t*0.6|0},${44+t*0.4|0})`;g.fillRect(p*16+2,2,12,60);
    g.strokeStyle='rgba(0,0,0,.35)';
    for(let i=0;i<4;i++){g.beginPath();g.moveTo(p*16+4+i*3,RND(4,58));g.lineTo(p*16+4+i*3,RND(6,60));g.stroke();}
  }
  g.fillStyle='#3a3f47';g.fillRect(0,10,TS,6);g.fillRect(0,48,TS,6);
  g.fillStyle='#20242a';
  for(const yy of[13,51])for(let x=6;x<TS;x+=12)g.fillRect(x,yy,3,3);
  g.strokeStyle='#c9a13b';g.lineWidth=3;g.beginPath();g.arc(32,32,6,0,7);g.stroke();
});

/* ────────────── 동굴용 텍스처 ────────────── */
function rockBase(g,base,dark,light){
  g.fillStyle=base;g.fillRect(0,0,TS,TS);
  for(let i=0;i<46;i++){
    const x=RND(-6,TS),y=RND(-6,TS),rx=RND(5,16),ry=RND(4,12);
    g.fillStyle=Math.random()<.5?dark:light;
    g.beginPath();g.ellipse(x,y,rx,ry,RND(0,3),0,7);g.fill();
  }
  g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=1.4;
  for(let i=0;i<7;i++){
    let x=RND(0,TS),y=RND(0,TS);
    g.beginPath();g.moveTo(x,y);
    for(let s=0;s<5;s++){x+=RND(-11,11);y+=RND(-9,9);g.lineTo(x,y);}
    g.stroke();
  }
  for(let i=0;i<240;i++){
    g.fillStyle=Math.random()<.55?'rgba(0,0,0,.18)':'rgba(255,255,255,.05)';
    g.fillRect(Math.random()*TS|0,Math.random()*TS|0,1,1);
  }
}
const texRockA=makeLevels(TS,TS,g=>rockBase(g,'#26232b','#1d1a21','#332f3a'));
const texRockB=makeLevels(TS,TS,g=>{
  rockBase(g,'#20242a','#181c22','#2b313c');
  for(let i=0;i<10;i++){
    g.fillStyle=`rgba(60,${120+RND(0,40)|0},110,.16)`;
    g.beginPath();g.arc(RND(0,TS),RND(0,TS),RND(3,9),0,7);g.fill();
  }
});
const texVein=makeLevels(TS,TS,g=>{
  rockBase(g,'#232030','#1a1826','#302b40');
  for(let v=0;v<3;v++){
    let x=RND(4,TS-4),y=-4;
    const pts=[[x,y]];
    while(y<TS+4){y+=RND(7,13);x+=RND(-9,9);pts.push([x,y]);}
    g.strokeStyle='rgba(90,220,255,.28)';g.lineWidth=6;g.lineJoin='round';
    g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();
    g.strokeStyle='rgba(140,240,255,.85)';g.lineWidth=2.4;
    g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();
    g.strokeStyle='rgba(230,255,255,.95)';g.lineWidth=1;
    g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.stroke();
  }
});
function floorBase(g,base,spot){
  g.fillStyle=base;g.fillRect(0,0,TS,TS);
  for(let sy=0;sy<4;sy++)for(let sx=0;sx<2;sx++){
    const t=RND(-7,7)|0;
    g.fillStyle=`rgba(${spot[0]+t},${spot[1]+t},${spot[2]+t},.5)`;
    g.beginPath();g.ellipse(RND(0,TS),RND(0,TS),RND(6,15),RND(4,10),RND(0,3),0,7);g.fill();
  }
  for(let i=0;i<70;i++){
    g.fillStyle=`rgba(${140+RND(0,50)|0},${135+RND(0,45)|0},${125+RND(0,40)|0},.13)`;
    g.fillRect(Math.random()*TS|0,Math.random()*TS|0,2,1);
  }
  for(let i=0;i<140;i++){
    g.fillStyle=Math.random()<.5?'rgba(0,0,0,.22)':'rgba(255,255,255,.04)';
    g.fillRect(Math.random()*TS|0,Math.random()*TS|0,1,1);
  }
}
const texFloor=makeLevels(TS,TS,g=>floorBase(g,'#101216',[40,44,54]));
const texCaveFloor=makeLevels(TS,TS,g=>floorBase(g,'#0e1114',[34,40,44]));
const texWet=makeLevels(TS,TS,g=>{
  g.fillStyle='#06090e';g.fillRect(0,0,TS,TS);
  for(let i=0;i<9;i++){
    g.strokeStyle=`rgba(90,210,255,${RND(.08,.2)})`;
    g.lineWidth=RND(1,2.4);
    const y=RND(0,TS);
    g.beginPath();g.moveTo(RND(-8,20),y);
    g.bezierCurveTo(RND(20,44),y+RND(-4,4),RND(44,60),y+RND(-4,4),RND(56,72),y+RND(-2,2));
    g.stroke();
  }
  for(let i=0;i<12;i++){
    g.fillStyle='rgba(190,245,255,.35)';
    g.fillRect(Math.random()*TS|0,Math.random()*TS|0,1,1);
  }
});

/* ────────────── 🌊 물 애니메이션 프레임 (4프레임 × 16단계) ────────────── */
const WATER_FRAMES=[];
for(let f=0;f<4;f++){
  WATER_FRAMES.push(makeLevels(TS,TS,g=>{
    g.fillStyle='#081420';g.fillRect(0,0,TS,TS);
    for(let i=0;i<5;i++){
      g.fillStyle='rgba(3,8,15,.85)';
      g.beginPath();g.ellipse(RND(0,TS),RND(0,TS),RND(8,18),RND(6,12),RND(0,3),0,7);g.fill();
    }
    for(let band=0;band<7;band++){
      const ph=f/4*Math.PI*2+band*1.7;
      const yB=band*9+((f*2)%9);
      g.strokeStyle=`rgba(90,200,255,${(.05+.05*Math.sin(ph)).toFixed(3)})`;
      g.lineWidth=.8+Math.sin(ph)*.6+1;
      g.beginPath();
      for(let x=0;x<=TS;x+=4){
        const y=yB+Math.sin(x*.11+ph)*2.4;
        x===0?g.moveTo(x,y):g.lineTo(x,y);
      }
      g.stroke();
    }
    for(let i=0;i<10;i++){
      if(Math.sin(f/4*Math.PI*2+i*1.3)>0.15){
        g.fillStyle='rgba(215,248,255,.5)';
        g.fillRect(Math.random()*TS|0,Math.random()*TS|0,1,1);
      }
    }
  }));
}

/* ────────────── 천장 텍스처 ────────────── */
const texCeil=makeLevels(TS,TS,g=>{
  g.fillStyle='#0d0e13';g.fillRect(0,0,TS,TS);
  g.strokeStyle='rgba(255,255,255,.05)';
  for(let i=0;i<8;i++){g.beginPath();g.moveTo(i*8,0);g.lineTo(i*8,TS);g.stroke();}
  for(let i=0;i<100;i++){g.fillStyle='rgba(0,0,0,.3)';g.fillRect(Math.random()*TS|0,Math.random()*TS|0,2,1);}
});
const texCaveCeil=makeLevels(TS,TS,g=>{
  g.fillStyle='#0a0b10';g.fillRect(0,0,TS,TS);
  g.fillStyle='rgba(0,0,0,.5)';
  for(let i=0;i<12;i++){
    const x=RND(0,TS),w=RND(3,8),h=RND(6,18);
    g.beginPath();g.moveTo(x-w/2,0);g.lineTo(x+w/2,0);g.lineTo(x,h);g.closePath();g.fill();
  }
  g.strokeStyle='rgba(180,200,220,.05)';
  for(let i=0;i<10;i++){
    const x=RND(0,TS);
    g.beginPath();g.moveTo(x,0);g.quadraticCurveTo(x+RND(-6,6),TS*.4,x+RND(-10,10),RND(30,60));g.stroke();
  }
});

/* ────────────── 🎨 외부 이미지 → 게임 텍스처 변환기 ────────────── */
function texFromImage(src){
  const c=document.createElement('canvas');c.width=TS;c.height=TS;
  const g=c.getContext('2d');
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  const sw=src.naturalWidth||src.width||TS,sh=src.naturalHeight||src.height||TS;
  const side=Math.min(sw,sh);
  g.drawImage(src,(sw-side)/2,(sh-side)/2,side,side,0,0,TS,TS);
  const p=g.getImageData(0,0,TS,TS);
  for(let i=3;i<p.data.length;i+=4)p.data[i]=255;
  const base=new Uint32Array(p.data.buffer);
  const n=TS*TS,levels=[];
  for(let l=0;l<16;l++){
    const f=l/15,arr=new Uint32Array(n);
    for(let i=0;i<n;i++){
      const v=base[i];
      arr[i]=pack(((v&255)*f)|0,(((v>>>8)&255)*f)|0,(((v>>>16)&255)*f)|0,255);
    }
    levels.push(arr);
  }
  return{tex:{levels,tw:TS,th:TS},canvas:c};
}
function texFromFile(file,cb){
  if(!file||!file.type||!file.type.startsWith('image/'))return false;
  const url=URL.createObjectURL(file),im=new Image();
  im.onload=()=>{cb(texFromImage(im));URL.revokeObjectURL(url);};
  im.onerror=()=>URL.revokeObjectURL(url);
  im.src=url;
  return true;
}

/* ────────────── 게임 오브젝트 스프라이트 ────────────── */
const sprGem=makeLevels(64,64,g=>{
  g.beginPath();g.moveTo(32,6);g.lineTo(56,32);g.lineTo(32,58);g.lineTo(8,32);g.closePath();
  g.fillStyle='#27d7ff';g.fill();g.lineWidth=2;g.strokeStyle='#0a5f85';g.stroke();
  g.beginPath();g.moveTo(32,6);g.lineTo(44,32);g.lineTo(20,32);g.closePath();g.fillStyle='#bdf6ff';g.fill();
  g.beginPath();g.moveTo(32,58);g.lineTo(48,36);g.lineTo(16,36);g.closePath();g.fillStyle='#159bc4';g.fill();
  g.strokeStyle='rgba(255,255,255,.85)';g.lineWidth=2;
  g.beginPath();g.moveTo(24,14);g.lineTo(24,24);g.moveTo(19,19);g.lineTo(29,19);g.stroke();
});
function drawPortal(g,alt){
  g.fillStyle='#0a0618';g.beginPath();g.ellipse(32,84,24,8,0,0,7);g.fill();
  g.fillStyle='#3c4250';
  g.beginPath();g.moveTo(14,88);g.lineTo(50,88);g.lineTo(44,72);g.lineTo(20,72);g.closePath();g.fill();
  g.fillStyle=alt?'#5a2fd8':'#6a3cff';g.beginPath();g.ellipse(32,38,22,30,0,0,7);g.fill();
  g.fillStyle=alt?'#8f6cf5':'#a98cff';g.beginPath();g.ellipse(32,38,16,24,0,0,7);g.fill();
  g.fillStyle='#150a33';g.beginPath();g.ellipse(32,38,10,17,0,0,7);g.fill();
  g.fillStyle=alt?'#e6dbff':'#fff';
  for(let i=0;i<7;i++)g.fillRect(24+Math.random()*16|0,20+Math.random()*36|0,2,2);
}
const sprPortalA=makeLevels(64,96,g=>drawPortal(g,false));
const sprPortalB=makeLevels(64,96,g=>drawPortal(g,true));
function drawTorch(g,alt){
  g.fillStyle='#4a3018';g.fillRect(29,46,6,38);
  g.fillStyle='#6e6e78';g.fillRect(27,50,10,4);g.fillRect(27,74,10,4);
  g.fillStyle='#ff8c1a';g.beginPath();g.ellipse(32,alt?34:36,10,alt?15:13,alt?.25:-.2,0,7);g.fill();
  g.fillStyle='#ffc93a';g.beginPath();g.ellipse(32,alt?33:35,6,9,0,0,7);g.fill();
  g.fillStyle='#fff3b0';g.beginPath();g.ellipse(32,37,3,5,0,0,7);g.fill();
}
const sprTorchA=makeLevels(64,96,g=>drawTorch(g,false));
const sprTorchB=makeLevels(64,96,g=>drawTorch(g,true));
function drawCrystal(g,alt){
  const shard=(cx,top,w,col,col2)=>{
    g.beginPath();g.moveTo(cx-w,88);g.lineTo(cx,top);g.lineTo(cx+w,88);g.closePath();
    g.fillStyle=col;g.fill();
    g.beginPath();g.moveTo(cx-w,88);g.lineTo(cx,top);g.lineTo(cx,88);g.closePath();
    g.fillStyle=col2;g.fill();
  };
  shard(22,alt?40:46,9,'#1899c4','rgba(160,240,255,.75)');
  shard(36,alt?18:24,11,'#27c2ee','rgba(220,255,255,.9)');
  shard(48,alt?46:52,8,'#1590b8','rgba(150,235,255,.7)');
  g.fillStyle='rgba(255,255,255,.9)';
  g.fillRect(34,alt?24:30,2,10);g.fillRect(40,34,2,8);
  g.fillStyle='rgba(90,220,255,.25)';
  g.beginPath();g.ellipse(35,89,20,4,0,0,7);g.fill();
}
const sprCrystalA=makeLevels(64,96,g=>drawCrystal(g,false));
const sprCrystalB=makeLevels(64,96,g=>drawCrystal(g,true));
const sprStal=makeLevels(64,96,g=>{
  g.beginPath();g.moveTo(18,94);g.lineTo(32,10);g.lineTo(46,94);g.closePath();
  g.fillStyle='#33303c';g.fill();
  g.beginPath();g.moveTo(32,10);g.lineTo(46,94);g.lineTo(32,94);g.closePath();
  g.fillStyle='#211f29';g.fill();
  g.strokeStyle='rgba(255,255,255,.10)';g.lineWidth=1.5;
  g.beginPath();g.moveTo(26,86);g.lineTo(31,22);g.stroke();
  g.beginPath();g.moveTo(12,94);g.lineTo(20,52);g.lineTo(26,94);g.closePath();
  g.fillStyle='#2a2732';g.fill();
});

/* ────────────── 🎨 테마 레지스트리 (텍스처 편집기가 갈아끼우는 창구) ────────────── */
const ORIG={   // 공장 기본값 보관 (복원용)
  cave:{wall:[texRockA,texRockB,texVein],floor:texCaveFloor,ceil:texCaveCeil,wet:texWet},
  maze:{wall:[texBrick,texMoss,texDoor],floor:texFloor,ceil:texCeil},
};
const THEME={  // 실제 사용 ← 편집 시 이쪽이 교체됨
  cave:{wall:[texRockA,texRockB,texVein],floor:texCaveFloor,ceil:texCaveCeil,wet:texWet},
  maze:{wall:[texBrick,texMoss,texDoor],floor:texFloor,ceil:texCeil},
};