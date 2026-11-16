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
function newPattern(i=0){return {name:'Pattern '+String(i+1).padStart(2,'0'),bars:1,division:4,parts:[0,1,2,3].map(()=>Array.from({length:16},()=>({notes:[52],on:false,vel:.75,cutoff:null,wave:null})))};}
function baseState(){return {version:2,maxVoices:24,patterns:Array.from({length:24},(_,i)=>newPattern(i)),pattern:0,song:[0],songMode:false,record:false,parts:[0,1,2,3].map(part),selected:0,bpm:108,volume:.55,sequence:[0,7,12,7,3,10,15,10,5,12,17,12,3,10,7,10].map((n,i)=>({note:48+n,on:true,vel:i%4===0?.85:.65})),gate:.65,swing:0,patch:'Glass estuary',program:0};}
const families=[
['Glass estuary','Feral current','Velvet horizon','Prismatic bells','Copper stab','Choir of tides','Night transmission','Fourfold bloom','Initial state','Amber strings','Juno-inspired brass','Reed ensemble','Vintage organ','PWM orchestra','Soft sync lead','Dusty clavinet','Hollow flute','Brass swell','Tape choir','Electric reed'],
['Prism piano','Glass marimba','Crystal tine','Copper mallet','Muted kalimba','Hollow pluck','FM celesta','Digital clav','Vocal keys','Spectral harpsichord','Bell cascade','Water droplets','Reed struck','Metal bars','Wire harp','Chime cluster','Resonant wood','Icy plucks','Soft electric','Bright compass'],
['Tidal choir','Bowed horizon','Violet cloud','Spectral aurora','Low gravity','Moving glass','Shimmer field','Reed nebula','Distant strings','Breathing prism','Frozen organ','Warm current','Hollow mist','Metallic dusk','Deep bloom','Polar light','Evolving ribbon','Falling stars','Slow aperture','Quiet ocean'],
['Sub current','Acid contour','Hollow bass','Rubber pulse','FM growl','Round pluck','Sync engine','Reed bass','Sequenced copper','Talking bass','Dark saw','Moving fifth','Elastic low','Digital bite','Pulse runner','Metal low','Vocal step','Resonant knock','Muted drive','Bass orbit'],
['Fourfold prism','Split horizon','Bell and cloud','Low and high','Cross-mod choir','Glass machine','Stereo braid','FM weather','Split brass','Harmonic engine','Threefold chime','Organ and reed','Sub and shimmer','Moving intervals','Metallic ribbon','Resonant galaxy','Layered copper','Dual aperture','Slow machinery','Wide transmission']];
const variations=[['Pure','Warm','Bright','Soft','Wide'],['Clear','Muted','Glass','Long','Wide'],['Still','Drifting','Open','Dark','Immense'],['Tight','Driven','Open','Short','Wide'],['Close','Orbit','Bright','Slow','Wide']];
const factory=[];for(let b=0;b<5;b++)for(let f=0;f<20;f++)for(let v=0;v<5;v++){let i=b*100+f*5+v;factory.push([families[b][f]+(v?' · '+variations[b][v]:''),`${presetBanks[b].slice(5)} · ${variations[b][v]} variation`,null,b,f,v]);}

// ================= 06 / Tribal & psy · full style bank =================
// Built from the CONTINUUM Tribal Psy 8-LFO reference and the darbuka / tabla / psydub / organic-tribal briefs.
// The original factory banks (01–05, incl. the slow "Glass estuary" pad) are untouched above and remain the foundation.
const TRIBAL_LFO={
 bass:[0,10,10,10,0,10,10,10,0,10,10,10,0,10,10,10],acid:[8,0,4,10,0,6,0,9,3,0,10,0,7,4,0,10],
 tribal:[10,0,0,8,0,0,9,0,10,0,0,7,0,5,0,9],tabla:[6,0,0,0,8,0,4,0,10,0,0,6,9,10,8,10],
 swell:[1,1,2,2,3,4,5,6,6,7,8,8,9,9,10,10],hijaz:[0,12,7,4,1,5,7,12,8,7,4,1,0,4,7,10],
 gate:[10,0,10,10,0,10,0,10,10,0,10,0,10,10,0,10],glitch:['R','R',0,'R','R',0,'R','R',0,'R','R',0,'R','R','R',10]};
const ROOT=40,PHRYG=[0,1,4,5,7,8,10]; // E Phrygian dominant (Hijaz)
const ST=(on,notes,vel,cutoff=null,wave=null)=>({notes,on,vel:clamp(vel,.05,1),cutoff,wave});
const offTrack=n=>Array.from({length:n},()=>ST(false,[ROOT],.7));
const pat=(name,bars,division,tracks)=>{const n=bars*4*division;return {name,bars,division,parts:tracks.map(t=>{const tr=t||offTrack(n);if(tr.length!==n)throw Error(name+': track length '+tr.length+' != '+n);return tr;})};};
// Fill a track from a cycle of tokens. map(token, indexInCycle) -> [notes,vel] or null.
const cycle=(n,tokens,stepsPer,map)=>{const tr=offTrack(n),len=tokens.length*stepsPer;for(let s=0;s<n;s+=stepsPer){const k=(s%len)/stepsPer,hit=map(tokens[k],k,Math.floor(s/len));if(hit)tr[s]=ST(true,hit[0],hit[1],hit[2]??null,hit[3]??null);}return tr;};
const grid=(str,map,repeat=1)=>{const s=str.replace(/\s|\|/g,'').repeat(repeat);return Array.from(s).map((c,i)=>{const h=map(c,i);return h?ST(true,h[0],h[1],h[2]??null,h[3]??null):ST(false,[ROOT],.7);});};

