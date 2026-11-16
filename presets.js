'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),clone=o=>JSON.parse(JSON.stringify(o));
const bankNames=['Prism','Hollow','Vocal','Metal','Saw → pulse','Sine → triangle','Maximus Saw2Square','Odd glass','Bowed spectrum','Reed choir','Sync folds','Organ drawbars'];
const presetBanks=['01 / Classic & vintage','02 / Spectral keys','03 / Evolving atmospheres','04 / Bass & motion','05 / Layers & experiments','06 / Tribal & psy'];
const sources=['LFO 1','LFO 2','LFO 3','LFO 4','Amp envelope','Filter envelope','Mod envelope 1','Mod envelope 2','Wave env 1','Wave env 2','Wave env 3','Velocity','Key track','Mod wheel','Aftertouch','Random','Pitch wheel','Expression','Breath','Sustain','Poly pressure','Note gate','Sequence step','Sequence velocity','LFO 1 unipolar','LFO 2 unipolar','LFO 3 unipolar','LFO 4 unipolar','Mod envelope 1 bipolar','Mod envelope 2 bipolar'];
const destinations=['Wave 1','Wave 2','Wave 3','Pitch 1','Pitch 2','Pitch 3','Level 1','Level 2','Level 3','Cutoff','Resonance','Drive','Pan','Amplitude','FM 2 → 1','FM 3 → 1','FM 1 → 2','FM 3 → 2','FM 1 → 3','FM 2 → 3','Second cutoff','Second morph','Pulse width'];
for(let o=1;o<=3;o++)for(let j=1;j<=6;j++)destinations.push(`Wave ${o} point ${j}`);
for(let o=1;o<=3;o++)for(let j=1;j<=6;j++)destinations.push(`Wave ${o} time ${j}`);
for(let o=1;o<=3;o++)destinations.push(`Wave ${o} amount`);
for(const key of ['rate','depth','pulse','delay'])for(let i=1;i<=4;i++)destinations.push(`LFO ${i} ${key}`);
for(let i=1;i<=4;i++)for(const key of ['attack','decay','sustain','release'])destinations.push(`Envelope ${i} ${key}`);
for(let i=1;i<=4;i++)destinations.push(`Envelope ${i} delay`);
for(let i=1;i<=2;i++)for(const key of ['mix','time','feedback','rate','depth','tone','drive','decay','damping','spread'])destinations.push(`FX ${i} ${key}`);
for(let i=1;i<=3;i++)destinations.push(`Osc ${i} vintage`);
for(let i=1;i<=3;i++)destinations.push(`Osc ${i} fine`);
destinations.push('Bass compensation','Second resonance','Voice spread');
function env(a=.01,d=.4,s=.6,r=.6){return {a,d,s,r,delay:0,curve:'exponential'};}
function oscillator(i){return {mode:'wavetable',analog:'saw',pulse:.5,sync:false,sampleLoop:false,sampleCrossfade:.02,upper:false,bank:[0,1,5][i],pos:[.28,.45,.1][i],level:[.65,.3,.2][i],semi:i===2?-12:0,fine:[0,7,-4][i],vintage:0,interpolate:true,phaseInterp:true,wave:{amount:.2,loop:true,points:[.1,.8,.35,.9,.45,.1],times:[.5,.7,.8,1,.8,1.2]}};}
const effectTypes=['bypass','stereo delay','tape','BBD','chorus','phaser','flanger','distortion','rotary','ring mod','room','hall','plate'];
function effect(type){return {type,mix:type==='tape'?.2:.22,time:.75,feedback:.32,rate:.3,depth:.4,tone:4200,drive:1.2,decay:.7,damping:.45,spread:.6};}
const dialPorts = {
 cutoff:['Cutoff',20,20000,true],res:['Resonance',0,3.9],drive:['Saturation',.4,8],
 'envs.0.a':['Amp attack',.001,8,true],'envs.0.r':['Amp release',.01,12,true],drift:['Slow drift',0,1],level:['Part level',0,1],
 'effects.0.mix':['FX 1 mix',0,1],'effects.1.mix':['FX 2 mix',0,1],
 'envs.1.a':['Filter attack',.001,20,true],'envs.1.d':['Filter decay',.001,20,true],'envs.1.s':['Filter sustain',0,1],'envs.1.r':['Filter release',.001,20,true],
 env:['Envelope depth',-5,8],'filterMotion.rate':['Free rate',.025,16,true],'filterMotion.motionDepth':['Motion depth',-5,5],
 'filterMotion.resAmount':['Resonance motion',-2,2],'filterMotion.satAmount':['Saturation motion',-3,3]
};
function portOwner(part,id){const keys=id.split('.');keys.pop();return keys.reduce((v,k)=>v[k],part);}
function portValue(part,id){return portOwner(part,id)[id.split('.').pop()];}
function portFraction(id,v){const [,lo,hi,log]=dialPorts[id];return log?Math.log(v/lo)/Math.log(hi/lo):(v-lo)/(hi-lo);}
function portScale(id,f){const [,lo,hi,log]=dialPorts[id];return log?lo*(hi/lo)**f:lo+(hi-lo)*f;}
function orderedLinks(links){
 if(!Array.isArray(links)||links.length>64)throw Error('Maximum 64 connections per part.');
 const pending=links.slice(),order=[],seen=new Set();
 for(const r of pending){if(!r||!Object.hasOwn(dialPorts,r.from)||!Object.hasOwn(dialPorts,r.to)||!Number.isFinite(r.anchor)||!Number.isFinite(r.amount)||Math.abs(r.amount)>1)throw Error('Invalid dial connection.');
 const id=r.from+'>'+r.to;if(seen.has(id))throw Error('This connection already exists.');seen.add(id);}
 while(pending.length){const i=pending.findIndex(r=>!pending.some(other=>other.to===r.from));if(i<0)throw Error('That connection would create a feedback loop.');order.push(pending.splice(i,1)[0]);}
 return order;
}
function effectivePorts(part){
 const sums={},values={};
 for(const r of orderedLinks(part.dialLinks||[])){
 const source=values[r.from]??portFraction(r.from,portValue(part,r.from));
 sums[r.to]=(sums[r.to]||0)+(source-r.anchor)*r.amount;
 values[r.to]=Math.min(1,Math.max(0,portFraction(r.to,portValue(part,r.to))+sums[r.to]));
 }return values;
}
function routedState(state){
 if(!state.parts.some(p=>p.dialLinks?.length))return state;
 return {...state,parts:state.parts.map(p=>{if(!p.dialLinks?.length)return p;
 const copy={...p,envs:p.envs.map(e=>({...e})),effects:p.effects.map(e=>({...e})),filterMotion:{...p.filterMotion}};
 for(const [id,f] of Object.entries(effectivePorts(p)))portOwner(copy,id)[id.split('.').pop()]=portScale(id,f);
 return copy;})};
}
Object.assign(window,{dialPorts,portOwner,portValue,portFraction,portScale,orderedLinks,effectivePorts});

