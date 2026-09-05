import Phaser from 'phaser';
import './style.css';

type VehicleId = 'bike' | 'scooter' | 'moto' | 'car' | 'van';
type Weather = 'clear' | 'rain' | 'fog' | 'storm';
type MissionKind = 'standard' | 'timed' | 'fragile' | 'multi' | 'highrisk';

type Save = {
  money:number; rep:number; day:number; deliveries:number; streak:number; best:number;
  vehicle:VehicleId; upgrades:{engine:number;brakes:number;battery:number;bag:number;nav:number};
  unlocked:VehicleId[]; story:number; faction:number; achievements:string[];
};

const KEY='last-courier-save-v3';
const DEFAULT:Save={money:350,rep:0,day:1,deliveries:0,streak:0,best:0,vehicle:'bike',
  upgrades:{engine:0,brakes:0,battery:0,bag:0,nav:0},unlocked:['bike'],story:0,faction:0,achievements:[]};
const cloneDefault=():Save=>JSON.parse(JSON.stringify(DEFAULT));
const loadSave=():Save=>{try{
  const raw=JSON.parse(localStorage.getItem(KEY)||'null'); if(!raw)return cloneDefault();
  return {...cloneDefault(),...raw,upgrades:{...DEFAULT.upgrades,...(raw.upgrades||{})},unlocked:raw.unlocked||['bike'],achievements:raw.achievements||[]};
}catch{return cloneDefault()}};
const persist=(s:Save)=>localStorage.setItem(KEY,JSON.stringify(s));

class SDKBridge{
  ysdk:any; player:any;
  async init(){try{const Y=(window as any).YaGames;if(!Y)return;this.ysdk=await Y.init();this.ysdk?.features?.LoadingAPI?.ready?.();this.player=await this.ysdk?.getPlayer?.({scopes:false});const d=await this.player?.getData?.();if(d?.money!==undefined){Object.assign(gameSave,d);}}catch{}}
  async cloud(s:Save){persist(s);try{await this.player?.setData?.(s,true)}catch{}}
  fullscreen(){try{this.ysdk?.adv?.showFullscreenAdv?.({callbacks:{}})}catch{}}
  rewarded(cb:()=>void){try{this.ysdk?.adv?.showRewardedVideo?.({callbacks:{onRewarded:cb,onClose:()=>{}}})}catch{cb()}}
}
const sdk=new SDKBridge();
let gameSave=loadSave();

const VEHICLES:{id:VehicleId;name:string;price:number;speed:number;handling:number;capacity:number;desc:string}[]=[
 {id:'bike',name:'Велосипед',price:0,speed:155,handling:1.18,capacity:1,desc:'Дёшево, манёвренность максимальная'},
 {id:'scooter',name:'Скутер',price:900,speed:205,handling:1.06,capacity:2,desc:'Баланс скорости и груза'},
 {id:'moto',name:'Мотоцикл',price:2400,speed:260,handling:.96,capacity:2,desc:'Быстрый транспорт для срочных заказов'},
 {id:'car',name:'Городской автомобиль',price:6200,speed:235,handling:.76,capacity:4,desc:'Стабильность в плохую погоду'},
 {id:'van',name:'Фургон',price:11500,speed:190,handling:.58,capacity:7,desc:'Много груза и самые дорогие контракты'}
];
const UPGRADE:{key:keyof Save['upgrades'];name:string;base:number;max:number;desc:string}[]=[
 {key:'engine',name:'Двигатель',base:450,max:5,desc:'+ скорость'},
 {key:'brakes',name:'Тормоза',base:380,max:5,desc:'+ контроль'},
 {key:'battery',name:'Батарея',base:420,max:5,desc:'+ запас энергии'},
 {key:'bag',name:'Сумка',base:500,max:5,desc:'+ грузоподъёмность'},
 {key:'nav',name:'Навигация',base:600,max:5,desc:'+ время на заказ'}
];
const DISTRICTS=[
 {name:'ЦЕНТР',x:900,y:470,color:0x243d55,risk:1.25,pay:1.3},
 {name:'СТАРЫЙ ГОРОД',x:380,y:330,color:0x4a3848,risk:1.15,pay:1.15},
 {name:'ПРОМЗОНА',x:1390,y:830,color:0x443c31,risk:1.55,pay:1.5},
 {name:'ЖИЛОЙ РАЙОН',x:380,y:820,color:0x29453b,risk:.8,pay:1},
 {name:'ПОРТ',x:1540,y:270,color:0x29434a,risk:1.7,pay:1.7},
 {name:'ПРИГОРОД',x:920,y:1040,color:0x34432f,risk:.65,pay:1.35}
];