// ---------- Part builders ----------
const resetPart=p=>{p.mods.forEach(m=>m.amount=0);p.fixed.forEach(m=>m.amount=0);p.osc.forEach(o=>{o.wave.amount=0;o.vintage=0;o.fine=0;});p.fm=[[0,0,0],[0,0,0],[0,0,0]];p.variation=.03;p.drift=.02;p.unison=1;p.chord='Off';p.enabled=true;p.filterMotion.mode='envelope';p.svmode='highpass';p.svq=.7;p.bassComp=.6;p.pan=0;};
const fx=(type,o={})=>({...effect(type),...o});
const pitchDrop=(p,amount,decay,oscs=[1])=>{p.envs[2]=env(.0005,decay,0,decay);oscs.forEach((o,i)=>p.mods[i]={src:'Mod envelope 1',dst:'Pitch '+o,amount,via:'None'});};
function bassPart(p,style,v){resetPart(p);
 if(style==='psy'){Object.assign(p.osc[0],{mode:'wavetable',bank:4,pos:.15,semi:-12,level:.75});Object.assign(p.osc[1],{mode:'wavetable',bank:4,pos:.2,semi:-12,fine:9,level:.42});Object.assign(p.osc[2],{mode:'analog',analog:'sine',semi:-12,level:.85});
  Object.assign(p,{level:.95,cutoff:v==='night'?170:210,res:1.45,drive:2.1,env:3.6,hp:20,bassComp:.95,spread:.2});p.envs[0]=env(.002,.42,.82,.045);p.envs[1]=env(.0005,.09,0,.04);pitchDrop(p,.12,.03,[1,2]);p.mods[3]={src:'Velocity',dst:'Cutoff',amount:.25,via:'None'};p.effects=[fx('bypass'),fx('bypass')];}
 else if(style==='dub'){Object.assign(p.osc[2],{mode:'analog',analog:'sine',semi:-12,level:1});Object.assign(p.osc[0],{mode:'wavetable',bank:4,pos:.1,semi:0,level:.32});Object.assign(p.osc[1],{mode:'analog',analog:'triangle',semi:-12,level:.35});
  Object.assign(p,{level:1,cutoff:360,res:.6,drive:1.9,env:1.2,hp:20,bassComp:1,spread:0});p.envs[0]=env(.004,.9,.8,.22);p.envs[1]=env(.003,.35,.3,.3);pitchDrop(p,.25,.045,[1,2,3]);
  Object.assign(p.filterMotion,{mode:'both',clock:'sync',beats:16,motionDepth:.9,resAmount:.1,satAmount:.3,points:Array.from({length:16},(_,i)=>Math.round((.5-.5*Math.cos(i*Math.PI/8))*100)/100)});p.effects=[fx('tape',{mix:.06}),fx('bypass')];}
 else {Object.assign(p.osc[0],{mode:'wavetable',bank:5,pos:.32,semi:0,level:.7});Object.assign(p.osc[1],{mode:'wavetable',bank:1,pos:.4,semi:12,level:.22});Object.assign(p.osc[2],{mode:'analog',analog:'sine',semi:-12,level:.9});p.fm[0][1]=.45;
  Object.assign(p,{level:.95,cutoff:620,res:.5,drive:1.6,env:1.4,hp:20,bassComp:.9,spread:.05});p.envs[0]=env(.001,.38,.28,.16);p.envs[1]=env(.001,.12,0,.1);pitchDrop(p,.5,.03,[1,2]);p.effects=[fx('tape',{mix:.05}),fx('bypass')];}}
function melodicPart(p,style,v){resetPart(p);
 if(style==='psy'){Object.assign(p.osc[0],{mode:'wavetable',bank:4,pos:.12,semi:0,level:.8});p.osc[1].level=0;Object.assign(p.osc[2],{mode:'analog',analog:'square',semi:-12,level:.18});
  Object.assign(p,{level:.8,pan:-.12,cutoff:v==='night'?260:320,res:3.5,drive:3.2,env:4,hp:70});p.envs[0]=env(.002,.22,.55,.05);p.envs[1]=env(.001,.14,0,.07);
  p.mods[0]={src:'Velocity',dst:'Cutoff',amount:.35,via:'None'};p.mods[1]={src:'Velocity',dst:'Resonance',amount:.15,via:'None'};p.mods[2]={src:'Velocity',dst:'Drive',amount:.25,via:'None'};
  Object.assign(p.filterMotion,{mode:'both',clock:'sync',beats:4,motionDepth:1.6,resAmount:.6,satAmount:1.2,points:TRIBAL_LFO.acid.map(s=>s/10)});
  p.effects=[fx('distortion',{mix:.25,drive:2.5}),fx('stereo delay',{mix:.2,time:.75,feedback:.42})];}
 else if(style==='dub'){Object.assign(p.osc[0],{mode:'wavetable',bank:9,pos:.4,level:.55});Object.assign(p.osc[1],{mode:'wavetable',bank:0,pos:.3,fine:6,level:.35});p.osc[2].level=0;
  Object.assign(p,{level:1,pan:.15,cutoff:2600,res:.8,env:1.8,hp:180,drive:1.8});p.envs[0]=env(.002,.22,.15,.35);p.envs[1]=env(.002,.15,0,.2);
  p.effects=[fx('tape',{mix:.45,time:.75,feedback:.55,drive:1.6}),fx('plate',{mix:.35,decay:.75})];}
 else if(style==='tabla'){Object.assign(p.osc[0],{mode:'wavetable',bank:9,pos:.25,level:.5});Object.assign(p.osc[1],{mode:'wavetable',bank:8,pos:.5,semi:7,fine:3,level:.3});Object.assign(p.osc[2],{mode:'wavetable',bank:9,pos:.4,semi:12,fine:-4,level:.2});
  Object.assign(p,{level:.75,pan:-.1,cutoff:2400,res:.6,env:.9,hp:120,drive:1.3,drift:.3});p.envs[0]=env(.03,2.8,.35,3.2);p.envs[1]=env(.02,1.5,.3,2);p.mods[0]={src:'LFO 1',dst:'Wave 1',amount:.2,via:'None'};p.mods[1]={src:'LFO 2',dst:'Pan',amount:.25,via:'None'};
  p.effects=[fx('chorus',{mix:.25}),fx('hall',{mix:.4,decay:.8})];}
 else {Object.assign(p.osc[0],{mode:'wavetable',bank:1,pos:.25,level:.65});Object.assign(p.osc[1],{mode:'analog',analog:'sine',semi:19,level:.18});p.osc[2].level=0;p.fm[0][1]=1.2;
  Object.assign(p,{level:.62,pan:-.15,cutoff:3600,res:.4,env:1.2,hp:160,drive:1.2});p.envs[0]=env(.001,.55,0,.45);p.envs[1]=env(.001,.25,0,.2);
  p.effects=[fx('stereo delay',{mix:.22,time:.75,feedback:.35}),fx('room',{mix:.22})];}}
