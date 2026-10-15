const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d');
const launchScreen = document.querySelector('#launch-screen');
const playButton = document.querySelector('#play-button');
const hud = document.querySelector('#hud');
const bottomHint = document.querySelector('#bottom-hint');
const mobileControls = document.querySelector('#mobile-controls');
const healthFill = document.querySelector('#health-fill');
const healthCount = document.querySelector('#health-count');
const bossFill = document.querySelector('#boss-fill');
const blockCount = document.querySelector('#block-count');
const timerText = document.querySelector('#timer');
const toast = document.querySelector('#toast');
const world = { width: 1600, height: 1100 };
const arena = { left: 108, right: 1492, top: 108, bottom: 992 };
const pillars = [{x:345,y:355,r:40},{x:1255,y:355,r:40},{x:345,y:745,r:40},{x:1255,y:745,r:40},{x:800,y:145,r:31},{x:800,y:955,r:31}];
const oreNodes = [{x:260,y:570,found:false},{x:1340,y:570,found:false},{x:800,y:870,found:false}];
const keys = Object.create(null);
const touchDirections = {up:'w',left:'a',down:'s',right:'d'};
const deco = [];
let width = 0;
let height = 0;
let dpr = 1;
let previousTime = 0;
let toastTimer = 0;
let aimPoint = null;
let state = 'ready';
let elapsed = 0;
let player;
let boss;
let blocks = [];
let buildCharges = 2;
let camera = {x:0,y:0};

function seed(value) {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

for (let i = 0; i < 130; i++) {
  const x = 140 + seed(i + 12) * 1320;
  const y = 130 + seed(i + 291) * 840;
  if (pillars.some(p => Math.hypot(x - p.x, y - p.y) < 80)) continue;
  deco.push({x,y,r:8 + seed(i + 512) * 25,alpha:.035 + seed(i + 66) * .075,moss:seed(i + 901) > .47});
}

function freshRun() {
  player = {x:800,y:820,r:17,hp:5,maxHp:5,faceX:0,faceY:-1,speed:228,dash:0,dashCooldown:0,invulnerable:0,swing:0,attackCooldown:0,hurt:0};
  boss = {x:800,y:340,r:31,hp:7,maxHp:7,speed:84,cooldown:1.5,windup:0,swing:0,stagger:0,hurt:0,phase:0};
  blocks = [];
  buildCharges = 2;
  elapsed = 0;
  aimPoint = null;
  oreNodes.forEach(node => node.found = false);
  updateHud();
}

freshRun();

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resize);
resize();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1050);
}

function updateHud() {
  healthFill.style.width = Math.max(0, player.hp / player.maxHp * 100) + '%';
  healthCount.textContent = player.hp + ' / ' + player.maxHp;
  bossFill.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
  blockCount.textContent = buildCharges;
  const seconds = Math.floor(elapsed);
  timerText.textContent = String(Math.floor(seconds / 60)).padStart(2,'0') + ':' + String(seconds % 60).padStart(2,'0');
}

function startRun() {
  freshRun();
  state = 'playing';
  launchScreen.classList.add('is-hidden');
  hud.hidden = false;
  bottomHint.hidden = false;
  mobileControls.dataset.active = 'true';
  playButton.blur();
}

