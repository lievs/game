import Phaser from 'phaser';
import './style.css';

type Save = { money:number; day:number; reputation:number; bikeLevel:number; battery:number; maxBattery:number; speed:number; deliveries:number; streak:number; bestStreak:number };
const DEFAULT: Save = { money:650, day:1, reputation:0, bikeLevel:1, battery:100, maxBattery:100, speed:190, deliveries:0, streak:0, bestStreak:0 };

class YandexBridge {
  ysdk:any = null; player:any = null;
  async init(){
    try{
      for(let i=0;i<100 && !(window as any).YaGames;i++) await new Promise(r=>setTimeout(r,50));
      const Y=(window as any).YaGames; if(!Y) return;
      this.ysdk=await Y.init();
      try{ this.player=await this.ysdk.getPlayer({scopes:false}); }catch{}
    }catch(e){ console.warn('Yandex SDK unavailable',e); }
  }
  ready(){ try{ this.ysdk?.features?.LoadingAPI?.ready(); }catch{} }
  async load():Promise<Partial<Save>|null>{ try{return this.player?await this.player.getData(['save']):null;}catch{return null;} }
  async save(save:Save){ try{await this.player?.setData({save},true);}catch{} }
  ad(){ try{this.ysdk?.adv?.showFullscreenAdv({callbacks:{onError:()=>{}}});}catch{} }
  reward(cb:()=>void){ try{this.ysdk?.adv?.showRewardedVideo({callbacks:{onRewarded:cb,onError:()=>{},onClose:()=>{}}});}catch{} }
}
const bridge=new YandexBridge();

class Boot extends Phaser.Scene{
  constructor(){super('Boot')}
  create(){this.scene.start('Game');}
}

class Game extends Phaser.Scene{
  save:Save={...DEFAULT};
  rider!:Phaser.GameObjects.Container; target!:Phaser.GameObjects.Container; ui!:Phaser.GameObjects.Container;
  cursors!:Phaser.Types.Input.Keyboard.CursorKeys; keys!:any; map!:Phaser.GameObjects.Graphics;
  worldW=2400; worldH=1600; carrying=false; packageName='Лекарства'; packageReward=220; targetZone='Медцентр'; deliveryStart=0;
  messageTimer=0; message=''; roadRects:{x:number;y:number;w:number;h:number}[]=[];