function lowDrumPart(p,style,v){resetPart(p);
 Object.assign(p.osc[0],{mode:'analog',analog:'sine',semi:0,level:1});Object.assign(p.osc[1],{mode:'analog',analog:'white noise',level:0});Object.assign(p.osc[2],{mode:'wavetable',bank:5,pos:.2,semi:12,level:0});
 p.mods[2]={src:'Mod envelope 1',dst:'Level 2',amount:.45,via:'None'};p.mods[3]={src:'Velocity',dst:'Cutoff',amount:.3,via:'None'};
 if(style==='psy'){pitchDrop(p,3,.045,[1]);Object.assign(p,{level:.95,cutoff:9000,res:.2,drive:2.6,env:0,hp:20,bassComp:1});p.envs[0]=env(.001,.32,0,.08);p.effects=[fx('bypass'),fx('bypass')];}
 else if(style==='dub'){pitchDrop(p,2.4,.06,[1]);Object.assign(p,{level:.95,cutoff:5000,res:.2,drive:1.8,env:0,hp:20,bassComp:1});p.envs[0]=env(.001,.45,0,.15);p.effects=[fx('bypass'),fx('bypass')];}
 else {pitchDrop(p,1.1,.06,[1,3]);p.osc[2].level=.35;Object.assign(p,{level:.95,cutoff:2600,res:.5,drive:1.5,env:.8,hp:25,bassComp:1});p.envs[0]=env(.001,style==='tabla'?.6:.5,0,.35);p.envs[1]=env(.001,.15,0,.1);p.effects=[fx('room',{mix:.14}),fx('bypass')];}}
function highPercPart(p,style,v){resetPart(p);
 Object.assign(p.osc[0],{mode:'analog',analog:'white noise',level:.55});Object.assign(p.osc[1],{mode:'wavetable',bank:3,pos:.5,semi:0,level:.35});p.osc[2].level=0;
 p.mods[0]={src:'Velocity',dst:'Envelope 1 decay',amount:.35,via:'None'};
 if(style==='psy'){p.osc[0].level=.9;Object.assign(p,{level:1,pan:.12,cutoff:15000,res:.3,env:0,hp:5200,svq:.9,drive:1.5});p.osc[1].level=.2;p.envs[0]=env(.001,.07,0,.06);p.effects=[fx('room',{mix:.1}),fx('bypass')];}
 else if(style==='dub'){p.osc[0].level=.85;Object.assign(p,{level:1,pan:.1,cutoff:9000,res:.4,env:0,hp:700,drive:1.6});p.envs[0]=env(.001,.13,0,.12);p.effects=[fx('tape',{mix:.32,time:.75,feedback:.5}),fx('plate',{mix:.38,decay:.7})];}
 else if(style==='tabla'){p.osc[0].level=.22;Object.assign(p.osc[1],{bank:3,pos:.25,level:.8});Object.assign(p.osc[2],{mode:'analog',analog:'sine',semi:0,level:.5});Object.assign(p,{level:.85,pan:.15,cutoff:7000,res:.9,env:.6,hp:350,drive:1.2});p.envs[0]=env(.001,.32,0,.3);p.envs[1]=env(.001,.08,0,.1);p.effects=[fx('room',{mix:.2}),fx('bypass')];}
 else {p.osc[0].level=.9;p.osc[1].level=.45;Object.assign(p,{level:1,pan:.18,cutoff:12000,res:.5,env:.4,hp:1100,drive:1.6});p.envs[0]=env(.001,.09,0,.08);p.effects=[fx('room',{mix:.18}),fx('bypass')];}}

// ---------- Rhythm libraries ----------
// Darbuka: D = dum (low drum), T = tek (high, accented), k = ka ghost. 8 slots per bar written as 8ths unless noted.
const DARBUKA={
 'Maqsoum':{bars:1,slots:'DT-TD-T-',ghost:'----k--k-k----kk'},
 'Baladi':{bars:1,slots:'DD-TD-T-',ghost:'-----k---k----kk'},
 'Saidi':{bars:1,slots:'DT-DD-T-',ghost:'---k-----k---k-k'},
 'Malfuf':{bars:1,sixteenths:'D--T--T-D--T--T-',ghost:'-k--k-----k-k---'},
 'Ayub':{bars:1,sixteenths:'D--TD-T-D--TD-T-',ghost:'-k---k---k---k-k'},
 'Chiftetelli':{bars:2,eighths:'D-T-T-D-D-T-----',ghost:'---k---k-----k-k-----k---k---kkk'}};
const darbukaTracks=(name)=>{const r0=DARBUKA[name],r={...r0,bars:Math.max(2,r0.bars)},n=r.bars*16;let s16;
 if(r.slots)s16=Array.from(r.slots).map(c=>c+'-').join('');else if(r.sixteenths)s16=r.sixteenths;else s16=Array.from(r.eighths).map(c=>c+'-').join('');s16=s16.repeat(n/s16.length);
 const g=r.ghost.repeat(Math.ceil(n/r.ghost.length)).slice(0,n);
 const dum=grid(s16,(c,i)=>c==='D'?[[i%16===0?ROOT-7:ROOT-5],i%16===0?1:.85]:null);
 const tek=grid(s16,(c,i)=>c==='T'?[[ROOT+48],.9]:g[i]==='k'?[[ROOT+43],.28]:null);
 // deep syncopated sub that sits in the pockets between dums (B - b - - b B -)
 const bass=grid('B-b--bB-'.repeat(n/8),(c,i)=>s16[i]==='D'&&c!=='B'?null:c==='B'?[[ROOT],.95]:c==='b'?[[ROOT],.62]:null);
 // balafon call & response: bar 1 rests, bar 2 answers in Hijaz
 const ans=[0,-1,-1,7,-1,5,4,-1,1,-1,0,-1,-1,-1,-1,-1];
 const mel=Array.from({length:n},(_,i)=>{const bar=Math.floor(i/16)%2,k=ans[i%16];return bar===1&&k>=0?ST(true,[ROOT+24+k],i%4===0?.9:.7):ST(false,[ROOT],.7);});
 return {bars:r.bars,tracks:[bass,mel,dum,tek]};};