function vehicle(){return VEHICLES.find(v=>v.id===gameSave.vehicle)!}
function upgradeCost(k:keyof Save['upgrades']){const u=UPGRADE.find(x=>x.key===k)!;return Math.round(u.base*Math.pow(1.62,gameSave.upgrades[k]))}
function clamp(n:number,a:number,b:number){return Math.max(a,Math.min(b,n))}

class Boot extends Phaser.Scene{
 constructor(){super('Boot')}
 create(){
  this.cameras.main.setBackgroundColor('#071018');
  this.add.text(this.scale.width/2,this.scale.height/2-45,'ПОСЛЕДНИЙ КУРЬЕР',{fontFamily:'Arial Black,Arial',fontSize:'42px',color:'#eaf6ff'}).setOrigin(.5);
  this.add.text(this.scale.width/2,this.scale.height/2+10,'НОВОГРАД • НОЧНАЯ СМЕНА',{fontSize:'15px',color:'#6d8ba0',letterSpacing:4}).setOrigin(.5);
  this.add.text(this.scale.width/2,this.scale.height/2+65,'Загрузка города…',{fontSize:'16px',color:'#8fdfff'}).setOrigin(.5);
  sdk.init().finally(()=>this.time.delayedCall(500,()=>this.scene.start('Menu')));
 }
}

class Menu extends Phaser.Scene{
 create(){
  this.cameras.main.setBackgroundColor('#071018');
  const w=this.scale.width,h=this.scale.height;
  this.add.rectangle(w/2,h/2,w,h,0x071018);
  this.add.circle(w*.72,h*.48,210,0x123044,.6); this.add.circle(w*.72,h*.48,130,0x174c68,.35);
  this.add.text(w*.09,h*.18,'ПОСЛЕДНИЙ\nКУРЬЕР',{fontFamily:'Arial Black,Arial',fontSize:Math.min(64,w*.065),color:'#e9f7ff',lineSpacing:-6});
  this.add.text(w*.09,h*.43,'НОВОГРАД. 23:47.\nГород не спит — и тебе тоже нельзя.',{fontSize:18,color:'#8ea9b8',lineSpacing:8});
  const start=this.button(w*.09,h*.64,'НАЧАТЬ СМЕНУ',()=>this.scene.start('City'));
  this.button(w*.09,h*.74,'ГАРАЖ',()=>this.scene.start('Garage'));
  this.button(w*.09,h*.84,'ПРОГРЕСС',()=>this.showProgress());
  this.add.text(w*.74,h*.86,`ДЕНЬ ${gameSave.day}  •  ${gameSave.money} ₽  •  REP ${gameSave.rep}`,{fontSize:14,color:'#7895a7'}).setOrigin(.5);
  start.setFocus();
 }
 button(x:number,y:number,label:string,fn:()=>void){const t=this.add.text(x,y,label,{fontFamily:'Arial',fontSize:18,color:'#dff7ff',backgroundColor:'#102331',padding:{left:20,right:20,top:12,bottom:12}}).setInteractive({useHandCursor:true});t.on('pointerdown',fn);t.on('pointerover',()=>t.setColor('#55dcff'));t.on('pointerout',()=>t.setColor('#dff7ff'));return t}
 showProgress(){
  const ach=gameSave.achievements.length;
  const t=this.add.text(this.scale.width*.55,this.scale.height*.22,`ПРОГРЕСС\n\nДоставлено: ${gameSave.deliveries}\nЛучшая серия: ${gameSave.best}\nРепутация: ${gameSave.rep}\nДостижения: ${ach}/8\nСюжет: глава ${gameSave.story+1}\n\nESC — закрыть`,{fontSize:17,color:'#d7e8f2',lineSpacing:7,backgroundColor:'#0d1d28',padding:22}).setOrigin(.5);const close=()=>t.destroy();this.input.keyboard?.once('keydown-ESC',close);}
}

