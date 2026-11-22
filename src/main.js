import * as THREE from 'three';
import './style.css';

const $ = id => document.getElementById(id);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, .1, 150);
camera.position.set(0, 5.7, 9.2); camera.lookAt(0, 0, -4);
const renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
$('game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xa9d7ff,0x20243b,1.65));
const sun = new THREE.DirectionalLight(0xffffff,2.2); sun.position.set(-4,10,6); sun.castShadow=true; scene.add(sun);
const glow = new THREE.PointLight(0x24aaff,22,35); glow.position.set(4,4,-8); scene.add(glow);

const worlds = [
 {id:'original',name:'ORIGINAL',emoji:'🌌',cost:0,bg:0x080d18,fog:0x080d18,track:0x17283e,edge:0x39bfff,glow:0x168cff},
 {id:'lava',name:'LAVA',emoji:'🌋',cost:250,bg:0x1b0808,fog:0x32100a,track:0x38201c,edge:0xff642c,glow:0xff3c12},
 {id:'ice',name:'ICE',emoji:'❄️',cost:500,bg:0x071b2b,fog:0x0b3148,track:0x24485c,edge:0x8deaff,glow:0x50cfff},
 {id:'space',name:'SPACE',emoji:'🪐',cost:900,bg:0x09051d,fog:0x170c3b,track:0x20183e,edge:0xb78aff,glow:0x995cff}
];
const skins=[{name:'CYAN CORE',color:0x57c9ff,cost:0},{name:'GOLD RUSH',color:0xffc64b,cost:120},{name:'LAVA ORB',color:0xff593c,cost:220},{name:'MINT',color:0x54f0b0,cost:350},{name:'VIOLET',color:0xb78aff,cost:500},{name:'PEARL',color:0xf4f6ff,cost:700}];
const modes={easy:{start:8,max:18,ramp:.22,spawn:1.65,label:'EASY'},medium:{start:12,max:26,ramp:.42,spawn:1.28,label:'MEDIUM'},hard:{start:17,max:34,ramp:.65,spawn:1.02,label:'HARD'},extreme:{start:22,max:44,ramp:.9,spawn:.82,label:'EXTREME'}};
const readSave=()=>{try{return JSON.parse(localStorage.getItem('rr2-save')||'{}')}catch{return {}}};
let save=readSave(); save.coins=save.coins||0; save.unlocked=save.unlocked||['original']; save.skins=save.skins||['CYAN CORE']; save.skin=save.skin||'CYAN CORE';
function persist(){localStorage.setItem('rr2-save',JSON.stringify(save)); updateWallet();}
let selectedWorld='original', selectedMode='easy', running=false, paused=false, elapsed=0, speed=8, spawnClock=0, last=0, jumpV=0, jumping=false, ballX=0, targetX=0, runCoins=0, ramps=[], hazards=[], coins=[], track=[], soundOn=true, audioCtx=null, musicTimer=null;
const ball=new THREE.Mesh(new THREE.SphereGeometry(.43,32,24),new THREE.MeshStandardMaterial({color:0x57c9ff,metalness:.55,roughness:.2})); ball.position.set(0,.48,1.5); ball.castShadow=true; scene.add(ball);
const ballLight=new THREE.PointLight(0x35aaff,2.4,5); scene.add(ballLight);
const trackGroup=new THREE.Group(); scene.add(trackGroup);
const hazardGroup=new THREE.Group(); scene.add(hazardGroup);
const pickupGroup=new THREE.Group(); scene.add(pickupGroup);
const decorGroup=new THREE.Group(); scene.add(decorGroup);
const starGeo=new THREE.BufferGeometry(), starPos=[]; for(let i=0;i<300;i++)starPos.push((Math.random()-.5)*85,Math.random()*30-2,-Math.random()*120);
starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPos,3)); const starField=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9bcaff,size:.085,transparent:true,opacity:.75}));scene.add(starField);
function mats(){const w=worlds.find(x=>x.id===selectedWorld);scene.background=new THREE.Color(w.bg);scene.fog=new THREE.Fog(w.fog,20,72);glow.color.setHex(w.glow);ballLight.color.setHex(w.edge);}
function makeTrack(){while(trackGroup.children.length)trackGroup.remove(trackGroup.children[0]);track=[];const w=worlds.find(x=>x.id===selectedWorld);const base=new THREE.MeshStandardMaterial({color:w.track,metalness:.35,roughness:.55});const edge=new THREE.MeshStandardMaterial({color:w.edge,emissive:w.edge,emissiveIntensity:.65});for(let i=0;i<20;i++){const slab=new THREE.Mesh(new THREE.BoxGeometry(8,.34,5.1),base);slab.position.set(0,-.25,-i*5);slab.receiveShadow=true;trackGroup.add(slab);track.push(slab);for(const x of [-3.92,3.92]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.12,.18,5.08),edge);rail.position.set(x,-.01,-i*5);trackGroup.add(rail);track.push(rail)}}}
function clearGroup(g,arr){for(const o of arr)g.remove(o.mesh);arr.length=0;}
function spawnHazard(){const h=.7+Math.random()*.55,w=.85+Math.random()*.9,x=(Math.random()-.5)*5.7;const mat=new THREE.MeshStandardMaterial({color:selectedWorld==='lava'?0xff673b:selectedWorld==='ice'?0x8beaff:0xff596e,emissive:selectedWorld==='lava'?0x7a1808:0x310d22,emissiveIntensity:.55,metalness:.25,roughness:.35});const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,.9),mat);mesh.position.set(x,h/2-.04,-52);mesh.castShadow=true;hazardGroup.add(mesh);hazards.push({mesh,h,w,passed:false});}
function spawnRamp(){const x=(Math.random()-.5)*4.6;const mesh=new THREE.Mesh(new THREE.BoxGeometry(2.6,.28,3.6),new THREE.MeshStandardMaterial({color:worlds.find(w=>w.id===selectedWorld).edge,emissive:worlds.find(w=>w.id===selectedWorld).edge,emissiveIntensity:.45,metalness:.35,roughness:.3}));mesh.position.set(x,.18,-55);mesh.rotation.x=-.22;mesh.castShadow=true;hazardGroup.add(mesh);ramps.push({mesh,x,hit:false});}
function spawnCoinLine(){const x=(Math.random()-.5)*5.7;for(let i=0;i<4;i++){const mesh=new THREE.Mesh(new THREE.TorusGeometry(.22,.075,10,20),new THREE.MeshStandardMaterial({color:0xffd45e,metalness:.7,roughness:.22,emissive:0x6c3e00,emissiveIntensity:.6}));mesh.position.set(x,.85,-49-i*1.25);mesh.rotation.x=Math.PI/2;pickupGroup.add(mesh);coins.push({mesh,taken:false});}}
function updateWallet(){$('home-coins').textContent=save.coins;$('shop-coins').textContent=save.coins;}
function renderLevels(){const el=$('level-list');el.innerHTML='';for(const w of worlds){const unlocked=save.unlocked.includes(w.id);const b=document.createElement('button');b.className='level'+(selectedWorld===w.id?' selected':'')+(!unlocked?' locked':'');b.innerHTML=`<span class="emoji">${w.emoji}</span><b>${w.name}</b><small>${unlocked?'UNLOCKED':`◈ ${w.cost}`}</small>`;b.onclick=()=>{if(unlocked){selectedWorld=w.id;renderLevels()}else if(save.coins>=w.cost){save.coins-=w.cost;save.unlocked.push(w.id);selectedWorld=w.id;persist();renderLevels()}else{b.animate([{transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'translateX(0)'}],{duration:180})}};el.appendChild(b)}}
function renderShop(){updateWallet();const el=$('skin-list');el.innerHTML='';for(const s of skins){const owned=save.skins.includes(s.name),selected=save.skin===s.name;const card=document.createElement('div');card.className='skin'+(selected?' selected':'');card.innerHTML=`<div class="skin-ball" style="background:#${s.color.toString(16).padStart(6,'0')}"></div><b>${s.name}</b><small>${owned?'OWNED':`◈ ${s.cost}`}</small><button>${selected?'EQUIPPED':owned?'EQUIP':'BUY'}</button>`;card.querySelector('button').onclick=()=>{if(owned){save.skin=s.name;applySkin();persist();renderShop()}else if(save.coins>=s.cost){save.coins-=s.cost;save.skins.push(s.name);save.skin=s.name;applySkin();persist();renderShop()}};el.appendChild(card)}}
function applySkin(){const s=skins.find(x=>x.name===save.skin)||skins[0];ball.material.color.setHex(s.color);ball.material.emissive.setHex(s.color);ball.material.emissiveIntensity=.12;}
function show(id){['home','hud','pause-screen','gameover','shop'].forEach(x=>$(x).classList.add('hidden'));if(id)$(id).classList.remove('hidden')}
function fmt(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`}
function audio(){if(!soundOn)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();}catch{}}
function tone(freq,duration=.11,type='sine',volume=.045){if(!soundOn)return;audio();if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration)}
function startMusic(){stopMusic();if(!soundOn)return;audio();let n=0;musicTimer=setInterval(()=>{if(!running||paused||!soundOn)return;const notes=[110,146.83,164.81,130.81];tone(notes[n++%4],.22,'triangle',.018);if(n%4===0)tone(55,.12,'sine',.025)},420)}
function stopMusic(){if(musicTimer)clearInterval(musicTimer);musicTimer=null}
function startGame(){audio();mats();makeTrack();clearGroup(hazardGroup,hazards);clearGroup(pickupGroup,coins);ramps.length=0;elapsed=0;spawnClock=0;speed=modes[selectedMode].start;runCoins=0;targetX=0;ballX=0;ball.position.set(0,.48,1.5);jumpV=0;jumping=false;ball.scale.set(1,1,1);$('hud-world').textContent=worlds.find(w=>w.id===selectedWorld).name;$('timer').textContent='00:00';$('run-coins').textContent='0';$('speed').textContent='1.0x';running=true;paused=false;show('hud');startMusic()}
function endGame(cleared=false){if(!running)return;running=false;stopMusic();const earned=runCoins+(cleared?40:0);save.coins+=earned;persist();$('final-time').textContent=fmt(elapsed);$('earned').textContent=earned;$('over-title').textContent=cleared?'LEVEL CLEARED!':'GAME OVER';show('gameover');tone(cleared?740:160,.35,'sawtooth',.035)}
function update(dt){if(!running||paused)return;elapsed+=dt;const cfg=modes[selectedMode];speed=Math.min(cfg.max,cfg.start+elapsed*cfg.ramp);$('timer').textContent=fmt(elapsed);$('speed').textContent=(speed/cfg.start).toFixed(1)+'x';ballX=THREE.MathUtils.damp(ballX,targetX,13,dt);ball.position.x=ballX;
 if(jumping){jumpV-=22*dt;ball.position.y+=jumpV*dt;if(ball.position.y<=.48){ball.position.y=.48;jumping=false;jumpV=0;ball.scale.set(1.12,.82,1.12);setTimeout(()=>{if(!jumping)ball.scale.set(1,1,1)},75)}}
 ball.rotation.x-=speed*dt*.75;ball.rotation.z=THREE.MathUtils.damp(ball.rotation.z,-(targetX-ballX)*.12,8,dt);ballLight.position.set(ball.position.x,.8,1.5);
 spawnClock+=dt;const interval=Math.max(.48,cfg.spawn-elapsed*.004);if(spawnClock>interval){spawnClock=0;spawnHazard();if(Math.random()<.35)spawnCoinLine();if(Math.random()<.2)spawnRamp()}
 for(const h of hazards){h.mesh.position.z+=speed*dt;if(h.mesh.position.z>1.5&&!h.passed){h.passed=true;const near=Math.abs(h.mesh.position.x-ball.position.x)<h.w/2+.43&&Math.abs(h.mesh.position.z-1.5)<.75;if(near&&ball.position.y< h.h+.35){endGame();return}}}
 for(const r of ramps){r.mesh.position.z+=speed*dt;if(!r.hit&&Math.abs(r.mesh.position.z-1.5)<.85&&Math.abs(ball.position.x-r.x)<1.6){r.hit=true;jumping=true;jumpV=12.4;speed=Math.min(cfg.max+4,speed+1.5);tone(520,.18,'triangle',.05)}}
 for(const c of coins){c.mesh.position.z+=speed*dt;c.mesh.rotation.z+=dt*3;if(!c.taken&&Math.abs(c.mesh.position.z-1.5)<.7&&Math.abs(c.mesh.position.x-ball.position.x)<.68&&Math.abs(c.mesh.position.y-ball.position.y)<1.1){c.taken=true;pickupGroup.remove(c.mesh);runCoins++;$('run-coins').textContent=runCoins;tone(880,.08,'sine',.045)}}
 for(const g of [hazards,ramps]){for(let i=g.length-1;i>=0;i--)if(g[i].mesh.position.z>9){hazardGroup.remove(g[i].mesh);g.splice(i,1)}}for(let i=coins.length-1;i>=0;i--)if(coins[i].taken||coins[i].mesh.position.z>9){pickupGroup.remove(coins[i].mesh);coins.splice(i,1)}
 for(const s of track){s.position.z+=speed*dt;if(s.position.z>7)s.position.z-=100}starField.position.z+=speed*dt*.16;if(starField.position.z>30)starField.position.z=0;
 // The runway has open sides: moving beyond its edge is a fall and ends the run.
 if(Math.abs(ball.position.x)>4.05){endGame();return}
}
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000||0,.04);last=now;update(dt);if(!running){ball.position.y=.48+Math.sin(now*.0013)*.07;ball.rotation.y+=.0015;ballLight.position.copy(ball.position)}renderer.render(scene,camera)}requestAnimationFrame(animate);
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}addEventListener('resize',resize);
let pointerDown=false,moved=false;function pointerStart(e){if(!running||paused)return;pointerDown=true;moved=false;targetX=THREE.MathUtils.clamp((e.clientX/innerWidth-.5)*10.8,-5.4,5.4);renderer.domElement.setPointerCapture?.(e.pointerId)}function pointerMove(e){if(!pointerDown||!running||paused)return;moved=true;targetX=THREE.MathUtils.clamp((e.clientX/innerWidth-.5)*10.8,-5.4,5.4)}function pointerEnd(e){if(!pointerDown)return;pointerDown=false;if(!moved&&running&&!paused&&!jumping){jumping=true;jumpV=9.4;tone(390,.1,'triangle',.035)}}renderer.domElement.addEventListener('pointerdown',pointerStart);renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerup',pointerEnd);renderer.domElement.addEventListener('pointercancel',()=>pointerDown=false);
document.querySelectorAll('.diff').forEach(b=>b.onclick=()=>{selectedMode=b.dataset.diff;document.querySelectorAll('.diff').forEach(x=>x.classList.toggle('selected',x===b))});
$('play').onclick=startGame;$('pause').onclick=()=>{paused=true;stopMusic();show('pause-screen')};$('resume').onclick=()=>{paused=false;show('hud');startMusic()};$('quit').onclick=()=>{running=false;paused=false;stopMusic();show('home')};$('retry').onclick=startGame;$('home').onclick=()=>{running=false;show('home')};$('shop-open').onclick=()=>{renderShop();show('shop')};$('shop-close').onclick=()=>show('home');$('sound-toggle').onclick=()=>{soundOn=!soundOn;$('sound-toggle').textContent='SOUND: '+(soundOn?'ON':'OFF');if(soundOn&&running&&!paused)startMusic();else stopMusic()};
renderLevels();updateWallet();applySkin();mats();makeTrack();