// Tabla taals: each bol is an 8th note. Bass stroke -> low drum (part 3); treble stroke -> high part (part 4, pitched).
const TAALS={'Teental':'Dha Dhin Dhin Dha | Dha Dhin Dhin Dha | Dha Tin Tin Ta | Ta Dhin Dhin Dha','Keherwa':'Dha Ge Na Ti | Na Ka Dhi Na','Dadra':'Dha Dhi Na | Dha Tu Na','Rupak':'Tin Tin Na | Dhi Na | Dhi Na','Jhaptal':'Dhi Na | Dhi Dhi Na | Ti Na | Dhi Dhi Na'};
const TAAL_BARS={'Teental':2,'Keherwa':1,'Dadra':3,'Rupak':7,'Jhaptal':5};
const BOL={Dha:[1,'Na'],Dhin:[1,'Tin'],Dhi:[1,'Na'],Ge:[1,null],Na:[0,'Na'],Ta:[0,'Na'],Tin:[0,'Tin'],Ti:[0,'Ti'],Tu:[0,'Tu'],Ka:[0,'Ka']};
const TREBLE={Na:[ROOT+36,.85],Tin:[ROOT+33,.7],Ti:[ROOT+40,.4],Tu:[ROOT+31,.75],Ka:[ROOT+45,.3]};
const taalTracks=(name)=>{const bols=TAALS[name].split(/[\s|]+/).filter(Boolean),bars=TAAL_BARS[name],n=bars*16;
 const lowD=cycle(n,bols,2,(b,k)=>BOL[b][0]?[[ROOT-5],k===0?1:.78]:null);
 const high=cycle(n,bols,2,(b,k)=>{const t=BOL[b][1];return t?[[TREBLE[t][0]],k===0?1:TREBLE[t][1]]:null;});
 const bass=Array.from({length:n},(_,i)=>i%16===0?ST(true,[ROOT],1):i%16===10?ST(true,[ROOT],.6):ST(false,[ROOT],.7));
 const drone=Array.from({length:n},(_,i)=>i%32===0?ST(true,[ROOT+12,ROOT+19],.7):ST(false,[ROOT],.7));
 return {bars,tracks:[bass,drone,lowD,high]};};
// Full psy: K - b - b - b gallop with offbeat hats; acid from the 8-LFO tables.
const psyPatterns=(v)=>{const n=16;const kick=grid('K---K---K---K---',c=>c==='K'?[[ROOT-12],1]:null);
 const gallop=(alt=false)=>grid('-bbb-bbb-bbb-bbb',(c,i)=>c==='b'?[[alt&&i===14?ROOT+12:i===15&&alt?ROOT+1:ROOT],i%4===1?.95:.76]:null);
 const hats=grid('--O-.-O-.-O-.-O.',c=>c==='O'?[[ROOT+50],.9]:c==='.'?[[ROOT+55],.3]:null);
 const acidNotes=[ROOT,0,ROOT+12,ROOT,0,ROOT+4,0,ROOT+7,ROOT,0,ROOT+13,0,ROOT,ROOT+8,0,ROOT+12];
 const acid=(shift=0)=>TRIBAL_LFO.acid.map((s,i)=>{const j=(i+shift)%16,t=TRIBAL_LFO.acid[j];return ST(t>0,[acidNotes[j]||ROOT],.4+.6*t/10,null,clamp(.12+.75*t/10,0,1));});
 const roll=grid('bbbbbbbbbbbbbbbb',(c,i)=>[[ROOT],i%4===0?.55:.8]);
 return [pat('Psy · Rolling gallop',1,4,[gallop(),null,kick,hats]),pat('Psy · Gallop + acid',1,4,[gallop(),acid(),kick,hats]),pat('Psy · Acid peak',1,4,[gallop(true),acid(3),kick,hats]),
  pat('Psy · Breakdown (no kick)',1,4,[gallop(),acid(8),null,grid('--O---O---O---O-',c=>c==='O'?[[ROOT+50],.7]:null)]),pat('Psy · Full-on roll',1,4,[roll,acid(),kick,hats]),pat('Psy · Kick + bass only',1,4,[gallop(),null,kick,null])];};
// Psydub: half-time one drop, dub stepping, call & response over 2 bars.
const dubPatterns=()=>{const n=32;const two=s=>s.replace(/\s/g,'');
 const oneDropKick=grid(two('-------- K------- -------- K-------'),c=>c==='K'?[[ROOT-12],1]:null);
 const snare=grid(two('-------- S------- -------- S------h'),(c,i)=>c==='S'?[[ROOT+12],1]:c==='h'?[[ROOT+50],.25]:null);
 const hats=grid(two('--h-h-h- S-h-h-hh --h-h-h- S-h-h-h-'),(c)=>c==='S'?[[ROOT+12],1]:c==='h'?[[ROOT+50],.28]:null);
 const step=grid(two('B--b-B-b ----B--- B--b-B-b --------'),(c,i)=>c==='B'?[[ROOT],1]:c==='b'?[[ROOT],.7]:null);
 const call=grid(two('B------b ---B---- -----B-- b-B--b--'),(c,i)=>i<16?(c==='B'?[[ROOT],1]:c==='b'?[[ROOT],.7]:null):(c==='B'?[[ROOT+12],.9]:c==='b'?[[ROOT+7],.75]:null));
 const skank=grid(two('----S-------S--- ----S-------S---'),c=>c==='S'?[[ROOT+24,ROOT+27,ROOT+31],.75]:null);
 const answer=grid(two('---------------- ------s---s--s--'),c=>c==='s'?[[ROOT+31],.7]:null);
 return [pat('Dub · One drop',2,4,[step,skank,oneDropKick,snare]),pat('Dub · Stepping + swung hats',2,4,[step,skank,oneDropKick,hats]),pat('Dub · Call & response',2,4,[call,answer,oneDropKick,hats]),pat('Dub · Stripped (no kick)',2,4,[call,skank,null,snare])];};
