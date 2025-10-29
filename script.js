// Patched loader: tries multiple filenames/extensions and warns if none load
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  const startBtn = document.getElementById('startBtn');
  const startScreen = document.getElementById('startScreen');
  const scoreEl = document.getElementById('score');
  const timerEl = document.getElementById('timer');
  const menuBtn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  const soundToggle = document.getElementById('soundToggle');
  const hapticsToggle = document.getElementById('hapticsToggle');
  const reloadBtn = document.getElementById('reloadBtn');
  const warn = document.getElementById('warn');

  let running=false, score=0, timeLeft=60, lastTime=0;
  let targets=[], particles=[], streams=[], touchActive=false, aimX=0, aimY=0;

  function resize(){const W=canvas.width=Math.floor(innerWidth*dpr);const H=canvas.height=Math.floor(innerHeight*dpr);
    canvas.style.width=`${Math.floor(W/dpr)}px`;canvas.style.height=`${Math.floor(H/dpr)}px`;ctx.setTransform(dpr,0,0,dpr,0,0);}
  addEventListener('resize', resize, {passive:true}); resize();

  function rand(a,b){return a+Math.random()*(b-a)}

  class Target{
    constructor(image){
      this.image=image;
      const ratio=image.naturalHeight/image.naturalWidth||1.4;
      this.w=Math.min(220,Math.max(120, innerWidth*0.42));
      this.h=this.w*ratio;
      this.x=rand(10, innerWidth-this.w-10);
      this.y=rand(80, Math.max(90, innerHeight-this.h-120));
      this.vx=rand(-60,60); this.vy=rand(-30,30);
      this.wet=0; this.comboGrace=0; this.hitAlpha=0;
    }
    update(dt){
      this.x+=this.vx*dt; this.y+=this.vy*dt;
      if(this.x<=8||this.x+this.w>=innerWidth-8) this.vx*=-1;
      if(this.y<=70||this.y+this.h>=innerHeight-90) this.vy*=-1;
      this.vx*=(1-0.05*dt); this.vy*=(1-0.05*dt);
      this.comboGrace=Math.max(0,this.comboGrace-dt);
      this.hitAlpha=Math.max(0,this.hitAlpha-dt*2);
    }
    draw(){
      ctx.save(); ctx.shadowColor='rgba(0,0,0,.35)'; ctx.shadowBlur=20; ctx.shadowOffsetY=6;
      ctx.drawImage(this.image,this.x,this.y,this.w,this.h); ctx.restore();
      if(this.wet>0){const g=ctx.createLinearGradient(this.x,this.y,this.x+this.w,this.y+this.h);
        g.addColorStop(0,`rgba(84,210,255,${0.35*this.wet})`); g.addColorStop(1,`rgba(154,107,255,${0.30*this.wet})`);
        ctx.fillStyle=g; ctx.fillRect(this.x,this.y,this.w,this.h);}
      if(this.hitAlpha>0){ctx.fillStyle=`rgba(255,255,255,${0.35*this.hitAlpha})`; ctx.fillRect(this.x,this.y,this.w,this.h);}
    }
    contains(px,py){return px>=this.x&&px<=this.x+this.w&&py>=this.y&&py<=this.y+this.h}
  }
  class Particle{constructor(x,y,vx,vy,life){this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.life=life;this.maxLife=life}
    update(dt){this.x+=this.vx*dt;this.y+=this.vy*dt;this.vy+=800*dt;this.life-=dt}
    draw(){const a=Math.max(0,this.life/this.maxLife);ctx.fillStyle=`rgba(84,210,255,${a})`;ctx.beginPath();ctx.arc(this.x,this.y,3,0,Math.PI*2);ctx.fill()}}
  class Stream{constructor(x,y){this.x=x;this.y=y;this.life=.15;this.points=[]}
    update(dt){this.life-=dt;this.points.push({x:this.x,y:this.y});if(this.points.length>12)this.points.shift()}
    draw(){if(this.points.length<2)return;ctx.lineWidth=6;ctx.lineCap='round';ctx.strokeStyle='rgba(84,210,255,.6)';ctx.beginPath();
      for(let i=0;i<this.points.length;i++){const p=this.points[i];if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)};ctx.stroke()}}

  function fire(x,y){
    streams.push(new Stream(x,y));
    for(let i=0;i<14;i++){const a=rand(0,Math.PI*2),s=rand(100,260);particles.push(new Particle(x,y,Math.cos(a)*s,Math.sin(a)*s,rand(.25,.55)))}
    let hit=false;
    targets.forEach(t=>{if(t.contains(x,y)){hit=true;t.wet=Math.min(1,t.wet+.15);t.hitAlpha=1;let base=10;if(t.comboGrace>0)base*=2;score+=base;scoreEl.textContent=score;t.comboGrace=.8;if(soundToggle.checked)blip(); if(hapticsToggle.checked&&'vibrate'in navigator) navigator.vibrate(10);}});
    if(!hit&&hapticsToggle.checked&&'vibrate'in navigator) navigator.vibrate([6,4,6]);
  }

  let audioCtx; function blip(){try{if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='triangle';o.frequency.value=880;g.gain.value=.08;o.connect(g).connect(audioCtx.destination);o.start();o.frequency.exponentialRampToValueAtTime(440,audioCtx.currentTime+.08);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.1);o.stop(audioCtx.currentTime+.11)}catch(e){}}

  const pt=e=>e.touches&&e.touches[0]?{x:e.touches[0].clientX,y:e.touches[0].clientY}:{x:e.clientX,y:e.clientY};
  const down=e=>{const p=pt(e);touchActive=true;aimX=p.x;aimY=p.y;fire(aimX,aimY);e.preventDefault()};
  const move=e=>{if(!touchActive)return;const p=pt(e);aimX=p.x;aimY=p.y;fire(aimX,aimY);e.preventDefault()};
  const up=e=>{touchActive=false;e.preventDefault()};

  function bind(){canvas.addEventListener('touchstart',down,{passive:false});canvas.addEventListener('touchmove',move,{passive:false});canvas.addEventListener('touchend',up,{passive:false});canvas.addEventListener('mousedown',down);addEventListener('mousemove',move);addEventListener('mouseup',up)}
  function unbind(){canvas.replaceWith(canvas.cloneNode(true))}

  function gridBG(){const gap=28;ctx.save();ctx.globalAlpha=.26;for(let x=-((lastTime/40)%gap);x<innerWidth;x+=gap){ctx.fillStyle='rgba(154,107,255,.08)';ctx.fillRect(x,0,1,innerHeight)}for(let y=-((lastTime/60)%gap);y<innerHeight;y+=gap){ctx.fillStyle='rgba(84,210,255,.07)';ctx.fillRect(0,y,innerWidth,1)}ctx.restore()}

  function loop(ts){if(!running)return;if(!lastTime)lastTime=ts;const dt=Math.min(.033,(ts-lastTime)/1000);lastTime=ts;
    targets.forEach(t=>t.update(dt));particles.forEach(p=>p.update(dt));streams.forEach(s=>s.update(dt));
    particles=particles.filter(p=>p.life>0);streams=streams.filter(s=>s.life>0);
    ctx.clearRect(0,0,innerWidth,innerHeight);gridBG();targets.forEach(t=>t.draw());particles.forEach(p=>p.draw());streams.forEach(s=>s.draw());if(touchActive){ctx.save();ctx.globalCompositeOperation='lighter';ctx.beginPath();ctx.arc(aimX,aimY,10,0,Math.PI*2);ctx.strokeStyle='rgba(84,210,255,.8)';ctx.lineWidth=2;ctx.stroke();ctx.restore()}
    timeLeft-=dt;timerEl.textContent=Math.max(0,timeLeft|0);if(timeLeft<=0){gameOver();return} requestAnimationFrame(loop)}

  function start(){running=true;startScreen.classList.add('hidden');score=0;scoreEl.textContent=score;timeLeft=60;lastTime=0;targets=[];particles=[];streams=[];for(let i=0;i<3;i++)spawnTarget();bind();requestAnimationFrame(loop)}
  function gameOver(){running=false;unbind();startScreen.classList.remove('hidden');startScreen.querySelector('p').textContent=`Final score: ${score}. Tap Start to play again.`}

  // Robust preload: your specific names + auto-try patterns
  const prefer = [
    "babe1.jpeg",
    "babe2.jpeg",
    "babe3.jpeg",
  ];
  const guesses=[];
  const exts=["jpeg","jpg","png","webp"];
  for(let i=1;i<=12;i++){ for(const e of exts){ guesses.push(`assets/babes/babe${i}.${e}`); } }
  const candidates=[...new Set([...prefer, ...guesses])];

  function preload(list){
    return Promise.all(list.map(src=>new Promise(res=>{
      const img=new Image(); img.onload=()=>res(img); img.onerror=()=>res(null); img.src=src;
    }))).then(arr=>arr.filter(Boolean));
  }

  function spawnTarget(){ const img = imgs[(Math.random()*imgs.length)|0]; if(!img) return; targets.push(new Target(img)); if(targets.length>6) targets.shift(); }

  startBtn.addEventListener('click', start);
  reloadBtn.addEventListener('click', ()=>{ if(!running) start(); else { running=false; start(); } });
  menuBtn.addEventListener('click', ()=> menu.classList.toggle('hidden'));

  const imgs=[];
  preload(candidates).then(list=>{
    if(list.length===0){
      warn.classList.remove('hidden');
      warn.innerHTML = 'No images found in <code>/assets/babes</code>. Ensure files exist and names match (e.g., <code>babe1.jpg</code>).';
    } else {
      list.forEach(i=>imgs.push(i));
    }
  });
})();