function finishRun(won) {
  if (state !== 'playing') return;
  state = won ? 'won' : 'lost';
  launchScreen.classList.remove('is-hidden');
  hud.hidden = true;
  bottomHint.hidden = true;
  mobileControls.dataset.active = 'false';
  const eyebrow = launchScreen.querySelector('.eyebrow');
  const title = launchScreen.querySelector('h1');
  const description = launchScreen.querySelector('.description');
  const pair = launchScreen.querySelector('.game-pair');
  const hint = launchScreen.querySelector('.launch-hint');
  eyebrow.innerHTML = won ? '<span>RUN COMPLETE</span> THE LANDS REMEMBER' : '<span>RUN ENDED</span> THE WARDEN PREVAILS';
  title.innerHTML = won ? '<span>WELL</span><span class="title-second">PLAYED<span class="title-period">.</span></span>' : '<span>TRY</span><span class="title-second">AGAIN<span class="title-period">.</span></span>';
  description.innerHTML = won ? 'The Warden falls. The world is yours<br>to rebuild.' : 'Every legend starts with another<br>attempt.';
  pair.hidden = true;
  hint.textContent = won ? 'WARDEN DEFEATED IN ' + timerText.textContent : 'YOUR NEXT RUN STARTS HERE';
  playButton.querySelector('span').textContent = 'RUN IT BACK';
  playButton.focus({preventScroll:true});
}
playButton.addEventListener('click', startRun);

function worldPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {x:event.clientX - rect.left + camera.x,y:event.clientY - rect.top + camera.y};
}
canvas.addEventListener('pointermove', event => {
  if (event.pointerType === 'mouse') aimPoint = worldPoint(event);
});
canvas.addEventListener('pointerdown', event => {
  if (event.button === 2) {
    event.preventDefault();
    placeBlock();
  } else if (event.button === 0 && state === 'playing') {
    aimPoint = worldPoint(event);
    attack();
  }
});
canvas.addEventListener('contextmenu', event => event.preventDefault());

function keyName(event) { return event.key.toLowerCase(); }
window.addEventListener('keydown', event => {
  const key = keyName(event);
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) event.preventDefault();
  keys[key] = true;
  if (state !== 'playing' && (key === 'enter' || key === ' ')) { startRun(); return; }
  if (event.repeat || state !== 'playing') return;
  if (key === 'j' || key === ' ') attack();
  if (key === 'e') placeBlock();
  if (key === 'shift') dash();
  if ((state === 'won' || state === 'lost') && key === 'r') startRun();
});
window.addEventListener('keyup', event => { keys[keyName(event)] = false; });
window.addEventListener('blur', () => { Object.keys(keys).forEach(key => keys[key] = false); });

function bindHold(button, key) {
  const release = event => { event.preventDefault(); keys[key] = false; };
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    keys[key] = true;
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}
document.querySelectorAll('[data-dir]').forEach(button => bindHold(button,touchDirections[button.dataset.dir]));
document.querySelectorAll('[data-action]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (state !== 'playing') return;
    if (button.dataset.action === 'attack') attack();
    if (button.dataset.action === 'build') placeBlock();
    if (button.dataset.action === 'roll') dash();
  });
});

function getAim() {
  const dx = aimPoint ? aimPoint.x - player.x : boss.x - player.x;
  const dy = aimPoint ? aimPoint.y - player.y : boss.y - player.y;
  const len = Math.hypot(dx,dy) || 1;
  return {x:dx / len,y:dy / len};
}

function attack() {
  if (state !== 'playing' || player.attackCooldown > 0) return;
  player.attackCooldown = .43;
  player.swing = .27;
  const direction = getAim();
  player.faceX = direction.x;
  player.faceY = direction.y;
  const dx = boss.x - player.x;
  const dy = boss.y - player.y;
  const distance = Math.hypot(dx,dy);
  const facingDot = distance ? (dx / distance) * direction.x + (dy / distance) * direction.y : 1;
  if (distance < player.r + boss.r + 78 && facingDot > .05 && boss.hurt <= 0 && boss.hp > 0) {
    boss.hp -= 1;
    boss.hurt = .22;
    boss.stagger = .22;
    updateHud();
    if (boss.hp <= 0) finishRun(true);
  }
}