// Organic tribal: heartbeat 12/8 (eighth-triplet grid), 3-over-4 interlock, tuned toms as bass, stripped drop.
const organicPatterns=()=>{const hbN=12;
 const heart=grid('L-d---L-d---',c=>c==='L'?[[ROOT-7],1]:c==='d'?[[ROOT-5],.6]:null);
 const shaker12=grid('x.x.x.x.x.x.',(c,i)=>[[ROOT+50],c==='x'?(i%3===0?.95:.7):.42]);
 const pluck12=grid('----b-----b-',c=>c==='b'?[[ROOT],.85]:null);
 const kal12=grid('------k--k-k',(c,i)=>c==='k'?[[ROOT+24+[0,7,4][i%3]],.65]:null);
 const kick=grid('K---k---K---k---',c=>c==='K'?[[ROOT-7],1]:c==='k'?[[ROOT-7],.6]:null);
 const shaker34=grid('x--x--x--x--x--x',(c,i)=>c==='x'?[[ROOT+50],i%12===0?.7:.45]:[[ROOT+55],.15]);
 const sub=grid('B-b--bB-B-b--bB-',c=>c==='B'?[[ROOT],.95]:c==='b'?[[ROOT],.6]:null);
 const tomBass=grid('T--t-T--t-T-t--t',(c,i)=>c==='T'?[[ROOT-5+[0,3,5,7][Math.floor(i/4)]],.95]:c==='t'?[[ROOT+2],.5]:null);
 const subUnder=grid('B-------B-------',c=>c==='B'?[[ROOT],.9]:null);
 const marimba=grid('--------m--m-m--',(c,i)=>c==='m'?[[ROOT+24+[7,5,4][i%3]],.7]:null);
 return [pat('Organic · Heartbeat 12/8',1,3,[pluck12,kal12,heart,shaker12]),pat('Organic · 3-over-4 interlock',1,4,[sub,marimba,kick,shaker34]),pat('Organic · Tuned toms as bass',1,4,[subUnder,null,tomBass,shaker34]),pat('Organic · Stripped drop',1,4,[sub,marimba,null,shaker34])];};
// 8-LFO scenes (the original reference set)
const lfoPatterns=(v)=>{const off=()=>offTrack(16);
 const bassTrack=(sparse=false)=>TRIBAL_LFO.bass.map((s,i)=>ST(s>0&&(!sparse||i%2===1),[i===14?ROOT+1:ROOT],i%4===1?.95:.78));
 const acidNotes=[ROOT,0,ROOT+12,ROOT,0,ROOT+4,0,ROOT+7,ROOT,0,ROOT+13,0,ROOT,ROOT+8,0,ROOT+12];
 const acidTrack=()=>TRIBAL_LFO.acid.map((s,i)=>ST(s>0,[acidNotes[i]],.45+.55*s/10,null,clamp(.15+.7*s/10,0,1)));
 const tomFor=s=>s>=10?ROOT-5:s>=9?ROOT+2:s>=8?ROOT:s>=7?ROOT+7:ROOT+10;
 const tribalTrack=(light=false)=>TRIBAL_LFO.tribal.map(s=>ST(s>0&&(!light||s===10),[tomFor(s)],.4+.6*s/10));
 const tablaTrack=()=>TRIBAL_LFO.tabla.map((s,i)=>ST(s>0,[i>=12?ROOT+14:i%8===0?ROOT+2:ROOT+7],.4+.6*s/10));
 const hijaz=(g=false)=>TRIBAL_LFO.hijaz.map((n,i)=>ST(!g||TRIBAL_LFO.gate[i]>0,[ROOT+24+n],i%4===0?.9:.72));
 const swell=()=>TRIBAL_LFO.swell.map((s,i)=>ST(true,[ROOT+24+(i%4<2?0:7)],.2+.8*s/10));
 const gate=()=>TRIBAL_LFO.gate.map(s=>ST(s>0,[ROOT+24,ROOT+28,ROOT+31],.8));
 let seed=1234567+v;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;seed>>>=0;return seed/4294967296;};
 const glitch=()=>TRIBAL_LFO.glitch.map(s=>{if(s===0)return ST(false,[ROOT],.5);if(s===10)return ST(true,[ROOT+12],1,null,1);return ST(rnd()>.25,[ROOT+PHRYG[Math.floor(rnd()*7)]+12*Math.floor(rnd()*2)],.45+rnd()*.5,null,rnd());});
 return [pat('8-LFO · Full groove',1,4,[bassTrack(),acidTrack(),tribalTrack(),hijaz(true)]),pat('LFO 1 · Psy bass gallop',1,4,[bassTrack(),null,tribalTrack(true),null]),pat('LFO 2 · 303 acid squelch',1,4,[bassTrack(),acidTrack(),null,null]),
  pat('LFO 3 · Afro-tribal euclidean',1,4,[bassTrack(),null,tribalTrack(),null]),pat('LFO 4 · Tabla ratchet',1,4,[bassTrack(),null,tablaTrack(),null]),pat('LFO 5 · Shamanic breath swell',1,4,[bassTrack(true),null,null,swell()]),
  pat('LFO 6 · Hijaz arpeggio',1,4,[bassTrack(),null,tribalTrack(true),hijaz()]),pat('LFO 7 · Trance gate chop',1,4,[bassTrack(),acidTrack(),null,gate()]),pat('LFO 8 · Quantum glitch',1,4,[bassTrack(),glitch(),tribalTrack(),null])];};

// ---------- Programs ----------
const STYLE_PROGRAMS=[
 // name, family, style for parts [bass,mel,low,high], bpm, swing, gate, start pattern, variant
 ['Full psy · Rolling gallop','psy',['psy','psy','psy','psy'],145,0,.42,0,''],
 ['Full psy · Acid squelch','psy',['psy','psy','psy','psy'],145,0,.42,2,''],
 ['Full psy · Night (dark)','psy',['psy','psy','psy','psy'],148,0,.4,1,'night'],
 ['Full psy · Breakdown','psy',['psy','psy','psy','psy'],145,0,.45,3,''],
 ['Psydub · One drop','dub',['dub','dub','dub','dub'],90,.18,.6,0,''],
 ['Psydub · Stepping','dub',['dub','dub','dub','dub'],84,.2,.55,1,''],
 ['Psydub · Call & response','dub',['dub','dub','dub','dub'],100,.16,.6,2,''],
 ['Darbuka · Maqsoum','darbuka',['tribal','tribal','tribal','tribal'],112,.06,.5,0,''],
 ['Darbuka · Baladi earth','darbuka',['tribal','tribal','tribal','tribal'],104,.06,.5,1,''],
 ['Darbuka · Saidi drive','darbuka',['tribal','tribal','tribal','tribal'],120,.05,.48,2,''],
 ['Darbuka · Malfuf entrance','darbuka',['tribal','tribal','tribal','tribal'],126,.03,.45,3,''],
 ['Darbuka · Ayub trance','darbuka',['tribal','tribal','tribal','tribal'],122,.04,.45,4,''],
 ['Darbuka · Chiftetelli slow','darbuka',['tribal','tribal','tribal','tribal'],84,.08,.55,5,''],
 ['Tabla · Teental 16','tabla',['tribal','tabla','tabla','tabla'],96,0,.5,0,''],
 ['Tabla · Keherwa 8','tabla',['tribal','tabla','tabla','tabla'],110,.04,.5,1,''],
 ['Tabla · Dadra 6','tabla',['tribal','tabla','tabla','tabla'],92,.04,.5,2,''],
 ['Tabla · Rupak 7','tabla',['tribal','tabla','tabla','tabla'],100,0,.5,3,''],
 ['Tabla · Jhaptal 10','tabla',['tribal','tabla','tabla','tabla'],96,0,.5,4,''],
 ['Organic · Heartbeat 12/8','organic',['tribal','tribal','tribal','tribal'],100,0,.5,0,''],
 ['Organic · 3-over-4 interlock','organic',['tribal','tribal','tribal','tribal'],122,.08,.5,1,''],
 ['Organic · Tuned toms as bass','organic',['tribal','tribal','tribal','tribal'],116,.06,.5,2,''],
 ['Organic · Stripped drop','organic',['tribal','tribal','tribal','tribal'],120,.08,.5,3,''],
 ['Tribal Psy · 8 LFO scenes','lfo',['psy','psy','tribal','lead'],138,0,.45,0,''],
 ['Tribal Psy · Hijaz lead','lfo',['psy','psy','tribal','lead'],138,0,.45,6,''],
 ['Tribal Psy · Melodic techno','lfo',['psy','psy','tribal','lead'],124,.06,.55,0,''],
 ['Tribal Psy · Dark ritual','lfo',['psy','psy','tribal','lead'],132,0,.45,0,'night']];
