import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/controls/OrbitControls.js";
import { RGBELoader } from "https://cdn.jsdelivr.net/npm/three@0.160/examples/jsm/loaders/RGBELoader.js";
import * as CANNON from "https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js";

let scene, camera, renderer;
let world;
let carBody, vehicle;
let wheelMeshes = [];
let keys = {};

init();
animate();

function init() {

  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 5, 15);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // HDR Environment for Real Reflections
  new RGBELoader()
    .setPath("https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/")
    .load("royal_esplanade_1k.hdr", function (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      scene.background = texture;
    });

  // Lighting
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(20, 50, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  scene.add(sun);

  // Physics World
  world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);

  // Ground Physics
  const groundBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  // Ground Visual
  const groundGeo = new THREE.PlaneGeometry(500, 500);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Car Physics Body
  const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
  carBody = new CANNON.Body({ mass: 150 });
  carBody.addShape(chassisShape);
  carBody.position.set(0, 4, 0);
  world.addBody(carBody);

  // Raycast Vehicle
  vehicle = new CANNON.RaycastVehicle({
    chassisBody: carBody,
  });

  const wheelOptions = {
    radius: 0.4,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: 30,
    suspensionRestLength: 0.3,
    frictionSlip: 5,
    dampingRelaxation: 2,
    dampingCompression: 4,
    maxSuspensionForce: 100000,
    rollInfluence: 0.01,
    axleLocal: new CANNON.Vec3(-1, 0, 0),
    chassisConnectionPointLocal: new CANNON.Vec3(),
    maxSuspensionTravel: 0.3,
  };

  const positions = [
    [-1, 0, 1.5],
    [1, 0, 1.5],
    [-1, 0, -1.5],
    [1, 0, -1.5]
  ];

  positions.forEach(pos => {
    wheelOptions.chassisConnectionPointLocal.set(pos[0], 0, pos[2]);
    vehicle.addWheel(wheelOptions);
  });

  vehicle.addToWorld(world);

  // Car Visual
  const carMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1, 4),
    new THREE.MeshPhysicalMaterial({
      color: 0xff0000,
      metalness: 1,
      roughness: 0.2,
      clearcoat: 1,
    })
  );
  carMesh.castShadow = true;
  scene.add(carMesh);

  // Wheel Visuals
  vehicle.wheelInfos.forEach(() => {
    const wheelMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    wheelMesh.rotation.z = Math.PI / 2;
    wheelMesh.castShadow = true;
    scene.add(wheelMesh);
    wheelMeshes.push(wheelMesh);
  });

  // Controls
  window.addEventListener("keydown", e => keys[e.code] = true);
  window.addEventListener("keyup", e => keys[e.code] = false);

  // Follow Camera
  function updateCamera() {
    const relativeCameraOffset = new THREE.Vector3(0, 5, -12);
    const matrix = new THREE.Matrix4().makeRotationFromQuaternion(carMesh.quaternion);
    const offset = relativeCameraOffset.applyMatrix4(matrix);
    camera.position.copy(carMesh.position.clone().add(offset));
    camera.lookAt(carMesh.position);
  }

  // Store references
  scene.userData.carMesh = carMesh;
  scene.userData.updateCamera = updateCamera;
}

function updateControls() {
  const engineForce = 3000;
  const maxSteer = 0.5;

  if (keys["KeyW"]) {
    vehicle.applyEngineForce(-engineForce, 2);
    vehicle.applyEngineForce(-engineForce, 3);
  } else if (keys["KeyS"]) {
    vehicle.applyEngineForce(engineForce, 2);
    vehicle.applyEngineForce(engineForce, 3);
  } else {
    vehicle.applyEngineForce(0, 2);
    vehicle.applyEngineForce(0, 3);
  }

  if (keys["KeyA"]) {
    vehicle.setSteeringValue(maxSteer, 0);
    vehicle.setSteeringValue(maxSteer, 1);
  } else if (keys["KeyD"]) {
    vehicle.setSteeringValue(-maxSteer, 0);
    vehicle.setSteeringValue(-maxSteer, 1);
  } else {
    vehicle.setSteeringValue(0, 0);
    vehicle.setSteeringValue(0, 1);
  }

  if (keys["Space"]) {
    vehicle.setBrake(10, 0);
    vehicle.setBrake(10, 1);
    vehicle.setBrake(10, 2);
    vehicle.setBrake(10, 3);
  } else {
    vehicle.setBrake(0, 0);
    vehicle.setBrake(0, 1);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);
  }
}

function animate() {
  requestAnimationFrame(animate);

  world.step(1 / 60);

  updateControls();

  const carMesh = scene.userData.carMesh;
  carMesh.position.copy(carBody.position);
  carMesh.quaternion.copy(carBody.quaternion);

  vehicle.wheelInfos.forEach((wheel, i) => {
    vehicle.updateWheelTransform(i);
    const t = wheel.worldTransform;
    wheelMeshes[i].position.copy(t.position);
    wheelMeshes[i].quaternion.copy(t.quaternion);
  });

  scene.userData.updateCamera();

  renderer.render(scene, camera);
}