function dash() {
  if (state !== 'playing' || player.dashCooldown > 0) return;
  const x = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
  const y = (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
  if (x || y) {
    const len = Math.hypot(x,y);
    player.faceX = x / len;
    player.faceY = y / len;
  }
  player.dash = .2;
  player.dashCooldown = 1.05;
  player.invulnerable = .34;
}

function placeBlock() {
  if (state !== 'playing') return;
  if (buildCharges <= 0) { showToast('NO BUILD CHARGES'); return; }
  const fx = player.faceX || 0;
  const fy = player.faceY || -1;
  const x = Math.round((player.x + fx * 92 - 16) / 32) * 32 + 16;
  const y = Math.round((player.y + fy * 92 - 16) / 32) * 32 + 16;
  const candidate = {x,y,size:56,hp:3};
  const occupied = Math.hypot(x-player.x,y-player.y) < 72 || Math.hypot(x-boss.x,y-boss.y) < 66 || blocks.some(block => Math.hypot(x-block.x,y-block.y) < 62) || pillars.some(pillar => Math.hypot(x-pillar.x,y-pillar.y) < pillar.r+35);
  if (occupied || x < arena.left+38 || x > arena.right-38 || y < arena.top+38 || y > arena.bottom-38) { showToast('NO ROOM TO BUILD'); return; }
  blocks.push(candidate);
  buildCharges--;
  blockCount.textContent = buildCharges;
  showToast('STONE BLOCK PLACED');
}

function resolveCircle(entity, obstacle) {
  const dx = entity.x-obstacle.x;
  const dy = entity.y-obstacle.y;
  const distance = Math.hypot(dx,dy) || .001;
  const overlap = entity.r+obstacle.r-distance;
  if (overlap > 0) { entity.x += dx/distance*overlap; entity.y += dy/distance*overlap; }
}
function resolveBlock(entity, block) {
  const half = block.size/2;
  const nearX = Math.max(block.x-half,Math.min(entity.x,block.x+half));
  const nearY = Math.max(block.y-half,Math.min(entity.y,block.y+half));
  let dx = entity.x-nearX;
  let dy = entity.y-nearY;
  let distance = Math.hypot(dx,dy);
  if (distance >= entity.r) return;
  if (distance < .001) {
    const edges = [Math.abs(entity.x-(block.x-half)),Math.abs(entity.x-(block.x+half)),Math.abs(entity.y-(block.y-half)),Math.abs(entity.y-(block.y+half))];
    const min = Math.min(...edges);
    if (min === edges[0]) entity.x = block.x-half-entity.r;
    else if (min === edges[1]) entity.x = block.x+half+entity.r;
    else if (min === edges[2]) entity.y = block.y-half-entity.r;
    else entity.y = block.y+half+entity.r;
    return;
  }
  const overlap = entity.r-distance;
  dx /= distance; dy /= distance;
  entity.x += dx*overlap; entity.y += dy*overlap;
}
function moveEntity(entity, dx, dy) {
  entity.x += dx; entity.y += dy;
  entity.x = Math.max(arena.left+entity.r,Math.min(arena.right-entity.r,entity.x));
  entity.y = Math.max(arena.top+entity.r,Math.min(arena.bottom-entity.r,entity.y));
  pillars.forEach(pillar => resolveCircle(entity,pillar));
  blocks.forEach(block => resolveBlock(entity,block));
}
function isBlockBetween() {
  const ax=boss.x, ay=boss.y, bx=player.x, by=player.y;
  const dx=bx-ax, dy=by-ay;
  const lengthSquared=dx*dx+dy*dy || 1;
  return blocks.find(block => {
    const t=((block.x-ax)*dx+(block.y-ay)*dy)/lengthSquared;
    if (t < .08 || t > .88) return false;
    const px=ax+t*dx, py=ay+t*dy;
    return Math.hypot(block.x-px,block.y-py) < block.size*.67;
  });
}
function bossStrike() {
  if (Math.hypot(player.x-boss.x,player.y-boss.y) > 162) return;
  const shield = isBlockBetween();
  if (shield) {
    shield.hp--;
    showToast('BLOCK HELD');
    if (shield.hp <= 0) blocks = blocks.filter(block => block !== shield);
    return;
  }
  if (player.invulnerable > 0) return;
  player.hp = Math.max(0,player.hp-1);
  player.hurt = .42;
  player.invulnerable = .7;
  updateHud();
  if (player.hp <= 0) finishRun(false);
}

function update(dt) {
  if (state !== 'playing') return;
  elapsed += dt;
  player.attackCooldown=Math.max(0,player.attackCooldown-dt);
  player.swing=Math.max(0,player.swing-dt);
  player.dash=Math.max(0,player.dash-dt);
  player.dashCooldown=Math.max(0,player.dashCooldown-dt);
  player.invulnerable=Math.max(0,player.invulnerable-dt);
  player.hurt=Math.max(0,player.hurt-dt);
  boss.hurt=Math.max(0,boss.hurt-dt);
  boss.stagger=Math.max(0,boss.stagger-dt);
  boss.swing=Math.max(0,boss.swing-dt);
  const rawX=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0);
  const rawY=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);
  if (rawX||rawY) {
    const len=Math.hypot(rawX,rawY), nx=rawX/len, ny=rawY/len;
    if (!aimPoint) { player.faceX=nx; player.faceY=ny; }
    const speed=player.dash>0?610:player.speed;
    moveEntity(player,nx*speed*dt,ny*speed*dt);
  }
  for (const node of oreNodes) {
    if (!node.found && Math.hypot(player.x-node.x,player.y-node.y)<37) {
      node.found=true;
      buildCharges=Math.min(4,buildCharges+1);
      blockCount.textContent=buildCharges;
      showToast('ORE FOUND  ·  +1 BUILD CHARGE');
    }
  }
  if (boss.windup>0) {
    boss.windup-=dt;
    if (boss.windup<=0) { boss.swing=.34; boss.cooldown=1.25; bossStrike(); }
  } else if (boss.stagger<=0) {
    boss.cooldown-=dt;
    const dx=player.x-boss.x, dy=player.y-boss.y, distance=Math.hypot(dx,dy)||1;
    if (distance<207 && boss.cooldown<=0) { boss.windup=.78; boss.phase=Math.atan2(dy,dx); }
    else if (distance>112) moveEntity(boss,dx/distance*boss.speed*dt,dy/distance*boss.speed*dt);
  }
  if (Math.floor(elapsed*4)!==Math.floor((elapsed-dt)*4)) updateHud();
}