const tribalNames=STYLE_PROGRAMS.map(p=>p[0]);
function leadPart(l,v){resetPart(l);Object.assign(l.osc[0],{mode:'wavetable',bank:9,pos:.35,level:.6});Object.assign(l.osc[1],{mode:'wavetable',bank:2,pos:.5,fine:7,level:.3});l.osc[2].level=0;
 Object.assign(l,{level:.9,pan:.1,cutoff:v==='night'?1600:2400,res:1.1,env:1.6,hp:180,drive:1.3});l.envs[0]=env(.005,.3,.6,.22);l.envs[1]=env(.004,.4,.2,.3);l.mods[1]={src:'LFO 2',dst:'Pan',amount:.3,via:'None'};
 l.effects=[fx('stereo delay',{mix:.28,time:.75,feedback:.42}),fx('hall',{mix:v==='night'?.42:.3})];}
function familyPatterns(family,v){
 if(family==='psy')return psyPatterns(v);if(family==='dub')return dubPatterns();if(family==='organic')return organicPatterns();if(family==='lfo')return lfoPatterns(v);
 if(family==='darbuka')return Object.keys(DARBUKA).map(k=>{const r=darbukaTracks(k);return pat('Darbuka · '+k+(k==='Malfuf'||k==='Ayub'?' (2/4)':k==='Chiftetelli'?' (8/4)':' (4/4)'),r.bars,4,r.tracks);});
 if(family==='tabla')return Object.keys(TAALS).map(k=>{const r=taalTracks(k);return pat('Tabla · '+k+' ('+TAALS[k].split(/[\s|]+/).filter(Boolean).length+' matras)',r.bars,4,r.tracks);});}
const FAMILY_SONG={psy:[0,0,1,1,2,2,3,4,4,2,2,5],dub:[0,0,1,1,2,2,3,2],darbuka:[0,0,1,1,2,2,3,4,4,0],tabla:[0,1,1,2,0],organic:[1,1,2,2,3,1,1],lfo:[1,1,3,3,2,2,0,0,4,6,6,7,7,0,0,5,8,0]};
function tribalProgram(index){const [name,family,styles,bpm,swing,gate,start,v]=STYLE_PROGRAMS[index];const state=baseState();
 state.program=500+index;state.patch=name;state.bpm=bpm;state.swing=swing;state.gate=gate;
 bassPart(state.parts[0],styles[0],v);melodicPart(state.parts[1],styles[1],v);lowDrumPart(state.parts[2],styles[2],v);
 if(styles[3]==='lead')leadPart(state.parts[3],v);else highPercPart(state.parts[3],styles[3],v);
 if(family==='lfo'){const t=state.parts[2];t.pan=.2;}
 const pats=familyPatterns(family,v);
 state.patterns=state.patterns.map((p,i)=>i<pats.length?pats[i]:{...newPattern(i),parts:[0,1,2,3].map(()=>offTrack(16))});
 state.song=FAMILY_SONG[family].filter(i=>i<pats.length);state.songMode=false;state.pattern=Math.min(start,pats.length-1);
 return state;}

for(let v=0;v<tribalNames.length;v++)factory.push([tribalNames[v],'Tribal & psy · '+STYLE_PROGRAMS[v][1],null,5,0,v]);

// ---------- Factory banks 01–05: new default sequences (sounds and presets unchanged) ----------
// The original default sequence is kept below for reference only (not used): C-minor arpeggio, every step on, same on all parts.
function legacyPattern(i=0){return {name:'Pattern '+String(i+1).padStart(2,'0'),bars:1,division:4,parts:[0,1,2,3].map(()=>Array.from({length:16},(_,j)=>({notes:[48+[0,7,12,7,3,10,15,10,5,12,17,12,3,10,7,10][j]],on:i===0,vel:j%4===0?.85:.65,cutoff:null,wave:null})))};}
const SEQ={
 hijazArp:r=>TRIBAL_LFO.hijaz.map((n,i)=>ST(true,[r+n],i%4===0?.9:.7)),
 hijazGate:r=>TRIBAL_LFO.hijaz.map((n,i)=>ST(TRIBAL_LFO.gate[i]>0,[r+n],i%4===0?.9:.72)),
 skank:r=>grid('----A-------A--- ----B-------B-B-',(c)=>c==='A'?[[r,r+4,r+7],.8]:c==='B'?[[r+1,r+5,r+8],.78]:null),
 swell:r=>TRIBAL_LFO.swell.map((s,i)=>ST(true,[r+(i%4<2?0:7)],.2+.8*s/10)),
 balafon:r=>{const call=[0,-1,7,-1,-1,5,-1,4,-1,-1,1,-1,0,-1,-1,-1],ans=[12,-1,-1,10,-1,8,7,-1,5,-1,4,-1,1,-1,0,-1];return Array.from({length:32},(_,i)=>{const k=(i<16?call:ans)[i%16];return k>=0?ST(true,[r+k],i%4===0?.92:.68):ST(false,[r],.7);});},
 keherwa:r=>cycle(16,'Dha Ge Na Ti Na Ka Dhi Na'.split(' '),2,(b,k)=>{const t={Dha:[0,.95],Ge:[-5,.6],Na:[12,.8],Ti:[19,.4],Ka:[17,.3],Dhi:[7,.85]}[b];return [[r+t[0]],t[1]];}),
 euclid34:r=>grid('x--x--x--x--x--x',(c,i)=>c==='x'?[[r+[0,7,12,4,7,1][Math.floor(i/3)]],i===0?.95:.7]:null),
 slowChords:r=>grid('A---A---B---A---'.slice(0,8),(c)=>c==='A'?[[r,r+4,r+7],.75]:c==='B'?[[r+1,r+5,r+8],.75]:null),
 drone:r=>grid('D-------d-------',c=>c==='D'?[[r,r+7],.8]:c==='d'?[[r+12],.55]:null),
 psyGallop:r=>grid('-bbb-bbb-bbb-bbb',(c,i)=>c==='b'?[[i===14?r+1:r],i%4===1?.95:.76]:null),
 tribalSub:r=>grid('B-b--bB-B-b--bB-',c=>c==='B'?[[r],.95]:c==='b'?[[r],.62]:null),
 dubStep:r=>grid('B--b-B-b ----B--- B--b-B-b --b-B---',(c,i)=>c==='B'?[[i>=16&&i>24?r+7:r],1]:c==='b'?[[r],.7]:null),
 acid:r=>{const notes=[0,null,12,0,null,4,null,7,0,null,13,null,0,8,null,12];return TRIBAL_LFO.acid.map((s,i)=>ST(s>0,[r+(notes[i]??0)],.4+.6*s/10,null,clamp(.12+.75*s/10,0,1)));}};