class Garage extends Phaser.Scene{
 panel!:Phaser.GameObjects.Container; info!:Phaser.GameObjects.Text;
 create(){this.cameras.main.setBackgroundColor('#08131c');this.drawBackdrop();this.render();this.input.keyboard?.on('keydown-ESC',()=>this.scene.start('Menu'));}
 drawBackdrop(){const g=this.add.graphics();g.fillStyle(0x0a151e);g.fillRect(0,0,this.scale.width,this.scale.height);for(let i=0;i<14;i++){g.lineStyle(1,0x203744,.5);g.lineBetween(i*120,0,i*120,this.scale.height)}this.add.text(42,34,'ГАРАЖ', {fontSize:30,color:'#e8f5ff',fontFamily:'Arial Black,Arial'});this.add.text(44,72,'Подготовь транспорт к следующей смене',{fontSize:14,color:'#718c9d'});this.add.text(this.scale.width-44,38,`${gameSave.money} ₽`,{fontSize:24,color:'#ffd36b'}).setOrigin(1,0)}
 render(){if(this.panel)this.panel.destroy();this.panel=this.add.container(42,120);const w=this.scale.width;
  VEHICLES.forEach((v,i)=>{const unlocked=gameSave.unlocked.includes(v.id);const selected=gameSave.vehicle===v.id;const x=(i%3)*(w*.29),y=Math.floor(i/3)*145;const bg=this.add.rectangle(x+120,y+60,230,116,selected?0x123d4c:0x10202a,.95).setOrigin(.5);bg.setStrokeStyle(selected?2:1,selected?0x54ddff:0x29404c);this.panel.add(bg);
   this.panel.add(this.add.text(x+18,y+16,`${v.name}${selected?'  ✓':''}`,{fontSize:17,color:'#e3f3fa'}));this.panel.add(this.add.text(x+18,y+44,`скорость ${v.speed}\nгруз ${v.capacity}  •  контроль ${Math.round(v.handling*100)}%`,{fontSize:12,color:'#87a7b7',lineSpacing:4}));
   const b=this.add.text(x+18,y+98,unlocked?(selected?'ВЫБРАНО':'ВЫБРАТЬ'):`КУПИТЬ ${v.price} ₽`,{fontSize:12,color:unlocked?'#66e4ff':'#ffd36b',backgroundColor:'#0b1820',padding:{left:8,right:8,top:5,bottom:5}}).setInteractive();b.on('pointerdown',()=>{if(unlocked){gameSave.vehicle=v.id;this.render();persist(gameSave)}else if(gameSave.money>=v.price){gameSave.money-=v.price;gameSave.unlocked.push(v.id);gameSave.vehicle=v.id;this.render();sdk.cloud(gameSave)}});this.panel.add(b);
  });
  const y=310;this.panel.add(this.add.text(0,y+10,'МОДЕРНИЗАЦИЯ',{fontSize:20,color:'#dceef5'}));UPGRADE.forEach((u,i)=>{const x=(i%3)*(w*.29),yy=y+50+Math.floor(i/3)*100,level=gameSave.upgrades[u.key],max=level>=u.max;this.panel.add(this.add.text(x,yy,`${u.name}  ${level}/${u.max}\n${u.desc}`,{fontSize:14,color:'#b9d0dc',lineSpacing:4}));const b=this.add.text(x+145,yy+4,max?'MAX':`+1  ${upgradeCost(u.key)} ₽`,{fontSize:12,color:max?'#68dc9a':'#ffd36b',backgroundColor:'#12232d',padding:{left:7,right:7,top:6,bottom:6}}).setInteractive();b.on('pointerdown',()=>{const c=upgradeCost(u.key);if(!max&&gameSave.money>=c){gameSave.money-=c;gameSave.upgrades[u.key]++;this.render();sdk.cloud(gameSave)}});this.panel.add(b)});
  this.panel.add(this.add.text(0,550,'ESC — назад в меню',{fontSize:14,color:'#668696'}));
 }
}

interface Job{x:number;y:number;reward:number;deadline:number;district:number;kind:MissionKind;name:string;steps:number;done:number;active:boolean}