function updateCamera() {
  const targetX=Math.max(0,Math.min(world.width-width,player.x-width/2));
  const targetY=Math.max(0,Math.min(world.height-height,player.y-height/2));
  camera.x+=(targetX-camera.x)*.09;
  camera.y+=(targetY-camera.y)*.09;
}
function polygon(points,fill,stroke,lineWidth) {
  ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]);
  ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth||1;ctx.stroke();}
}
function drawFloor() {
  ctx.fillStyle='#222922'; ctx.fillRect(camera.x,camera.y,width,height);
  const tile=64, startX=Math.floor(camera.x/tile)*tile, endX=camera.x+width+tile, startY=Math.floor(camera.y/tile)*tile, endY=camera.y+height+tile;
  for(let y=startY;y<endY;y+=tile) for(let x=startX;x<endX;x+=tile) {
    const shade=Math.floor(34+seed(Math.floor(x/tile)*73+Math.floor(y/tile)*191)*9);
    ctx.fillStyle='rgb('+shade+','+(shade+5)+','+(shade+1)+')'; ctx.fillRect(x,y,tile-1,tile-1);
    ctx.strokeStyle='rgba(9,13,10,.13)'; ctx.lineWidth=1; ctx.strokeRect(x+.5,y+.5,tile-2,tile-2);
  }
  for(const patch of deco) {
    ctx.fillStyle=patch.moss?'rgba(105,133,84,'+patch.alpha+')':'rgba(187,154,104,'+patch.alpha+')';
    ctx.beginPath(); ctx.ellipse(patch.x,patch.y,patch.r*1.5,patch.r*.8,seed(patch.x)*Math.PI,0,Math.PI*2); ctx.fill();
  }
  ctx.strokeStyle='rgba(198,174,120,.2)'; ctx.lineWidth=2; ctx.strokeRect(arena.left,arena.top,arena.right-arena.left,arena.bottom-arena.top);
  ctx.strokeStyle='rgba(198,174,120,.08)'; ctx.lineWidth=1; ctx.strokeRect(arena.left+18,arena.top+18,arena.right-arena.left-36,arena.bottom-arena.top-36);
  ctx.beginPath(); ctx.arc(800,550,205,0,Math.PI*2); ctx.strokeStyle='rgba(218,185,120,.07)'; ctx.lineWidth=2; ctx.stroke();
  ctx.beginPath(); ctx.arc(800,550,194,0,Math.PI*2); ctx.strokeStyle='rgba(218,185,120,.045)'; ctx.lineWidth=1; ctx.stroke();
}
function drawPillar(pillar,time) {
  ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(pillar.x+8,pillar.y+15,pillar.r+10,pillar.r*.65,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#151a16'; ctx.beginPath(); ctx.arc(pillar.x,pillar.y,pillar.r+2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#555b4e'; ctx.beginPath(); ctx.arc(pillar.x,pillar.y-4,pillar.r-4,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#74745d'; ctx.beginPath(); ctx.ellipse(pillar.x-3,pillar.y-10,pillar.r-12,10,-.08,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(212,179,110,'+(.2+Math.sin(time*1.1+pillar.x)*.05)+')'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(pillar.x,pillar.y,pillar.r+7,0,Math.PI*2); ctx.stroke();
}
function drawOre(node,time) {
  if(node.found)return;
  const pulse=1+Math.sin(time*2.8+node.x)*.08;
  ctx.save(); ctx.translate(node.x,node.y); ctx.scale(pulse,pulse);
  ctx.fillStyle='rgba(154,184,116,.14)'; ctx.beginPath(); ctx.arc(0,0,25,0,Math.PI*2); ctx.fill();
  polygon([[-8,8],[-7,-5],[0,-15],[8,-4],[7,8]],'#7d9a68','#c0ca8a',1);
  polygon([[-7,-5],[0,-15],[1,3],[-8,8]],'#b2c68a'); polygon([[0,-15],[8,-4],[7,8],[1,3]],'#617d5a');
  ctx.restore();
}
function drawBlock(block) {
  const half=block.size/2;
  ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(block.x-half+8,block.y-half+12,block.size,block.size);
  polygon([[block.x-half,block.y-half],[block.x+half,block.y-half],[block.x+half,block.y+half],[block.x-half,block.y+half]],'#6f725d','#999278',1.3);
  polygon([[block.x-half,block.y-half],[block.x+half,block.y-half],[block.x+half-6,block.y-half-12],[block.x-half+7,block.y-half-12]],'#aaa083','#c2b28b',1);
  polygon([[block.x+half,block.y-half],[block.x+half,block.y+half],[block.x+half-6,block.y+half-12],[block.x+half-6,block.y-half-12]],'#4e5548','#85836c',1);
  ctx.strokeStyle='rgba(30,35,27,.7)'; ctx.beginPath(); ctx.moveTo(block.x-half+5,block.y); ctx.lineTo(block.x+half-4,block.y); ctx.stroke();
  if(block.hp<3){ctx.fillStyle='rgba(9,12,9,.68)';ctx.fillRect(block.x-14,block.y-half-20,28,3);ctx.fillStyle='#c2b28b';ctx.fillRect(block.x-14,block.y-half-20,28*block.hp/3,3);}
}
function drawBoss(time) {
  const flashing=boss.hurt>0&&Math.floor(time*30)%2===0;
  ctx.save(); ctx.translate(boss.x,boss.y); ctx.rotate(boss.phase||0);
  ctx.fillStyle='rgba(0,0,0,.42)'; ctx.beginPath(); ctx.ellipse(8,22,43,28,0,0,Math.PI*2); ctx.fill();
  if(boss.windup>0){ctx.strokeStyle='rgba(195,75,51,'+(.18+Math.sin(time*21)*.12)+')';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,126,-.75,.75);ctx.stroke();ctx.strokeStyle='rgba(203,83,56,.37)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(126,0);ctx.stroke();}
  const armor=flashing?'#f2d8b5':'#3a3735';
  polygon([[-25,-12],[-16,-35],[2,-40],[24,-23],[31,9],[16,28],[-15,27],[-31,7]],armor,'#77705c',2);
  polygon([[-20,-28],[-32,-51],[-11,-42],[-4,-59],[8,-39],[28,-50],[18,-25]],'#544c41','#8c7756',2);
  ctx.fillStyle='#b44f3d';ctx.fillRect(4,-18,18,4);ctx.fillStyle='#f0b670';ctx.fillRect(9,-18,5,3);
  polygon([[17,-8],[73,-3],[87,2],[75,10],[18,8]],'#887d67','#c0aa7d',1.2);
  polygon([[71,-6],[96,-3],[101,2],[96,8],[70,7]],'#373a35','#8e866e',1);
  if(boss.swing>0){ctx.strokeStyle='rgba(232,185,119,'+(boss.swing*1.9)+')';ctx.lineWidth=8;ctx.beginPath();ctx.arc(3,0,112,-.9,.9);ctx.stroke();}
  ctx.restore();
}
function drawPlayer(time) {
  const flicker=player.invulnerable>0&&Math.floor(time*30)%2===0;
  ctx.save(); ctx.translate(player.x,player.y); ctx.rotate(Math.atan2(player.faceY,player.faceX)+Math.PI/2);
  ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(6,18,25,16,0,0,Math.PI*2);ctx.fill();
  polygon([[-15,3],[-23,20],[-9,15],[0,22],[9,15],[23,20],[15,3]],'#793f35','#a77550',1);
  ctx.fillStyle=flicker?'#f7e2be':'#4d6770';ctx.beginPath();ctx.ellipse(0,2,14,17,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#b8a983';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-7,11);ctx.lineTo(8,12);ctx.stroke();
  ctx.fillStyle=flicker?'#fff0d6':'#d1a66a';ctx.beginPath();ctx.arc(0,-13,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#973e32';ctx.beginPath();ctx.ellipse(0,-19,13,5,0,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-10,-20,20,3);
  ctx.strokeStyle='#d8d1be';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(7,-1);ctx.lineTo(9,-30);ctx.stroke();
  ctx.strokeStyle='#8b6949';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(7,-2);ctx.lineTo(7,4);ctx.stroke();
  if(player.swing>0){ctx.strokeStyle='rgba(240,219,172,'+(player.swing*3.3)+')';ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,-4,59,-.9,.9);ctx.stroke();}
  ctx.restore();
}
function drawArena(time) {
  drawFloor();
  oreNodes.forEach(node=>drawOre(node,time));
  pillars.forEach(pillar=>drawPillar(pillar,time));
  blocks.forEach(drawBlock);
  drawBoss(time); drawPlayer(time);
  const glow=ctx.createRadialGradient(boss.x,boss.y,10,boss.x,boss.y,145);
  glow.addColorStop(0,'rgba(161,69,43,.1)');glow.addColorStop(1,'rgba(161,69,43,0)');ctx.fillStyle=glow;ctx.fillRect(boss.x-145,boss.y-145,290,290);
}
function render(time) {
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);updateCamera();
  ctx.save();ctx.translate(-camera.x,-camera.y);drawArena(time);ctx.restore();
}
function frame(now) {
  const dt=Math.min((now-previousTime)/1000||0,.033);previousTime=now;update(dt);render(now/1000);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);