const SEQ_NAMES={hijazArp:'Hijaz arpeggio',hijazGate:'Hijaz gate',skank:'Dub skank (2 bars)',swell:'Breath swell',balafon:'Balafon call & response (2 bars)',keherwa:'Keherwa pluck',euclid34:'3-over-4 euclidean',slowChords:'Slow Hijaz chords',drone:'Drone pulse',psyGallop:'Psy gallop',tribalSub:'Tribal rolling sub',dubStep:'Dub stepping (2 bars)',acid:'Acid squelch line'};
const BANK_SEQ=[
 {root:52,gate:.55,bpm:112,keys:['hijazGate','skank','hijazArp','swell']},
 {root:64,gate:.45,bpm:110,keys:['balafon','hijazArp','keherwa','euclid34']},
 {root:52,gate:.95,bpm:80,keys:['slowChords','swell','drone'],division:{slowChords:1,drone:2}},
 {root:40,gate:.45,bpm:null,keys:['psyGallop','tribalSub','dubStep','acid']},
 {root:64,gate:.6,bpm:112,keys:['hijazArp','hijazGate','swell','euclid34'],low:['tribalSub','psyGallop','tribalSub','dubStep']}];
const SLOW_SEQ={root:52,gate:.95,bpm:84,keys:['slowChords','drone','hijazSlow'],division:{slowChords:1,drone:2,hijazSlow:1}};SEQ.hijazSlow=r=>TRIBAL_LFO.hijaz.slice(0,8).map((n,i)=>ST(true,[r+n],i%4===0?.85:.7));SEQ_NAMES.hijazSlow='Hijaz line (quarters)';function factorySequences(state,b,f){let cfg=BANK_SEQ[b];if(b!==3&&b!==4&&state.parts[0].envs[0].a>.15)cfg=SLOW_SEQ;
 const seqTrack=(key,root)=>{const div=cfg.division?.[key]||4,t=SEQ[key](root),bars=Math.max(1,Math.round(t.length/(4*div)));return {t,div,bars};};
 const pats=cfg.keys.map((key,k)=>{let lead=seqTrack(key,cfg.root),bars=lead.bars,div=lead.div;
  const tracks=state.parts.map((p,pi)=>{if(!p.enabled)return null;
   if(b===4){const isLow=p.high<60||(pi===0&&p.osc[0].semi<0);const k2=isLow?cfg.low[k]:cfg.keys[(k+pi)%cfg.keys.length];const tr=seqTrack(k2,isLow?40:cfg.root+(pi%2?7:0));return tr;}
   return pi===0?lead:seqTrack(cfg.keys[(k+pi)%cfg.keys.length],cfg.root+12);});
  bars=Math.max(...tracks.filter(Boolean).map(t=>t.bars*4*t.div/(4*div)));
  const n=bars*4*div;const parts=tracks.map(tr=>{if(!tr)return offTrack(n);const scale=div/tr.div;const out=offTrack(n);for(let i=0;i<n;i++){const src=i/scale;if(Number.isInteger(src)){const s=tr.t[src%tr.t.length];out[i]=ST(s.on,s.notes,s.vel,s.cutoff,s.wave);}}return out;});
  return {name:SEQ_NAMES[key],bars,division:div,parts};});
 state.patterns=state.patterns.map((p,i)=>i<pats.length?pats[i]:{...newPattern(i),parts:[0,1,2,3].map(()=>offTrack(16))});
 state.pattern=f%pats.length;state.song=pats.map((_,i)=>i);state.songMode=false;state.gate=cfg.gate;if(cfg.bpm)state.bpm=cfg.bpm;}