function newFilterMotion(){return {mode:'both',clock:'sync',beats:4,rate:.5,motionDepth:0,resAmount:0,satAmount:0,points:Array.from({length:16},(_,i)=>Math.round(Math.sin(i*Math.PI/8)*100)/100)};}
function part(i=0){return {filterMotion:newFilterMotion(),enabled:i===0,midiChannel:0,unison:1,chord:'Off',unisonDetune:12,arp:{enabled:false,mode:'up',octaves:1,division:.5,gate:.6},level:.65,pan:0,low:0,high:127,osc:[0,1,2].map(oscillator),cutoff:2800,res:1,hp:45,svmode:'highpass',svmorph:0,svq:.7,drive:1.4,bassComp:.65,env:2,envs:[env(.02,.6,.6,1.2),env(.04,.8,.3,1),env(.3,1,.4,1),env(1,1,.7,1)],lfos:[0,1,2,3].map(i=>({rate:[.23,.13,.7,2.3][i],shape:'sine',depth:1,pulse:.5,delay:0,poly:true,sync:false,division:[4,8,1,.5][i],reset:i!==1})),fm:[[0,0,0],[0,0,0],[0,0,0]],variation:.12,drift:.1,spread:.2,fixed:['Velocity','Key track','Mod wheel','Aftertouch','Expression','Breath','Sustain','Pitch wheel','Mod envelope 1','Mod envelope 2','LFO 3','LFO 4'].map(src=>({src,dst:'Cutoff',amount:0,via:'None'})),mods:Array.from({length:16},(_,j)=>({src:j===0?'LFO 1':j===1?'LFO 2':j===2?'Velocity':'LFO 3',dst:j===0?'Wave 1':j===1?'Pan':'Cutoff',amount:j===0?.15:j===1?.2:j===2?.15:0,via:'None'})),fx:{chorus:.15,chorusRate:.3,chorusDepth:.003,delay:.22,feedback:.32,delayBeat:.75,delayTone:4200,reverb:.22,decay:.7,damping:.45},effects:[effect('tape'),effect('hall')]};}
function newPattern(i=0){return {name:'Pattern '+String(i+1).padStart(2,'0'),bars:1,division:4,parts:[0,1,2,3].map((_,pi)=>Array.from({length:16},(_,j)=>({notes:[48+[0,7,12,7,3,10,15,10,5,12,17,12,3,10,7,10][j]],on:i===0,vel:j%4===0?.85:.65,cutoff:null,wave:null})))};}
function baseState(){return {version:2,maxVoices:24,patterns:Array.from({length:24},(_,i)=>newPattern(i)),pattern:0,song:[0],songMode:false,record:false,parts:[0,1,2,3].map(part),selected:0,bpm:108,volume:.55,sequence:[0,7,12,7,3,10,15,10,5,12,17,12,3,10,7,10].map((n,i)=>({note:48+n,on:true,vel:i%4===0?.85:.65})),gate:.65,swing:0,patch:'Glass estuary',program:0};}
const families=[
['Glass estuary','Feral current','Velvet horizon','Prismatic bells','Copper stab','Choir of tides','Night transmission','Fourfold bloom','Initial state','Amber strings','Juno-inspired brass','Reed ensemble','Vintage organ','PWM orchestra','Soft sync lead','Dusty clavinet','Hollow flute','Brass swell','Tape choir','Electric reed'],
['Prism piano','Glass marimba','Crystal tine','Copper mallet','Muted kalimba','Hollow pluck','FM celesta','Digital clav','Vocal keys','Spectral harpsichord','Bell cascade','Water droplets','Reed struck','Metal bars','Wire harp','Chime cluster','Resonant wood','Icy plucks','Soft electric','Bright compass'],
['Tidal choir','Bowed horizon','Violet cloud','Spectral aurora','Low gravity','Moving glass','Shimmer field','Reed nebula','Distant strings','Breathing prism','Frozen organ','Warm current','Hollow mist','Metallic dusk','Deep bloom','Polar light','Evolving ribbon','Falling stars','Slow aperture','Quiet ocean'],
['Sub current','Acid contour','Hollow bass','Rubber pulse','FM growl','Round pluck','Sync engine','Reed bass','Sequenced copper','Talking bass','Dark saw','Moving fifth','Elastic low','Digital bite','Pulse runner','Metal low','Vocal step','Resonant knock','Muted drive','Bass orbit'],
['Fourfold prism','Split horizon','Bell and cloud','Low and high','Cross-mod choir','Glass machine','Stereo braid','FM weather','Split brass','Harmonic engine','Threefold chime','Organ and reed','Sub and shimmer','Moving intervals','Metallic ribbon','Resonant galaxy','Layered copper','Dual aperture','Slow machinery','Wide transmission']];
const variations=[['Pure','Warm','Bright','Soft','Wide'],['Clear','Muted','Glass','Long','Wide'],['Still','Drifting','Open','Dark','Immense'],['Tight','Driven','Open','Short','Wide'],['Close','Orbit','Bright','Slow','Wide']];
const factory=[];for(let b=0;b<5;b++)for(let f=0;f<20;f++)for(let v=0;v<5;v++){let i=b*100+f*5+v;factory.push([families[b][f]+(v?' · '+variations[b][v]:''),`${presetBanks[b].slice(5)} · ${variations[b][v]} variation`,null,b,f,v]);}

