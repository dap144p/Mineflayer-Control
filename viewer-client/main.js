import * as THREE from "@viewer-three";
import { OrbitControls } from "@viewer-three/examples/jsm/controls/OrbitControls.js";
import prismarineViewer from "prismarine-viewer/viewer";

const { Viewer } = prismarineViewer;
const root = document.querySelector("#viewer");
const status = document.querySelector("#status");
const cameraButton = document.querySelector("#camera");
const botId = new URLSearchParams(window.location.search).get("botId");

function setStatus(message) {
  status.textContent = message;
}

if (!botId) {
  setStatus("ID bot tidak ditemukan.");
  throw new Error("Missing botId.");
}

const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
root.appendChild(renderer.domElement);

const viewer = new Viewer(renderer);
const controls = new OrbitControls(viewer.camera, renderer.domElement);
controls.enableDamping = false;
controls.enabled = true;

const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const socketUrl = protocol + "//" + window.location.host + "/api/viewer/" + encodeURIComponent(botId);
const socket = new WebSocket(socketUrl);
const listeners = new Map();
let cameraMode = "orbit";
let lastPosition = null;
let worldVersion = "";

const emitter = {
  on(event, callback) {
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(callback);
    return this;
  },
  emit(event, data) {
    if (event === "mouseClick" && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ event, data }));
    }
    return this;
  },
};

viewer.listen(emitter);

function setCameraMode(nextMode) {
  cameraMode = nextMode;
  controls.enabled = cameraMode === "orbit";
  cameraButton.textContent = cameraMode === "orbit" ? "Kamera: Orbit" : "Kamera: First Person";
  if (!lastPosition) return;

  const { pos, yaw, pitch } = lastPosition;
  if (cameraMode === "first") {
    viewer.setFirstPersonCamera(pos, yaw, pitch);
  } else {
    controls.target.set(pos.x, pos.y, pos.z);
    viewer.camera.position.set(pos.x + 12, pos.y + 9, pos.z + 12);
    controls.update();
  }
}

cameraButton.addEventListener("click", () => {
  setCameraMode(cameraMode === "orbit" ? "first" : "orbit");
});

function updatePosition(data) {
  if (!data?.pos) return;
  const pos = data.pos;

  if (cameraMode === "first") {
    viewer.setFirstPersonCamera(pos, data.yaw || 0, data.pitch || 0);
  } else if (!lastPosition) {
    controls.target.set(pos.x, pos.y, pos.z);
    viewer.camera.position.set(pos.x + 12, pos.y + 9, pos.z + 12);
    controls.update();
  } else {
    const dx = pos.x - lastPosition.pos.x;
    const dy = pos.y - lastPosition.pos.y;
    const dz = pos.z - lastPosition.pos.z;
    viewer.camera.position.add(new THREE.Vector3(dx, dy, dz));
    controls.target.add(new THREE.Vector3(dx, dy, dz));
    controls.update();
  }

  lastPosition = data;
}

socket.addEventListener("open", () => setStatus("Terhubung • menunggu data dunia…"));
socket.addEventListener("message", (message) => {
  let packet;
  try {
    packet = JSON.parse(message.data);
  } catch {
    return;
  }

  if (packet.event === "error") {
    setStatus(String(packet.data || "Viewer gagal dimuat."));
    return;
  }

  if (packet.event === "version") {
    worldVersion = String(packet.data || "");
    if (!viewer.setVersion(worldVersion)) {
      setStatus("Versi Minecraft ini belum didukung viewer.");
      socket.close();
    } else {
      setStatus("Memuat dunia • " + worldVersion);
    }
    return;
  }

  if (packet.event === "position") {
    updatePosition(packet.data);
  }

  for (const callback of listeners.get(packet.event) || []) {
    callback(packet.data);
  }

  if (packet.event === "loadChunk") {
    setStatus("Viewer aktif • Minecraft " + worldVersion);
  }
});

socket.addEventListener("close", () => setStatus("Viewer terputus."));
socket.addEventListener("error", () => setStatus("Koneksi viewer gagal. Periksa dukungan WebSocket pada proxy."));

function animate() {
  requestAnimationFrame(animate);
  if (cameraMode === "orbit") controls.update();
  viewer.update();
  renderer.render(viewer.scene, viewer.camera);
}
animate();

window.addEventListener("resize", () => {
  viewer.camera.aspect = window.innerWidth / window.innerHeight;
  viewer.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("pagehide", () => {
  socket.close();
  renderer.dispose();
});