function makeProgram(index){if(index>=500)return tribalProgram(index-500);let state=baseState(),entry=factory[index],b=entry[3],f=entry[4],v=entry[5],p=state.parts[0];state.program=index;state.patch=entry[0];let tables=[[6,4,8,5,4,2,1,0,4,8,6,9,11,4,10,1,9,6,2,9],[0,7,5,3,1,7,5,10,2,4,3,0,9,3,8,7,1,7,5,0],[2,8,0,7,5,0,7,9,8,0,11,6,1,3,0,7,8,5,10,2],[5,4,1,6,3,5,10,9,4,2,4,6,1,10,4,3,2,1,6,0],[0,8,3,5,2,10,7,3,6,11,5,9,5,8,3,0,4,10,8,0]][b];p.osc[0].bank=tables[f];p.osc[1].bank=(tables[f]+(f%3)+1)%12;p.osc[2].bank=5;p.osc[0].pos=.08+(f%8)*.1+v*.025;p.osc[1].pos=.7-(f%5)*.1;p.osc[1].level=.2+(f%4)*.06;p.osc[1].fine=3+v*2;p.osc[2].level=.12;p.cutoff=1200+(f%7)*650;p.res=.5+(f%5)*.45;p.drive=1.2+v*.2;p.variation=.08+v*.035;p.drift=.06+v*.025;p.spread=.1+v*.12;p.fx.delay=.12+v*.045;p.fx.reverb=.16+v*.04;
if(b===0){p.osc.forEach(o=>o.vintage=.25+v*.12);p.envs[0]=env(.01,.4,.65,.45);p.envs[1]=env(.02,.7,.35,.5);p.env=1.2;p.osc[0].wave.amount=.08;if(f%4===1){p.envs[0]=env(.005,.22,.18,.18);p.cutoff=700;p.env=3;p.osc[0].semi=-12;}if([2,9,13,17,18].includes(f)){p.envs[0]=env(.4,1,.8,2.5);p.cutoff=2200;}if(f===3){p.fm[0][1]=1.7;p.osc[1].semi=19;p.envs[0]=env(.003,1.5,.03,1.5);p.cutoff=7000;}if(f===4){p.osc[1].semi=7;p.envs[0]=env(.004,.28,.1,.35);p.env=3;p.cutoff=900;}if(f===5){p.osc[1].bank=2;p.envs[0]=env(.7,1,.7,3);}if(f===8){p.osc[0].bank=4;p.osc[0].pos=0;p.osc[0].vintage=0;p.osc[1].level=p.osc[2].level=0;p.osc.forEach(o=>o.wave.amount=0);p.mods.forEach(m=>m.amount=0);p.env=0;p.cutoff=16000;}if(f===0){p.envs[0]=env(.45,.6,.6,2.8);p.osc[0].bank=0;p.osc[1].bank=2;}if(f===7){state.parts[1]=clone(p);state.parts[1].enabled=true;state.parts[1].osc[0].semi=7;state.parts[1].pan=.4;state.parts[1].level=.35;}}
if(b===1){p.envs[0]=env(.003,.5+(f%5)*.25,.04,.6+v*.2);p.envs[1]=env(.003,.3,.1,.4);p.env=2;p.cutoff=1800+(f%8)*650;p.osc[2].semi=12;p.osc[2].level=.08;p.osc[1].semi=[0,12,19,7,24][f%5];p.fm[0][1]=[0,.4,1.5,2.4,.7][f%5]+v*.08;p.osc.forEach(o=>{o.wave.loop=false;o.wave.amount=.15;o.wave.times=[.01,.08,.2,.4,.6,1];});p.mods[3]={src:'Mod envelope 1',dst:'FM 2 → 1',amount:.3,via:'Velocity'};p.envs[2]=env(.001,.5,0,.2);}
if(b===2){p.envs[0]=env(.7+(f%5)*.3,2,.8,3+v*.5);p.envs[1]=env(1.5,2,.6,3);p.env=.8;p.cutoff=1300+(f%6)*600;p.osc[2].semi=[-12,7,12,0][f%4];p.osc[2].level=.25;p.fx.reverb=.4+v*.05;p.fx.chorus=.3;p.lfos.forEach((l,i)=>l.rate=.025+(f%5)*.02+i*.013);p.osc.forEach((o,i)=>{o.wave.amount=.25+v*.03;o.wave.times=o.wave.times.map(t=>t*(2+i));});p.mods[3]={src:'LFO 3',dst:'Wave 2',amount:.22,via:'None'};p.mods[4]={src:'LFO 4',dst:'Wave 3',amount:-.15,via:'None'};}
if(b===3){p.osc[0].semi=-12;p.osc[1].semi=f%6===0?0:-12;p.osc[2].semi=-24;p.osc[2].level=.25;p.cutoff=250+(f%6)*220;p.env=2.4;p.res=1.1+(f%5)*.5;p.drive=1.5+v*.55;p.bassComp=.8;p.envs[0]=env(.003,.2,.25,.12+v*.05);p.envs[1]=env(.002,.15+(f%4)*.08,.05,.15);p.fx.reverb=.06;p.fx.delay=.12;p.fx.chorus=.05;p.lfos[0].sync=true;p.lfos[0].division=[.5,1,2,4][f%4];p.lfos[0].shape=['triangle','sawtooth','sine','samplehold'][f%4];p.fm[0][1]=f%4===0?.8:0;p.mods[3]={src:'LFO 2',dst:'Cutoff',amount:.1,via:'Mod wheel'};state.bpm=112+(f%5)*8;}
if(b===4){p.envs[0]=env(.2+(f%4)*.2,1,.65,2);for(let i=1;i<(f%3)+2;i++){let q=clone(p);q.enabled=true;q.osc[0].bank=(tables[f]+i*3)%12;q.osc[0].semi=[0,7,12,-12][i];q.level=.32;q.pan=(i%2?1:-1)*(.3+v*.1);q.envs[0].a+=i*.2;q.lfos[0].rate*=1+i*.37;q.fx.delayBeat=[.5,.75,1,1.5][i];state.parts[i]=q;}p.level=.45;p.fm[0][1]=(f%4)*.3;p.fm[1][2]=(f%3)*.2;if([1,3,8,12].includes(f)){p.high=59;for(let i=1;i<4;i++)state.parts[i].low=60;}p.fx.reverb=.35;}
// Five deliberately different articulations per family.
if(v===1){p.cutoff*=.65;p.drive+=.5;}if(v===2){p.cutoff=Math.min(17000,p.cutoff*1.9);p.env+=.6;p.osc[1].semi+=12;}if(v===3){p.envs[0].a*=2;p.envs[0].r*=1.7;p.cutoff*=.55;p.osc[1].level*=.6;}if(v===4){p.osc[1].fine=17;p.spread=.8;p.fx.chorus=.45;p.fx.reverb+=.12;}for(const q of state.parts){q.effects[0].mix=q.fx.delay;q.effects[0].time=q.fx.delayBeat;q.effects[0].feedback=q.fx.feedback;q.effects[1].mix=q.fx.reverb;if(v===4){q.effects[0]=effect('chorus');q.effects[0].mix=.35;}if(b===3&&v===1){q.effects[0]=effect('distortion');q.effects[0].mix=.22;q.effects[0].drive=2.5;}if(b===4&&f%5===0){q.effects[0]=effect(['phaser','flanger','BBD','rotary'][f%4]);q.effects[0].mix=.25;}}factorySequences(state,b,f);return state;}
window.bankNames=bankNames;window.factory=factory;window.presetBanks=presetBanks;window.sources=sources;window.destinations=destinations;

window.effectTypes=effectTypes;

window.newPattern=newPattern;

window.env=env;