// ---- 06 / Tribal & psy: built from the CONTINUUM 00_Tribal_Psy_8LFO_Master reference step tables ----
const TRIBAL_LFO={
 bass:[0,10,10,10,0,10,10,10,0,10,10,10,0,10,10,10],
 acid:[8,0,4,10,0,6,0,9,3,0,10,0,7,4,0,10],
 tribal:[10,0,0,8,0,0,9,0,10,0,0,7,0,5,0,9],
 tabla:[6,0,0,0,8,0,4,0,10,0,0,6,9,10,8,10],
 swell:[1,1,2,2,3,4,5,6,6,7,8,8,9,9,10,10],
 hijaz:[0,12,7,4,1,5,7,12,8,7,4,1,0,4,7,10],
 gate:[10,0,10,10,0,10,0,10,10,0,10,0,10,10,0,10],
 glitch:['R','R',0,'R','R',0,'R','R',0,'R','R',0,'R','R','R',10]};
const tribalNames=['Tribal Psy · 8 LFO scenes','Tribal Psy · Melodic techno','Tribal Psy · Dark ritual','Tribal Psy · Hijaz lead'];
const tribalScenes=['Full groove','LFO 1 · Psy bass gallop','LFO 2 · 303 acid squelch','LFO 3 · Afro-tribal euclidean','LFO 4 · Tabla ratchet','LFO 5 · Shamanic breath swell','LFO 6 · Hijaz arpeggio','LFO 7 · Trance gate chop','LFO 8 · Quantum glitch'];
function tribalStep(on,notes,vel,cutoff=null,wave=null){return {notes,on,vel:clamp(vel,.05,1),cutoff,wave};}
function tribalProgram(v){
 const state=baseState(),root=40,E=v===1?.7:1; // E Phrygian dominant
 const scale=[0,1,4,5,7,8,10];
 state.program=500+v;state.patch=tribalNames[v];state.bpm=[138,124,132,138][v];state.gate=v===1?.55:.45;state.swing=v===1?.06:0;
 const zero=p=>{p.mods.forEach(m=>m.amount=0);p.fixed.forEach(m=>m.amount=0);p.osc.forEach(o=>{o.wave.amount=0;o.vintage=0;});p.variation=.03;p.drift=.02;};
 // Part 1: rolling psy bass (engine A wavetable -12, detuned pair, sine sub, LP24 180 Hz)
 const b=state.parts[0];zero(b);b.enabled=true;b.level=.7;b.pan=0;
 Object.assign(b.osc[0],{mode:'wavetable',bank:4,pos:.15,semi:-12,fine:0,level:.7});
 Object.assign(b.osc[1],{mode:'wavetable',bank:4,pos:.18,semi:-12,fine:8,level:.4});
 Object.assign(b.osc[2],{mode:'analog',analog:'sine',semi:-12,fine:0,level:.55});
 Object.assign(b,{cutoff:v===2?150:v===1?240:180,res:1.25,drive:1.6,env:3.2,hp:20,svmode:'highpass',bassComp:.85,spread:.25});
 b.envs[0]=env(.002,.45,.85,.045);b.envs[1]=env(.0005,.095,0,.04);b.mods[2]={src:'Velocity',dst:'Cutoff',amount:.2,via:'None'};
 b.filterMotion.mode='envelope';b.effects=[{...effect('tape'),mix:.08},{...effect('room'),mix:.05}];
 // Part 2: 303-style acid squelch (wave + cutoff motion from LFO 2)
 const a=state.parts[1];zero(a);a.enabled=true;a.level=.85;a.pan=-.15;
 Object.assign(a.osc[0],{mode:'wavetable',bank:4,pos:.15,semi:0,level:.75});a.osc[1].level=0;a.osc[2].level=0;
 Object.assign(a,{cutoff:v===2?320:420,res:v===2?3.4:3,drive:2.4,env:3,hp:60,svmode:'highpass'});
 a.envs[0]=env(.002,.25,.5,.06);a.envs[1]=env(.001,.18,0,.08);
 Object.assign(a.filterMotion,{mode:'both',clock:'sync',beats:4,motionDepth:1.2,resAmount:.5,satAmount:.8,points:TRIBAL_LFO.acid.map(s=>s/10)});
 a.effects=[{...effect('stereo delay'),mix:.18,time:.75,feedback:.38},{...effect('room'),mix:.08}];
 // Part 3: tribal toms / wood (pitch-drop body + noise click)
 const t=state.parts[2];zero(t);t.enabled=true;t.level=.7;t.pan=.2;
 Object.assign(t.osc[0],{mode:'wavetable',bank:5,pos:.1,semi:0,level:.85});Object.assign(t.osc[1],{mode:'analog',analog:'white noise',semi:0,level:0});t.osc[2].level=0;
 Object.assign(t,{cutoff:3200,res:.4,env:1.5,hp:70,svmode:'highpass',drive:1.3});
 t.envs[0]=env(.001,.22,0,.18);t.envs[1]=env(.001,.12,0,.1);t.envs[2]=env(.001,.07,0,.05);
 t.mods[0]={src:'Mod envelope 1',dst:'Pitch 1',amount:1,via:'None'};t.mods[1]={src:'Mod envelope 1',dst:'Level 2',amount:.5,via:'None'};
 t.effects=[{...effect('room'),mix:.18},{...effect('bypass')}];
 // Part 4: Hijaz lead (reed + vocal tables, HP 180 Hz)
 const l=state.parts[3];zero(l);l.enabled=true;l.level=.9;l.pan=.1;
 Object.assign(l.osc[0],{mode:'wavetable',bank:9,pos:.35,semi:0,level:.6});Object.assign(l.osc[1],{mode:'wavetable',bank:2,pos:.5,semi:0,fine:7,level:.3});l.osc[2].level=0;
 Object.assign(l,{cutoff:v===2?1600:2400,res:1.1,env:1.6,hp:180,svmode:'highpass',drive:1.3});
 l.envs[0]=env(.005,.3,.6,v===1?.4:.22);l.envs[1]=env(.004,.4,.2,.3);l.mods[1]={src:'LFO 2',dst:'Pan',amount:.3,via:'None'};
 l.effects=[{...effect('stereo delay'),mix:.28,time:.75,feedback:.42},{...effect('hall'),mix:v===2?.42:.3}];
 // Step builders from the LFO tables
 const off=()=>Array.from({length:16},()=>tribalStep(false,[root],.7));
 const bassTrack=(sparse=false)=>TRIBAL_LFO.bass.map((s,i)=>tribalStep(s>0&&(!sparse||i%2===1),[i===14?root+1:root],i%4===1?.95:.78));
 const acidNotes=[root,0,root+12,root,0,root+4,0,root+7,root,0,root+13,0,root,root+8,0,root+12];
 const acidTrack=()=>TRIBAL_LFO.acid.map((s,i)=>tribalStep(s>0,[acidNotes[i]],.45+.55*s/10,null,clamp(.15+.7*s/10,0,1)));
 const tomFor=s=>s>=10?root:s>=9?root+7:s>=8?root+5:s>=7?root+12:root+15;
 const tribalTrack=(light=false)=>TRIBAL_LFO.tribal.map((s,i)=>tribalStep(s>0&&(!light||s===10),[tomFor(s)],.4+.6*s/10));
 const tablaTrack=()=>TRIBAL_LFO.tabla.map((s,i)=>tribalStep(s>0,[i>=12?root+19:i%8===0?root+7:root+12],.4+.6*s/10));
 const lead=24;
 const hijazTrack=(gated=false)=>TRIBAL_LFO.hijaz.map((n,i)=>tribalStep(!gated||TRIBAL_LFO.gate[i]>0,[root+lead+n],i%4===0?.9:.72));
 const swellTrack=()=>TRIBAL_LFO.swell.map((s,i)=>tribalStep(true,[root+lead+(i%4<2?0:7)],(.2+.8*s/10)*E));
 const gateTrack=()=>TRIBAL_LFO.gate.map(s=>tribalStep(s>0,[root+lead,root+lead+4,root+lead+7],.8));
 let seed=1234567+v;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;seed>>>=0;return seed/4294967296;};
 const glitchTrack=()=>TRIBAL_LFO.glitch.map(s=>{if(s===0)return tribalStep(false,[root],.5);if(s===10)return tribalStep(true,[root+12],1,null,1);const n=root+scale[Math.floor(rnd()*7)]+12*Math.floor(rnd()*2);return tribalStep(rnd()>.25,[n],.45+rnd()*.5,null,rnd());});
 const scene=(name,tracks)=>({name,bars:1,division:4,parts:tracks.map(tr=>tr||off())});
 const scenes=[
  scene(tribalScenes[0],[bassTrack(),acidTrack(),tribalTrack(),hijazTrack(true)]),
  scene(tribalScenes[1],[bassTrack(),null,tribalTrack(true),null]),
  scene(tribalScenes[2],[bassTrack(),acidTrack(),null,null]),
  scene(tribalScenes[3],[bassTrack(),null,tribalTrack(),null]),
  scene(tribalScenes[4],[bassTrack(),null,tablaTrack(),null]),
  scene(tribalScenes[5],[bassTrack(true),null,null,swellTrack()]),
  scene(tribalScenes[6],[bassTrack(),null,tribalTrack(true),hijazTrack()]),
  scene(tribalScenes[7],[bassTrack(),acidTrack(),null,gateTrack()]),
  scene(tribalScenes[8],[bassTrack(),glitchTrack(),tribalTrack(),null])];
 state.patterns=state.patterns.map((p,i)=>i<scenes.length?scenes[i]:{...newPattern(i),parts:[0,1,2,3].map(()=>off())});
 state.song=[1,1,3,3,2,2,0,0,4,6,6,7,7,0,0,5,8,0];state.songMode=false;state.pattern=v===3?6:0;
 return state;}