class City extends Phaser.Scene{
 player!:Phaser.Physics.Arcade.Sprite; bodySprite!:Phaser.GameObjects.Container; cursors!:Phaser.Types.Input.Keyboard.CursorKeys; keys!:any;
 jobs:Job[]=[]; jobG!:Phaser.GameObjects.Graphics; hud!:Phaser.GameObjects.Text; mission!:Phaser.GameObjects.Text; toast!:Phaser.GameObjects.Text; minimap!:Phaser.GameObjects.Graphics;
 traffic:{r:Phaser.GameObjects.Rectangle;vx:number;vy:number}[]=[]; pedestrians:Phaser.GameObjects.Arc[]=[];
 current?:Job; fuel=100; worldTime=0; weather:Weather='clear'; weatherTimer=35; eventTimer=20; dayStart=0; paused=false; particles?:Phaser.GameObjects.Particles.ParticleEmitter;

 create(){
  this.physics.world.setBounds(0,0,1800,1200);this.cameras.main.setBounds(0,0,1800,1200);this.cameras.main.setZoom(1);
  this.makeWorld();this.makePlayer();this.makeJobs();this.makeTraffic();this.makePeople();this.makeUI();
  this.cursors=this.input.keyboard!.createCursorKeys();this.keys=this.input.keyboard!.addKeys('W,A,S,D,SHIFT,E,M,G,ESC');
  this.input.keyboard?.on('keydown-M',()=>this.toggleMap());this.input.keyboard?.on('keydown-G',()=>this.scene.start('Garage'));this.input.keyboard?.on('keydown-ESC',()=>this.scene.start('Menu'));
  this.input.keyboard?.on('keydown-E',()=>this.interact());
  this.dayStart=0;this.changeWeather('clear');
 }
 makeWorld(){const g=this.add.graphics();g.fillStyle(0x08131b);g.fillRect(0,0,1800,1200);
  DISTRICTS.forEach(d=>{g.fillStyle(d.color,.55);g.fillRect(d.x-300,d.y-220,600,440)});
  // city grid and avenues
  for(let x=55;x<1800;x+=150){g.fillStyle(0x15262f);g.fillRect(x,0,58,1200);g.fillStyle(0x32464f,.9);for(let y=12;y<1200;y+=52)g.fillRect(x+27,y,4,25)}
  for(let y=60;y<1200;y+=170){g.fillStyle(0x172830);g.fillRect(0,y,1800,72);g.fillStyle(0x33464d,.9);for(let x=8;x<1800;x+=58)g.fillRect(x,y+34,27,4)}
  // blocks/buildings
  for(let i=0;i<115;i++){const x=20+Math.floor(Math.random()*59)*30,y=18+Math.floor(Math.random()*39)*28;if((x%150)<60&&(y%170)<72)continue;const ww=18+Math.random()*35,hh=14+Math.random()*28;g.fillStyle(0x1c2d35,.9);g.fillRect(x,y,ww,hh);g.fillStyle(0x3d6570,.35);g.fillRect(x+4,y+4,ww-8,3)}
  DISTRICTS.forEach((d,i)=>{this.add.text(d.x,d.y-195,d.name,{fontSize:16,color:'#9bb7c2',fontFamily:'Arial Black,Arial'}).setOrigin(.5);if(i===0)this.add.circle(d.x,d.y,65,0x4edbff,.05)});
  // landmarks
  g.fillStyle(0x365462);g.fillRect(835,385,130,75);g.fillStyle(0x5a8b9a);g.fillRect(880,345,40,40);g.fillStyle(0x213a46);g.fillRect(1310,740,130,90);
 }
 makePlayer(){this.player=this.physics.add.sprite(300,620,'__DEFAULT');this.player.setVisible(false);this.player.setCollideWorldBounds(true);this.bodySprite=this.add.container(this.player.x,this.player.y);const shadow=this.add.ellipse(0,9,44,14,0x000000,.35);const bike=this.add.rectangle(0,0,34,17,0x42d9ff);bike.setStrokeStyle(2,0xbdf4ff);const light=this.add.circle(18,0,4,0xeaffff);this.bodySprite.add([shadow,bike,light]);this.cameras.main.startFollow(this.player,true,.09,.09)}
 makeJobs(){this.jobG=this.add.graphics();const names=['Экспресс','Аптека','Документы','Запчасти','Анонимная посылка','Еда','Срочный пакет'];const kinds:MissionKind[]=['standard','timed','fragile','multi','highrisk'];for(let i=0;i<10;i++){const d=i%DISTRICTS.length,dist=DISTRICTS[d];const x=clamp(dist.x-220+Math.random()*440,50,1750),y=clamp(dist.y-160+Math.random()*320,50,1150);this.jobs.push({x,y,reward:Math.round((90+Math.random()*160)*dist.pay),deadline:42+Math.random()*35,district:d,kind:kinds[i%kinds.length],name:names[i%names.length],steps:kinds[i%kinds.length]==='multi'?2:1,done:0,active:false})}}
 makeTraffic(){for(let i=0;i<22;i++){const horizontal=i%2===0;const r=this.add.rectangle(horizontal?Math.random()*1800:90+Math.floor(Math.random()*12)*150, horizontal?60+Math.floor(Math.random()*7)*170:Math.random()*1200,26,14,0x6b8995,.8);this.traffic.push({r,vx:horizontal?(55+Math.random()*80)*(i%4?1:-1):0,vy:horizontal?0:(55+Math.random()*80)*(i%3?1:-1)})}}
 makePeople(){for(let i=0;i<26;i++){const p=this.add.circle(Math.random()*1800,Math.random()*1200,3,0xd6c7aa,.55);this.pedestrians.push(p);}}
 makeUI(){const fixed=(o:Phaser.GameObjects.GameObject)=>o.setScrollFactor(0).setDepth(100);
  this.hud=fixed(this.add.text(20,18,'',{fontSize:16,color:'#e6f3f7',lineSpacing:5}));
  this.mission=fixed(this.add.text(20,105,'',{fontSize:15,color:'#9edcf0',backgroundColor:'#0b1b24',padding:{left:12,right:12,top:9,bottom:9},lineSpacing:5}));
  this.toast=fixed(this.add.text(this.scale.width/2,this.scale.height-65,'',{fontSize:17,color:'#effaff',backgroundColor:'#0d2632',padding:{left:18,right:18,top:9,bottom:9}}).setOrigin(.5));
  this.add.text(this.scale.width-20,18,'E — взять заказ   G — гараж   M — карта',{fontSize:12,color:'#7896a5'}).setOrigin(1,0).setScrollFactor(0).setDepth(100);
  this.minimap=fixed(this.add.graphics());this.drawMini();
 }
 drawMini(){const x=this.scale.width-188,y=52,w=168,h=112;this.minimap.clear();this.minimap.fillStyle(0x07131b,.92);this.minimap.fillRect(x,y,w,h);this.minimap.lineStyle(1,0x34515f);this.minimap.strokeRect(x,y,w,h);for(const d of DISTRICTS){this.minimap.fillStyle(d.color,.9);this.minimap.fillCircle(x+d.x/1800*w,y+d.y/1200*h,7)}for(const j of this.jobs){if(j.active)this.minimap.fillStyle(0x63e3ff);else this.minimap.fillStyle(0xf5c85c);this.minimap.fillCircle(x+j.x/1800*w,y+j.y/1200*h,2)}this.minimap.fillStyle(0xffffff);this.minimap.fillCircle(x+this.player.x/1800*w,y+this.player.y/1200*h,3);}
 interact(){if(this.current)return;let best:Job|undefined,dist=999;for(const j of this.jobs){if(j.active)continue;const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,j.x,j.y);if(d<dist&&d<125){best=j;dist=d}}if(best)this.accept(best);else this.notify('Подъедь ближе к жёлтой точке');}
 accept(j:Job){this.current=j;j.active=true;j.deadline+=gameSave.upgrades.nav*5;this.mission.setText(this.missionText());this.notify(`${j.name} принят • доставь груз`);}
 missionText(){if(!this.current)return'СВОБОДНЫЙ РЕЖИМ\nЖёлтые точки — доступные заказы';const j=this.current;const left=Math.ceil(j.deadline);const d=DISTRICTS[j.district];const extra=j.kind==='timed'?'СРОЧНО':j.kind==='fragile'?'ХРУПКО':j.kind==='multi'?'МАРШРУТ x2':j.kind==='highrisk'?'ВЫСОКИЙ РИСК':'СТАНДАРТ';return`ЗАКАЗ: ${j.name}\n${d.name} • ${j.reward} ₽ • ${extra}\nОсталось ${left} сек • E — взаимодействие`}
 update(_t:number,dt:number){if(this.paused)return;const sec=dt/1000;this.worldTime+=sec;this.weatherTimer-=sec;this.eventTimer-=sec;
  if(this.weatherTimer<=0){this.weatherTimer=45+Math.random()*45;const ws:Weather[]=['clear','rain','fog','storm'];this.changeWeather(ws[Math.floor(Math.random()*ws.length)])}
  if(this.eventTimer<=0){this.eventTimer=30+Math.random()*45;if(Math.random()<.7)this.roadEvent()}
  this.movePlayer(dt);this.moveTraffic(sec);this.movePeople(sec);this.updateMission(sec);this.updateVisuals(sec);this.hud.setText(`НОВОГРАД  •  ДЕНЬ ${gameSave.day}  ${this.clock()}\n${this.weather.toUpperCase()}  •  ${vehicle().name}\nСкорость ${Math.round(this.speed())}  •  Энергия ${Math.round(this.fuel)}%\nREP ${gameSave.rep}  •  Серия x${gameSave.streak}  •  ${gameSave.money} ₽`);this.mission.setText(this.missionText());this.drawMini();
 }
 movePlayer(dt:number){const k=this.keys;let dx=0,dy=0;if(this.cursors.left.isDown||k.A.isDown)dx--;if(this.cursors.right.isDown||k.D.isDown)dx++;if(this.cursors.up.isDown||k.W.isDown)dy--;if(this.cursors.down.isDown||k.S.isDown)dy++;const boost=k.SHIFT.isDown&&this.fuel>0;const v=vehicle();const s=v.speed+gameSave.upgrades.engine*18;const weatherMult=this.weather==='rain'?.9:this.weather==='storm'?.78:1;const sp=s*weatherMult*(boost?1.65:1)*(v.handling+gameSave.upgrades.brakes*.035);if(dx||dy){const vec=new Phaser.Math.Vector2(dx,dy).normalize().scale(sp);this.player.setVelocity(vec.x,vec.y);this.bodySprite.rotation=vec.angle();if(boost)this.fuel=Math.max(0,this.fuel-dt*.018*(1+gameSave.upgrades.engine*.1));else this.fuel=Math.min(this.maxFuel(),this.fuel+dt*.006)}else{this.player.setVelocity(0);this.fuel=Math.min(this.maxFuel(),this.fuel+dt*.012)}this.bodySprite.setPosition(this.player.x,this.player.y)}
 speed(){return Math.hypot(this.player.body?.velocity.x||0,this.player.body?.velocity.y||0)}
 maxFuel(){return 100+gameSave.upgrades.battery*18}
 moveTraffic(sec:number){for(const q of this.traffic){q.r.x+=q.vx*sec;q.r.y+=q.vy*sec;if(q.r.x>1830)q.r.x=-30;if(q.r.x<-30)q.r.x=1830;if(q.r.y>1230)q.r.y=-30;if(q.r.y<-30)q.r.y=1230;const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,q.r.x,q.r.y);if(d<25&&this.speed()>70){this.fuel=Math.max(0,this.fuel-7);gameSave.streak=0;this.notify('СТОЛКНОВЕНИЕ • -7% энергии • серия сбита');q.r.x+=q.vx>0?-45:45}}}
 movePeople(sec:number){this.pedestrians.forEach((p,i)=>{p.x+=Math.sin(this.worldTime*.7+i)*sec*4;p.y+=Math.cos(this.worldTime*.5+i)*sec*3})}
 updateMission(sec:number){const j=this.current;if(!j)return;j.deadline-=sec;const d=Phaser.Math.Distance.Between(this.player.x,this.player.y,j.x,j.y);if(j.deadline<=0){j.active=false;this.current=undefined;gameSave.streak=0;this.notify('ЗАКАЗ ПРОВАЛЕН • серия сбита');return}if(d<38){if(j.steps>1&&j.done<1){j.done=1;j.x=clamp(j.x+(Math.random()-.5)*300,60,1740);j.y=clamp(j.y+(Math.random()-.5)*220,60,1140);j.deadline+=25;this.notify('ПРОМЕЖУТОЧНАЯ ТОЧКА ✓ • следуй дальше');return}this.complete(j)}}
 complete(j:Job){const bonus=j.kind==='timed'?1.25:j.kind==='fragile'?1.18:j.kind==='highrisk'?1.4:j.kind==='multi'?1.3:1;const streakBonus=1+Math.min(gameSave.streak,10)*.04;const reward=Math.round(j.reward*bonus*streakBonus);gameSave.money+=reward;gameSave.rep+=j.kind==='highrisk'?5:3;gameSave.deliveries++;gameSave.streak++;gameSave.best=Math.max(gameSave.best,gameSave.streak);gameSave.story=Math.min(7,Math.floor(gameSave.deliveries/5));j.active=false;this.current=undefined;this.notify(`ДОСТАВЛЕНО ✓  +${reward} ₽  • серия x${gameSave.streak}`);this.achievementCheck();persist(gameSave);sdk.cloud(gameSave);if(gameSave.deliveries%5===0)sdk.fullscreen()}
 achievementCheck(){const tests:[string,boolean][]=[['first',gameSave.deliveries>=1],['ten',gameSave.deliveries>=10],['streak5',gameSave.best>=5],['rich',gameSave.money>=5000],['rep50',gameSave.rep>=50],['allvehicles',gameSave.unlocked.length>=5],['story',gameSave.story>=7],['nightowl',this.worldTime>=180]];tests.forEach(([id,ok])=>{if(ok&&!gameSave.achievements.includes(id)){gameSave.achievements.push(id);this.notify(`ДОСТИЖЕНИЕ: ${id.toUpperCase()} ✓`)}})}
 roadEvent(){const names=['ПЕРЕКРЫТИЕ','ДТП','ПОЛИЦЕЙСКИЙ КОНТРОЛЬ','СБОЙ СВЕТОФОРОВ'];this.notify(`${names[Math.floor(Math.random()*names.length)]} • объедь участок`);const g=this.add.graphics().setDepth(8);const x=150+Math.random()*1500,y=100+Math.random()*1000;g.fillStyle(0xff735c,.28);g.fillCircle(x,y,55);this.tweens.add({targets:g,alpha:0,duration:8000,onComplete:()=>g.destroy()})}
 changeWeather(w:Weather){this.weather=w;const g=this.add.graphics().setScrollFactor(0).setDepth(80);if(w==='rain'||w==='storm'){for(let i=0;i<120;i++){g.lineStyle(1,0x8fc7e8,w==='storm'?.35:.2);const x=Math.random()*this.scale.width,y=Math.random()*this.scale.height;g.lineBetween(x,y,x-3,y+14)}}else if(w==='fog'){g.fillStyle(0x8796a0,.16);g.fillRect(0,0,this.scale.width,this.scale.height)}this.tweens.add({targets:g,alpha:0,duration:4200,onComplete:()=>g.destroy()});this.notify(`ПОГОДА: ${w.toUpperCase()}`)}
 updateVisuals(sec:number){const night=0.08+Math.sin(this.worldTime/55)*.03;this.cameras.main.setAlpha(1-night*.2);if(this.worldTime-this.dayStart>360){gameSave.day++;this.dayStart=this.worldTime;persist(gameSave);this.notify(`НОВЫЙ ДЕНЬ • ДЕНЬ ${gameSave.day}`)}}
 clock(){const minutes=Math.floor((this.worldTime/2)%360);const h=18+Math.floor(minutes/60),m=minutes%60;return`${String(h%24).padStart(2,'0')}:${String(m).padStart(2,'0')}`}
 notify(text:string){this.toast.setText(text);this.toast.setAlpha(1);this.tweens.killTweensOf(this.toast);this.tweens.add({targets:this.toast,alpha:0,delay:2300,duration:700})}
 toggleMap(){this.cameras.main.zoom=this.cameras.main.zoom>1?1:1.45;this.notify(this.cameras.main.zoom>1?'КАРТА: обзор города':'КАРТА: обычный режим')}
}

new Phaser.Game({type:Phaser.AUTO,parent:'game',width:1280,height:720,backgroundColor:'#071018',physics:{default:'arcade',arcade:{gravity:{x:0,y:0},debug:false}},scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[Boot,Menu,City,Garage],render:{antialias:true,pixelArt:false},input:{activePointers:3}});
