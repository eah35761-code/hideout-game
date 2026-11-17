import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const socket = io();
const $ = id => document.getElementById(id);
const ui = ["menu","lobby","hud","result","mobileControls"];
const show = id => $(id).classList.remove("hidden");
const hide = id => $(id).classList.add("hidden");
let myId=null, roomState=null, myRole="hider", phase="menu", myCharacter="mint";
let playerMeshes=new Map(), remotePositions=new Map(), keys={}, moveVector=new THREE.Vector3();
let moveSpeed=6, running=false, lastSent=0, toastTimer=null;
const colors={mint:0x5de0b2,coral:0xff876b,violet:0xa78bfa,sun:0xffd166};
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x9ed5dc); scene.fog=new THREE.Fog(0x9ed5dc,38,95);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,180);
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; $("game").appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xe7fbff,0x78865b,2.0));
const sun=new THREE.DirectionalLight(0xfff0d6,2.1); sun.position.set(-25,35,15); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-45;sun.shadow.camera.right=45;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;scene.add(sun);
const mat=(color,roughness=.9)=>new THREE.MeshStandardMaterial({color,roughness});
const grass=mat(0x7caa70), pathMat=mat(0xd6c49c), wood=mat(0x966a4b), wall=mat(0xf0d8b4), roof=mat(0x5d6876), leaf=mat(0x477e58), darkLeaf=mat(0x315e48), glass=new THREE.MeshStandardMaterial({color:0x9dd9e5,roughness:.2,metalness:.1});
function box(w,h,d,material,x,y,z,cast=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;scene.add(m);return m;}
function cylinder(rt,rb,h,material,x,y,z,segments=8){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
box(100,.5,100,grass,0,-.35,0,false);
box(7,.04,100,pathMat,0,-.08,0,false);box(100,.04,6,pathMat,0,-.07,0,false);
function tree(x,z,s=1){cylinder(.25*s,.42*s,2.4*s,wood,x,1.1*s,z);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.65*s,1),Math.random()>.5?leaf:darkLeaf);crown.position.set(x,3*s,z);crown.castShadow=true;scene.add(crown);const crown2=new THREE.Mesh(new THREE.IcosahedronGeometry(1.05*s,1),leaf);crown2.position.set(x+.7*s,3.5*s,z+.3*s);scene.add(crown2);}
for(let i=0;i<42;i++){let x=(Math.random()-.5)*82,z=(Math.random()-.5)*82;if(Math.abs(x)<9||Math.abs(z)<8)continue;tree(x,z,.75+Math.random()*.6);}
function house(x,z,w,d,body=wall,roofColor=roof){box(w,4,d,body,x,2,z);box(w+1,.45,d+1,roofColor,x,4.2,z);box(w*.16,1.5,.15,wood,x,1.1,z+d/2+.08);for(let sx of [-1,1])box(1.2,1.1,.12,glass,x+sx*w*.28,2.5,z+d/2+.1);}
house(-14,-13,11,9,mat(0xf0d5ad),mat(0x657487));
house(15,13,12,10,mat(0xd9b99a),mat(0x9b6d59));
house(-18,15,8,7,mat(0xd1dfc6),mat(0x657487));
function shed(x,z){box(9,3.5,7,mat(0xb78d67),x,1.75,z);box(9.8,.5,7.8,mat(0x536b70),x,3.65,z);box(2.2,2.5,.16,wood,x,1.25,z+3.58);}
shed(16,-15);
function crate(x,z,s=1){box(1.5*s,1.5*s,1.5*s,wood,x,.75*s,z);box(1.55*s,.12*s,.12*s,mat(0x63432f),x,.75*s,z+.76*s);box(.12*s,1.55*s,.12*s,mat(0x63432f),x,.75*s,z);}
crate(-8,8);crate(8,-8,1.2);crate(22,2,.8);crate(-23,-4,1.1);
function bench(x,z){box(2.8,.18,.7,wood,x,.8,z);for(let dx of [-1,1])box(.18,.8,.18,mat(0x514b42),x+dx,.4,z);}
bench(4,12);bench(-4,-13);
for(let i=0;i<8;i++){const x=(Math.random()-.5)*55,z=(Math.random()-.5)*55;if(Math.abs(x)>10||Math.abs(z)>10)tree(x,z,.45);}
const local=makeCharacter("mint");scene.add(local);local.position.set(0,0,0);
function makeCharacter(colorName){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CapsuleGeometry(.42,.72,4,8),mat(colors[colorName]||colors.mint));body.position.y=1.05;body.castShadow=true;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.34,12,10),mat(0xffd7b5));head.position.y=1.85;head.castShadow=true;g.add(head);const eyeMat=mat(0x26313b);for(let x of [-.12,.12]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,8,8),eyeMat);eye.position.set(x,1.9,.3);g.add(eye);}const pack=new THREE.Mesh(new THREE.BoxGeometry(.48,.5,.22),mat(0x394b5c));pack.position.set(0,1.05,-.38);g.add(pack);g.userData.body=body;return g;}
camera.position.set(0,7,11);camera.lookAt(0,1,0);
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),2300);}
function enterLobby(code){hide("menu");hide("hud");hide("result");show("lobby");$("roomLabel").textContent=code;phase="lobby";}
$("create").onclick=()=>socket.emit("createRoom",{name:$("name").value});
$("join").onclick=()=>socket.emit("joinRoom",{name:$("name").value,code:$("roomCode").value});
$("start").onclick=()=>socket.emit("startGame");
$("back").onclick=()=>{socket.emit("leaveRoom");show("menu");hide("lobby");phase="menu";};
document.querySelectorAll(".character").forEach(b=>b.onclick=()=>{myCharacter=b.dataset.character;socket.emit("character",{character:myCharacter});document.querySelectorAll(".character").forEach(x=>x.classList.toggle("selected",x===b));});
socket.on("welcome",d=>myId=d.id);
socket.on("joined",d=>enterLobby(d.code));
socket.on("errorMessage",m=>{ $("menuError").textContent=m;toast(m);});
socket.on("state",s=>{roomState=s;renderState();});
socket.on("playerMoved",d=>remotePositions.set(d.id,d.position));
socket.on("found",d=>toast(`${d.name} has been found!`));
socket.on("roundEnd",d=>{hide("hud");hide("mobileControls");show("result");$("resultTitle").textContent=d.winner==="hiders"?"HIDERS WIN!":"SEEKERS WIN!";$("resultText").textContent=d.message;$("scores").innerHTML=d.players.sort((a,b)=>b.score-a.score).map(p=>`<div class="score-row"><span>${escapeHtml(p.name)}</span><b>${p.score} pts</b></div>`).join("");});
socket.on("chat",d=>{const el=document.createElement("div");el.className="chat-line";el.innerHTML=d.system?`<i>${escapeHtml(d.message)}</i>`:`<b>${escapeHtml(d.name)}:</b> ${escapeHtml(d.message)}`;$("chatMessages").appendChild(el);$("chatMessages").scrollTop=$("chatMessages").scrollHeight;});
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderState(){
 if(!roomState)return;
 if(roomState.phase==="lobby"){enterLobby(roomState.code);$("playerCount").textContent=`${roomState.players.length}/12`;$("playerList").innerHTML=roomState.players.map(p=>`<div class="player-item"><span>${escapeHtml(p.name)} ${p.id===roomState.host?'<i class="host">HOST</i>':''}</span><span>${p.id===myId?"YOU":""}</span></div>`).join("");$("start").disabled=roomState.host!==myId||roomState.players.length<2;$("start").style.opacity=$("start").disabled?".45":"1";$("hostHint").textContent=roomState.host===myId?"You are the host. Start when everyone is ready.":"Waiting for the host to start.";return;}
 if(["hide","seek"].includes(roomState.phase)){hide("lobby");hide("menu");hide("result");show("hud");if(innerWidth<800)show("mobileControls");phase=roomState.phase;const me=roomState.players.find(p=>p.id===myId);if(me){myRole=me.role;$("role").textContent=myRole.toUpperCase();$("role").style.background=myRole==="seeker"?"#ffb36b":"#a7f3d0";$("objective").textContent=roomState.phase==="hide"?(myRole==="hider"?"Hide! The seeker is released soon.":"Wait for the hiders to hide."):myRole==="seeker"?"Find and tag every hider!":"Stay away from the seeker!";} $("counter").textContent=`${roomState.players.filter(p=>p.role==="hider"&&!p.found).length} HIDERS LEFT`;syncPlayers(); }
}
function syncPlayers(){
 if(!roomState)return;const alive=new Set(roomState.players.map(p=>p.id));
 for(const [id,obj] of playerMeshes){if(!alive.has(id)){scene.remove(obj);playerMeshes.delete(id);}}
 roomState.players.forEach(p=>{if(p.id===myId)return;let obj=playerMeshes.get(p.id);if(!obj){obj=makeCharacter(p.character);scene.add(obj);playerMeshes.set(p.id,obj);}obj.visible=!(p.found);if(p.position){obj.position.set(p.position.x,0,p.position.z);}else obj.visible=false;});
}
$("continue").onclick=()=>{hide("result");if(roomState){phase="lobby";} };
$("chatToggle").onclick=()=> $("chatBox").classList.toggle("hidden");
$("chatForm").onsubmit=e=>{e.preventDefault();const v=$("chatInput").value.trim();if(v)socket.emit("chat",{message:v});$("chatInput").value="";};
window.addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key.toLowerCase()))e.preventDefault();});
window.addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
let touchDirs={up:false,down:false,left:false,right:false};
document.querySelectorAll("[data-dir]").forEach(b=>{const dir=b.dataset.dir;const on=e=>{e.preventDefault();touchDirs[dir]=true;};const off=e=>{e.preventDefault();touchDirs[dir]=false;};b.addEventListener("pointerdown",on);b.addEventListener("pointerup",off);b.addEventListener("pointerleave",off);b.addEventListener("pointercancel",off);});
$("runBtn").onpointerdown=()=>running=true;$("runBtn").onpointerup=()=>running=false;$("runBtn").onpointerleave=()=>running=false;
function update(dt){
 if(!["hide","seek"].includes(phase)||!roomState)return;
 const me=roomState.players.find(p=>p.id===myId);if(!me||me.found)return;
 let x=(keys.d||keys.arrowright||touchDirs.right?1:0)-(keys.a||keys.arrowleft||touchDirs.left?1:0);
 let z=(keys.s||keys.arrowdown||touchDirs.down?1:0)-(keys.w||keys.arrowup||touchDirs.up?1:0);
 if(x||z){const len=Math.hypot(x,z);x/=len;z/=len;const speed=running||keys.shift?9:6;local.position.x+=x*speed*dt;local.position.z+=z*speed*dt;local.position.x=THREE.MathUtils.clamp(local.position.x,-29,29);local.position.z=THREE.MathUtils.clamp(local.position.z,-29,29);local.rotation.y=Math.atan2(x,z);local.userData.body.position.y=1.05+Math.sin(performance.now()*.015)*.06;
 const now=performance.now();if(now-lastSent>70){socket.emit("move",{x:local.position.x,z:local.position.z});lastSent=now;}
 }
 const desired=new THREE.Vector3(local.position.x,6.2,local.position.z+8.5);camera.position.lerp(desired,.12);camera.lookAt(local.position.x,1,local.position.z);
 if(myRole==="seeker"&&phase==="seek"){for(const p of roomState.players){if(p.role==="hider"&&!p.found&&p.position){const d=Math.hypot(local.position.x-p.position.x,local.position.z-p.position.z);if(d<2.5)socket.emit("tagPlayer",{targetId:p.id});}}}
}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);update(dt);if(roomState&&["hide","seek"].includes(roomState.phase)){const end=roomState.phase==="hide"?roomState.hideEndsAt:roomState.endsAt;const sec=Math.max(0,Math.ceil((end-Date.now())/1000));$("timer").textContent=`${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;}renderer.render(scene,camera);}
const clock=new THREE.Clock();animate();
window.addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
