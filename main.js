import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/loaders/RGBELoader.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/postprocessing/UnrealBloomPass.js";
import * as CANNON from "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js";

let scene, camera, renderer, composer;
let world, vehicle, chassisBody;
let carModel;
let keys = {};
let smokeParticles = [];
let clock = new THREE.Clock();
let dayTime = 0;

init();
animate();

async function init() {

scene = new THREE.Scene();

camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight,0.1,2000);
camera.position.set(0,5,15);

renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight),0.6,0.4,0.85));

// HDR
const hdr = await new RGBELoader()
.setPath("https://threejs.org/examples/textures/equirectangular/")
.loadAsync("royal_esplanade_1k.hdr");
hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = hdr;
scene.background = hdr;

// Lights
const sun = new THREE.DirectionalLight(0xffffff,3);
sun.position.set(50,100,50);
sun.castShadow = true;
sun.shadow.mapSize.set(4096,4096);
scene.add(sun);

// Physics
world = new CANNON.World();
world.gravity.set(0,-9.82,0);

// Ground
const groundMat = new THREE.MeshStandardMaterial({
  map: new THREE.TextureLoader().load("https://threejs.org/examples/textures/terrain/grasslight-big.jpg"),
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),groundMat);
ground.rotation.x=-Math.PI/2;
ground.receiveShadow=true;
scene.add(ground);

const groundBody = new CANNON.Body({type:CANNON.Body.STATIC,shape:new CANNON.Plane()});
groundBody.quaternion.setFromEuler(-Math.PI/2,0,0);
world.addBody(groundBody);

// Drift tuned car
chassisBody = new CANNON.Body({mass:1200});
chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(1,0.5,2)));
chassisBody.position.set(0,5,0);
world.addBody(chassisBody);

vehicle = new CANNON.RaycastVehicle({chassisBody});
vehicle.addWheel({
  radius:0.4,
  directionLocal:new CANNON.Vec3(0,-1,0),
  axleLocal:new CANNON.Vec3(-1,0,0),
  suspensionStiffness:20,
  frictionSlip:2.5, // drift enabled
  chassisConnectionPointLocal:new CANNON.Vec3(1,0,1.5)
});
vehicle.addToWorld(world);

// Load GLTF Ferrari
const loader = new GLTFLoader();
carModel = await loader.loadAsync("https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Ferrari/scene.gltf");
carModel.scene.scale.set(2,2,2);
scene.add(carModel.scene);

window.addEventListener("keydown",e=>keys[e.code]=true);
window.addEventListener("keyup",e=>keys[e.code]=false);
}

function updateCar(){
if(keys["KeyW"]) vehicle.applyEngineForce(-4000,0);
if(keys["KeyS"]) vehicle.applyEngineForce(4000,0);
if(keys["KeyA"]) vehicle.setSteeringValue(0.5,0);
if(keys["KeyD"]) vehicle.setSteeringValue(-0.5,0);
if(keys["ShiftLeft"]) vehicle.setBrake(0.2,0);
}

function spawnSmoke(){
const geo = new THREE.SphereGeometry(0.2,8,8);
const mat = new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.5});
const p = new THREE.Mesh(geo,mat);
p.position.copy(carModel.scene.position);
scene.add(p);
smokeParticles.push(p);
}

function updateSmoke(){
smokeParticles.forEach((p,i)=>{
  p.position.y+=0.05;
  p.material.opacity-=0.01;
  if(p.material.opacity<=0){
    scene.remove(p);
    smokeParticles.splice(i,1);
  }
});
}

function animate(){
requestAnimationFrame(animate);
world.step(1/60);
updateCar();

if(keys["ShiftLeft"]) spawnSmoke();
updateSmoke();

if(carModel){
carModel.scene.position.copy(chassisBody.position);
carModel.scene.quaternion.copy(chassisBody.quaternion);
camera.position.lerp(new THREE.Vector3(
  chassisBody.position.x,
  chassisBody.position.y+5,
  chassisBody.position.z+15),0.1);
camera.lookAt(chassisBody.position);
}

dayTime += 0.0005;
scene.background.rotation = dayTime;

composer.render();
}