for(let v=0;v<tribalNames.length;v++)factory.push([tribalNames[v],'Tribal & psy · 8-LFO step scenes',null,5,0,v]);
function makeProgram(index){if(index>=500)return tribalProgram(index-500);let state=baseState(),entry=factory[index],b=entry[3],f=entry[4],v=entry[5],p=state.parts[0];state.program=index;state.patch=entry[0];let tables=[[6,4,8,5,4,2,1,0,4,8,6,9,11,4,10,1,9,6,2,9],[0,7,5,3,1,7,5,10,2,4,3,0,9,3,8,7,1,7,5,0],[2,8,0,7,5,0,7,9,8,0,11,6,1,3,0,7,8,5,10,2],[5,4,1,6,3,5,10,9,4,2,4,6,1,10,4,3,2,1,6,0],[0,8,3,5,2,10,7,3,6,11,5,9,5,8,3,0,4,10,8,0]][b];p.osc[0].bank=tables[f];p.osc[1].bank=(tables[f]+(f%3)+1)%12;p.osc[2].bank=5;p.osc[0].pos=.08+(f%8)*.1+v*.025;p.osc[1].pos=.7-(f%5)*.1;p.osc[1].level=.2+(f%4)*.06;p.osc[1].fine=3+v*2;p.osc[2].level=.12;p.cutoff=1200+(f%7)*650;p.res=.5+(f%5)*.45;p.drive=1.2+v*.2;p.variation=.08+v*.035;p.drift=.06+v*.025;p.spread=.1+v*.12;p.fx.delay=.12+v*.045;p.fx.reverb=.16+v*.04;
if(b===0){p.osc.forEach(o=>o.vintage=.25+v*.12);p.envs[0]=env(.01,.4,.65,.45);p.envs[1]=env(.02,.7,.35,.5);p.env=1.2;p.osc[0].wave.amount=.08;if(f%4===1){p.envs[0]=env(.005,.22,.18,.18);p.cutoff=700;p.env=3;p.osc[0].semi=-12;}if([2,9,13,17,18].includes(f)){p.envs[0]=env(.4,1,.8,2.5);p.cutoff=2200;}if(f===3){p.fm[0][1]=1.7;p.osc[1].semi=19;p.envs[0]=env(.003,1.5,.03,1.5);p.cutoff=7000;}if(f===4){p.osc[1].semi=7;p.envs[0]=env(.004,.28,.1,.35);p.env=3;p.cutoff=900;}if(f===5){p.osc[1].bank=2;p.envs[0]=env(.7,1,.7,3);}if(f===8){p.osc[0].bank=4;p.osc[0].pos=0;p.osc[0].vintage=0;p.osc[1].level=p.osc[2].level=0;p.osc.forEach(o=>o.wave.amount=0);p.mods.forEach(m=>m.amount=0);p.env=0;p.cutoff=16000;}if(f===0){p.envs[0]=env(.45,.6,.6,2.8);p.osc[0].bank=0;p.osc[1].bank=2;}if(f===7){state.parts[1]=clone(p);state.parts[1].enabled=true;state.parts[1].osc[0].semi=7;state.parts[1].pan=.4;state.parts[1].level=.35;}}
if(b===1){p.envs[0]=env(.003,.5+(f%5)*.25,.04,.6+v*.2);p.envs[1]=env(.003,.3,.1,.4);p.env=2;p.cutoff=1800+(f%8)*650;p.osc[2].semi=12;p.osc[2].level=.08;p.osc[1].semi=[0,12,19,7,24][f%5];p.fm[0][1]=[0,.4,1.5,2.4,.7][f%5]+v*.08;p.osc.forEach(o=>{o.wave.loop=false;o.wave.amount=.15;o.wave.times=[.01,.08,.2,.4,.6,1];});p.mods[3]={src:'Mod envelope 1',dst:'FM 2 → 1',amount:.3,via:'Velocity'};p.envs[2]=env(.001,.5,0,.2);}
if(b===2){p.envs[0]=env(.7+(f%5)*.3,2,.8,3+v*.5);p.envs[1]=env(1.5,2,.6,3);p.env=.8;p.cutoff=1300+(f%6)*600;p.osc[2].semi=[-12,7,12,0][f%4];p.osc[2].level=.25;p.fx.reverb=.4+v*.05;p.fx.chorus=.3;p.lfos.forEach((l,i)=>l.rate=.025+(f%5)*.02+i*.013);p.osc.forEach((o,i)=>{o.wave.amount=.25+v*.03;o.wave.times=o.wave.times.map(t=>t*(2+i));});p.mods[3]={src:'LFO 3',dst:'Wave 2',amount:.22,via:'None'};p.mods[4]={src:'LFO 4',dst:'Wave 3',amount:-.15,via:'None'};}
if(b===3){p.osc[0].semi=-12;p.osc[1].semi=f%6===0?0:-12;p.osc[2].semi=-24;p.osc[2].level=.25;p.cutoff=250+(f%6)*220;p.env=2.4;p.res=1.1+(f%5)*.5;p.drive=1.5+v*.55;p.bassComp=.8;p.envs[0]=env(.003,.2,.25,.12+v*.05);p.envs[1]=env(.002,.15+(f%4)*.08,.05,.15);p.fx.reverb=.06;p.fx.delay=.12;p.fx.chorus=.05;p.lfos[0].sync=true;p.lfos[0].division=[.5,1,2,4][f%4];p.lfos[0].shape=['triangle','sawtooth','sine','samplehold'][f%4];p.fm[0][1]=f%4===0?.8:0;p.mods[3]={src:'LFO 2',dst:'Cutoff',amount:.1,via:'Mod wheel'};state.bpm=112+(f%5)*8;}
if(b===4){p.envs[0]=env(.2+(f%4)*.2,1,.65,2);for(let i=1;i<(f%3)+2;i++){let q=clone(p);q.enabled=true;q.osc[0].bank=(tables[f]+i*3)%12;q.osc[0].semi=[0,7,12,-12][i];q.level=.32;q.pan=(i%2?1:-1)*(.3+v*.1);q.envs[0].a+=i*.2;q.lfos[0].rate*=1+i*.37;q.fx.delayBeat=[.5,.75,1,1.5][i];state.parts[i]=q;}p.level=.45;p.fm[0][1]=(f%4)*.3;p.fm[1][2]=(f%3)*.2;if([1,3,8,12].includes(f)){p.high=59;for(let i=1;i<4;i++)state.parts[i].low=60;}p.fx.reverb=.35;}
// Five deliberately different articulations per family.
if(v===1){p.cutoff*=.65;p.drive+=.5;}if(v===2){p.cutoff=Math.min(17000,p.cutoff*1.9);p.env+=.6;p.osc[1].semi+=12;}if(v===3){p.envs[0].a*=2;p.envs[0].r*=1.7;p.cutoff*=.55;p.osc[1].level*=.6;}if(v===4){p.osc[1].fine=17;p.spread=.8;p.fx.chorus=.45;p.fx.reverb+=.12;}for(const q of state.parts){q.effects[0].mix=q.fx.delay;q.effects[0].time=q.fx.delayBeat;q.effects[0].feedback=q.fx.feedback;q.effects[1].mix=q.fx.reverb;if(v===4){q.effects[0]=effect('chorus');q.effects[0].mix=.35;}if(b===3&&v===1){q.effects[0]=effect('distortion');q.effects[0].mix=.22;q.effects[0].drive=2.5;}if(b===4&&f%5===0){q.effects[0]=effect(['phaser','flanger','BBD','rotary'][f%4]);q.effects[0].mix=.25;}}return state;}
window.bankNames=bankNames;window.factory=factory;window.presetBanks=presetBanks;window.sources=sources;window.destinations=destinations;

window.effectTypes=effectTypes;

window.newPattern=newPattern;

window.env=env;