  constructor(){super('Game')}
  async create(){
    const local=localStorage.getItem('last-courier-save'); if(local) try{this.save={...DEFAULT,...JSON.parse(local)}}catch{}
    const cloud=await bridge.load(); if(cloud?.save) this.save={...this.save,...cloud.save};
    this.makeTextures(); this.buildCity(); this.makePlayer(); this.makeUI(); this.newMission();
    this.cursors=this.input.keyboard!.createCursorKeys(); this.keys=this.input.keyboard!.addKeys('W,A,S,D,SHIFT,SPACE');
    this.cameras.main.setBounds(0,0,this.worldW,this.worldH); this.cameras.main.startFollow(this.rider,true,.08,.08); this.cameras.main.setZoom(.95);
    bridge.ready(); this.persist();
  }
  makeTextures(){
    const g=this.make.graphics({x:0,y:0});
    g.fillStyle(0x000000,.25);g.fillEllipse(32,42,48,14);g.generateTexture('shadow',64,64);g.clear();
    g.fillStyle(0x13d7ff);g.fillCircle(24,30,12);g.fillCircle(52,30,12);g.lineStyle(5,0xd9f7ff);g.strokeCircle(24,30,10);g.strokeCircle(52,30,10);g.lineBetween(24,30,38,14);g.lineBetween(38,14,52,30);g.lineBetween(38,14,24,30);g.generateTexture('bike',76,52);g.clear();
    g.fillStyle(0x9bf6ff);g.fillCircle(22,22,9);g.fillStyle(0x0c1728);g.fillCircle(25,20,3);g.fillStyle(0xffb45b);g.fillRoundedRect(7,29,30,15,5);g.generateTexture('rider',48,52);g.clear();g.destroy();
  }
  buildCity(){
    this.map=this.add.graphics().setDepth(-20);this.map.fillStyle(0x07101d);this.map.fillRect(0,0,this.worldW,this.worldH);
    this.map.fillStyle(0x0b2638);this.map.fillRect(0,0,310,this.worldH);this.map.fillRect(2020,0,380,this.worldH);
    const roads=[{x:310,y:180,w:1710,h:180},{x:310,y:650,w:1710,h:180},{x:310,y:1120,w:1710,h:180},{x:650,y:0,w:170,h:1600},{x:1240,y:0,w:190,h:1600},{x:1730,y:0,w:180,h:1600}];
    for(const r of roads){this.roadRects.push(r);this.map.fillStyle(0x18283a);this.map.fillRect(r.x,r.y,r.w,r.h);this.map.lineStyle(2,0x31445b,.6);this.map.strokeRect(r.x,r.y,r.w,r.h);}
    this.map.lineStyle(3,0x7c8fa3,.28);for(const r of roads){if(r.w>r.h){for(let x=r.x+20;x<r.x+r.w;x+=70)this.map.lineBetween(x,r.y+r.h/2,x+35,r.y+r.h/2)}else{for(let y=r.y+20;y<r.y+r.h;y+=70)this.map.lineBetween(r.x+r.w/2,y,r.x+r.w/2,y+35)}}
    const colors=[0x132235,0x172b3d,0x1b3146,0x22384d];let idx=0;
    for(let x=350;x<2000;x+=125)for(let y=30;y<1550;y+=125){const inRoad=this.roadRects.some(r=>x+100>r.x&&x<r.x+r.w&&y+100>r.y&&y<r.y+r.h);if(inRoad)continue;const c=colors[idx++%colors.length];this.map.fillStyle(c,.95);this.map.fillRoundedRect(x,y,100,100,10);this.map.lineStyle(1,0x36506a,.7);this.map.strokeRoundedRect(x,y,100,100,10);this.map.fillStyle(0x75a6c9,.13);for(let wx=x+14;wx<x+90;wx+=25)for(let wy=y+16;wy<y+85;wy+=25)this.map.fillRect(wx,wy,8,8)}
    this.landmark(520,240,'ДИСПЕТЧЕРСКАЯ');this.landmark(1510,740,'МЕДЦЕНТР');this.landmark(1890,1240,'МАГАЗИН');this.landmark(880,1360,'ДОМ №17');
  }
  landmark(x:number,y:number,label:string){const c=this.add.container(x,y).setDepth(2);const b=this.add.rectangle(0,0,132,54,0x0a1625,.94).setStrokeStyle(2,0x3d607b,.8);const l=this.add.text(0,0,label,{fontFamily:'Arial',fontSize:'11px',color:'#bfe9ff',fontStyle:'bold'}).setOrigin(.5);c.add([b,l]);}
  makePlayer(){this.rider=this.add.container(900,500).setDepth(20);this.rider.add(this.add.image(0,15,'shadow'));this.rider.add(this.add.image(0,5,'bike'));this.rider.add(this.add.image(0,-18,'rider'));}
  makeUI(){
    this.ui=this.add.container(0,0).setScrollFactor(0).setDepth(100);this.ui.add(this.add.rectangle(0,0,1100,86,0x06101d,.9).setOrigin(0));
    this.ui.add(this.add.text(24,17,'ПОСЛЕДНИЙ КУРЬЕР',{fontFamily:'Arial',fontSize:'21px',fontStyle:'bold',color:'#e9fbff'}));
    const stats=this.add.text(25,49,'',{fontFamily:'Arial',fontSize:'14px',color:'#8bb6ca'});(stats as any).name='stats';this.ui.add(stats);
    const mission=this.add.container(730,10);mission.add(this.add.rectangle(0,0,350,68,0x0d1b2a,.94).setOrigin(0).setStrokeStyle(1,0x2b526a));mission.add(this.add.text(16,10,'ТЕКУЩИЙ ЗАКАЗ',{fontSize:'12px',fontStyle:'bold',color:'#7de7ff'}));const mt=this.add.text(16,31,'',{fontSize:'14px',color:'#fff'});(mt as any).name='mission';mission.add(mt);this.ui.add(mission);
    const hint=this.add.text(24,0,'WASD / стрелки — ехать   SHIFT — форсаж   SPACE — взять / сдать',{fontSize:'13px',color:'#8ca8b8'}).setScrollFactor(0).setDepth(100);this.scale.on('resize',()=>hint.setY(this.scale.height-30));hint.setY(this.scale.height-30);
  }
  update(){
    if(!this.rider)return;const dt=this.game.loop.delta/1000;let vx=0,vy=0;if(this.cursors.left.isDown||this.keys.A.isDown)vx=-1;if(this.cursors.right.isDown||this.keys.D.isDown)vx=1;if(this.cursors.up.isDown||this.keys.W.isDown)vy=-1;if(this.cursors.down.isDown||this.keys.S.isDown)vy=1;
    const boost=this.keys.SHIFT.isDown&&this.save.battery>0?1.65:1;if(boost>1)this.save.battery=Math.max(0,this.save.battery-dt*7);else this.save.battery=Math.min(this.save.maxBattery,this.save.battery+dt*2.2);
    if(vx||vy){const len=Math.hypot(vx,vy)||1;this.rider.x=Phaser.Math.Clamp(this.rider.x+vx/len*this.save.speed*boost*dt,330,1990);this.rider.y=Phaser.Math.Clamp(this.rider.y+vy/len*this.save.speed*boost*dt,30,1570);this.rider.rotation=Phaser.Math.Angle.RotateTo(this.rider.rotation,Math.atan2(vy,vx)+Math.PI/2,.15);}
    if(Phaser.Input.Keyboard.JustDown(this.keys.SPACE))this.interact();this.updateMissionUI();if(this.messageTimer>0){this.messageTimer-=dt;if(this.messageTimer<=0)this.message='';}
  }
  interact(){
    const d=Phaser.Math.Distance.Between(this.rider.x,this.rider.y,this.target.x,this.target.y);
    if(!this.carrying){if(d<115){this.carrying=true;this.deliveryStart=this.time.now;this.pop('ПОСЫЛКА ПОЛУЧЕНА');}}
    else if(d<120){const time=(this.time.now-this.deliveryStart)/1000;let reward=this.packageReward;if(time<30)reward+=80;else if(time>70)reward-=45;this.save.money+=reward;this.save.deliveries++;this.save.reputation+=time<45?3:1;this.save.streak++;this.save.bestStreak=Math.max(this.save.bestStreak,this.save.streak);this.carrying=false;this.pop('ДОСТАВЛЕНО  +'+reward+' ₽');this.persist();this.newMission();if(this.save.deliveries%4===0)bridge.ad();}
  }
  newMission(){this.carrying=false;const missions=[['Медцентр',1510,740,'Лекарства',260],['Магазин',1890,1240,'Запчасти',230],['Дом №17',880,1360,'Еда',190],['Диспетчерская',520,240,'Документы',310]];const m=Phaser.Utils.Array.GetRandom(missions) as any;this.targetZone=m[0];this.packageName=m[3];this.packageReward=m[4];if(this.target)this.target.destroy();this.target=this.add.container(m[1],m[2]).setDepth(10);const ring=this.add.circle(0,0,58,0x17d7ff,.08).setStrokeStyle(3,0x6cf0ff,.9);const arrow=this.add.text(0,-75,'↓',{fontSize:'28px',color:'#7deeff'}).setOrigin(.5);const label=this.add.text(0,72,m[0],{fontSize:'12px',fontStyle:'bold',color:'#c8f7ff',backgroundColor:'#071523',padding:{x:6,y:4}}).setOrigin(.5);this.target.add([ring,arrow,label]);this.tweens.add({targets:ring,scale:1.18,alpha:.35,duration:850,yoyo:true,repeat:-1});this.updateMissionUI();}
  updateMissionUI(){const s=this.ui.getByName('stats') as Phaser.GameObjects.Text;if(s)s.setText(`День ${this.save.day}   •   💰 ${Math.floor(this.save.money)} ₽   •   ★ ${this.save.reputation}   •   🔋 ${Math.floor(this.save.battery)}%   •   Серия ${this.save.streak}`);const m=this.ui.getByName('mission') as Phaser.GameObjects.Text;if(m)m.setText(`${this.packageName} → ${this.targetZone}   +${this.packageReward} ₽`);}
  pop(text:string){const t=this.add.text(this.rider.x,this.rider.y-70,text,{fontSize:'22px',fontStyle:'bold',color:'#d9fbff',stroke:'#06111c',strokeThickness:6}).setOrigin(.5).setDepth(200);this.tweens.add({targets:t,y:t.y-55,alpha:0,duration:1200,ease:'Cubic.easeOut',onComplete:()=>t.destroy()});}
  async persist(){localStorage.setItem('last-courier-save',JSON.stringify(this.save));await bridge.save(this.save);}
}

(async()=>{await bridge.init();new Phaser.Game({type:Phaser.AUTO,parent:'game',backgroundColor:'#07101d',width:1100,height:800,scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.CENTER_BOTH},render:{antialias:true,powerPreference:'high-performance'},scene:[Boot,Game],fps:{target:60}})})();
