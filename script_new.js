// === Scene setup ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f36);
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.getElementById('container').appendChild(renderer.domElement);

const drawButton = document.getElementById('drawPathBtn');
const playButton = document.getElementById('playPathBtn');
const clearButton = document.getElementById('clearPathBtn');
const stopButton = document.getElementById('stopPathBtn');
const resetButton = document.getElementById('resetViewBtn');
const addPointButton = document.getElementById('addPointBtn');
const xInput = document.getElementById('xInput');
const yInput = document.getElementById('yInput');
const zInput = document.getElementById('zInput');
const heightInput = document.getElementById('heightInput');
const heightValue = document.getElementById('heightValue');
const positionMap = document.getElementById('positionMap');
const pathStatus = document.getElementById('pathStatus');

function setPathStatus(text) {
  if (pathStatus) pathStatus.textContent = text;
}

function updatePositionMap() {
  if (!positionMap) return;
  const pos = camera.position;
  positionMap.textContent = `Pos: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`;
}

function updateHeightLabel() {
  if (heightValue && heightInput) {
    heightValue.textContent = Number(heightInput.value).toFixed(1);
  }
}

if (heightInput) {
  heightInput.addEventListener('input', updateHeightLabel);
  updateHeightLabel();
}

function createPathLine(points) {
  const curve = points.length > 2 ? new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5) : null;
  const samplePoints = curve ? curve.getPoints(Math.max(64, points.length * 12)) : points;
  const geometry = new THREE.BufferGeometry().setFromPoints(samplePoints);
  const material = new THREE.LineBasicMaterial({ color: 0xffdd55 });
  const line = new THREE.Line(geometry, material);
  return { curve, line };
}

function stopPathPlayback() {
  if (isPlayingPath) {
    isPlayingPath = false;
    setPathStatus('Path stopped');
  }
}

function clearPath() {
  stopPathPlayback();
  isDrawingPath = false;
  pathProgress = 0;

  if (pathLine) {
    scene.remove(pathLine);
    pathLine.geometry.dispose();
    pathLine = null;
  }

  pathPoints = [];
  pathCurve = null;
  setPathStatus('Ready');
  if (drawButton) drawButton.textContent = 'Start Draw';
}

function resetToEarthView() {
  stopPathPlayback();
  autoRotate = true;
  isDragging = false;
  targetCameraPos.set(0, 0, 10);
  targetLookAt.set(0, 0, 0);
  currentLookAt.set(0, 0, 0);
  camera.position.set(0, 0, 10);
  setPathStatus('Earth view restored');
}

function addPathPoint(point) {
  pathPoints.push(point.clone());

  if (pathLine) {
    scene.remove(pathLine);
    pathLine.geometry.dispose();
    pathLine = null;
  }

  const pathData = createPathLine(pathPoints);
  pathCurve = pathData.curve;
  pathLine = pathData.line;
  scene.add(pathLine);
  setPathStatus(`Drawing (${pathPoints.length} points)`);
}

function playPath() {
  if (pathPoints.length < 2) {
    setPathStatus('Add at least 2 points first');
    return;
  }

  pathCurve = new THREE.CatmullRomCurve3(pathPoints, false, 'catmullrom', 0.5);
  isPlayingPath = true;
  isDrawingPath = false;
  pathProgress = 0;
  autoRotate = false;
  setPathStatus('Playing path');
  if (drawButton) drawButton.textContent = 'Start Draw';
  targetCameraPos.copy(pathCurve.getPointAt(0));
  targetLookAt.copy(pathCurve.getPointAt(Math.min(0.02, 1)));
}

if (drawButton) {
  drawButton.addEventListener('click', () => {
    isDrawingPath = !isDrawingPath;
    if (isDrawingPath) {
      stopPathPlayback();
      autoRotate = false;
      setPathStatus('Drawing mode');
      drawButton.textContent = 'Finish Draw';
    } else {
      setPathStatus('Draw complete');
      drawButton.textContent = 'Start Draw';
    }
  });
}

if (playButton) playButton.addEventListener('click', playPath);
if (clearButton) clearButton.addEventListener('click', clearPath);
if (stopButton) stopButton.addEventListener('click', stopPathPlayback);
if (resetButton) resetButton.addEventListener('click', resetToEarthView);
if (addPointButton) {
  addPointButton.addEventListener('click', () => {
    const x = Number(xInput?.value);
    const y = Number(yInput?.value);
    const z = Number(zInput?.value);

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      setPathStatus('Enter valid X/Y/Z values');
      return;
    }

    addPathPoint(new THREE.Vector3(x, y, z));
  });
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (isDrawingPath) {
      isDrawingPath = false;
      setPathStatus('Draw cancelled');
      if (drawButton) drawButton.textContent = 'Start Draw';
    }
    stopPathPlayback();
  }
});

const EARTH_RADIUS = 4;
let missionAltitude = 3.0;
const MISSION_ORBIT_RADIUS = EARTH_RADIUS + 2.8;

function syncMissionAltitude() {
  if (heightInput) {
    missionAltitude = Number(heightInput.value);
  }
  if (heightValue && heightInput) {
    heightValue.textContent = Number(heightInput.value).toFixed(1);
  }
}

if (heightInput) {
  heightInput.addEventListener('input', syncMissionAltitude);
  syncMissionAltitude();
}

let unrealView = true;
let dynamicContrast = 1.15;
let dynamicBrightness = 1.05;
let dynamicHueShift = 0.0;

// Interpolation targets for advanced spatial zooming
let targetCameraPos = camera.position.clone();
let targetLookAt = new THREE.Vector3(0, 0, 0);
let currentLookAt = new THREE.Vector3(0, 0, 0);

let isDrawingPath = false;
let pathPoints = [];
let pathCurve = null;
let pathLine = null;
let isPlayingPath = false;
let pathProgress = 0;
const pathSpeed = 0.0008;

// === Galaxy background ===
const starsGeometry = new THREE.BufferGeometry();
const starVertices = [];
for (let i = 0; i < 10000; i++) {
  starVertices.push(
    THREE.MathUtils.randFloatSpread(2000),
    THREE.MathUtils.randFloatSpread(2000),
    THREE.MathUtils.randFloatSpread(2000)
  );
}
starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
const starMaterial = new THREE.PointsMaterial({ color: 0x99bbff, size: 0.4, sizeAttenuation: true });
const starField = new THREE.Points(starsGeometry, starMaterial);
scene.add(starField);

// === NEW FUNCTION: Image Texture Enhancement Logic ===
// Instantiates a custom material utilizing texture optimization, max anisotropy filtering, and micro-shading tweaks
function enhanceSurfaceMaterial(texture) {
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  
  // Set maximum sharpening filter supported by user hardware graphics cards
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;

  // Build a custom physical material using custom contrast adjustments
  const enhancedMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.45,
    metalness: 0.1,
    bumpScale: 0.05,
  });

  // Inject real-time processing modifications directly inside the fragment shaders compilation loop
  enhancedMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.contrastFactor = { value: dynamicContrast };
    shader.uniforms.brightnessFactor = { value: dynamicBrightness };
    shader.uniforms.unrealFactor = { value: unrealView ? 0.4 : 0.0 };
    shader.uniforms.hueShift = { value: dynamicHueShift };

    shader.fragmentShader = 'uniform float contrastFactor;\nuniform float brightnessFactor;\nuniform float unrealFactor;\nuniform float hueShift;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #include <map_fragment>
      vec3 adjustedColor = sampledDiffuseColor.rgb;
      adjustedColor = mix(vec3(0.5), adjustedColor, contrastFactor);
      adjustedColor = pow(adjustedColor, vec3(brightnessFactor));
      adjustedColor = mix(adjustedColor, adjustedColor * vec3(1.08, 0.92, 1.12), unrealFactor);
      float angle = hueShift * 3.14159265;
      float c = cos(angle);
      float s = sin(angle);
      mat3 hueRotation = mat3(
        0.299 + 0.701 * c + 0.168 * s, 0.587 - 0.587 * c + 0.330 * s, 0.114 - 0.114 * c - 0.497 * s,
        0.299 - 0.299 * c - 0.328 * s, 0.587 + 0.413 * c + 0.035 * s, 0.114 - 0.114 * c + 0.292 * s,
        0.299 - 0.3 * c + 1.25 * s, 0.587 - 0.588 * c - 1.05 * s, 0.114 + 0.886 * c - 0.203 * s
      );
      adjustedColor = mix(adjustedColor, hueRotation * adjustedColor, unrealFactor * 0.6);
      sampledDiffuseColor.rgb = adjustedColor;
      `
    );

    enhancedMaterial.userData.shader = shader;
  };

  return enhancedMaterial;
}

// === Earth Construction ===
const textureLoader = new THREE.TextureLoader();
let earthMaterial = new THREE.MeshPhongMaterial({ color: 0x223344 }); // Fallback placeholder material

const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 64, 64), earthMaterial);
const earthGroup = new THREE.Object3D();
earthGroup.rotation.z = THREE.MathUtils.degToRad(23.5);
earthGroup.add(earthMesh);
scene.add(earthGroup);

// Load texture asynchronously and apply enhancements via callback injection
textureLoader.load('assets/earthmap.jpg', (texture) => {
  earthMesh.material = enhanceSurfaceMaterial(texture);
});

// === Atmosphere ===
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS + 0.075, 64, 64),
  new THREE.MeshPhongMaterial({
    color: 0x66ccff,
    transparent: true,
    opacity: 0.12,
    shininess: 70,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  })
);
earthGroup.add(atmosphere);

const unrealGlow = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS + 0.18, 64, 64),
  new THREE.MeshBasicMaterial({
    color: 0x7aaeff,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  })
);
earthGroup.add(unrealGlow);

// === Lighting ===
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.position.set(5, 3, 5);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x333333));

// === SVG continents ===
const loader = new THREE.SVGLoader();
loader.load('assets/world_map_real_professional.svg', (data) => {
  const svgWidth = 1000; 
  const svgHeight = 500;

  data.paths.forEach((path) => {
    const shapes = path.toShapes(true);
    shapes.forEach((shape) => {
      const geometry = new THREE.ShapeGeometry(shape);
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);

      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        
        const lon = (x / svgWidth) * Math.PI * 2 - Math.PI;
        const lat = -(y / svgHeight) * Math.PI + (Math.PI / 2);

        const surfaceRadius = EARTH_RADIUS + 0.02;
        const targetX = surfaceRadius * Math.cos(lat) * Math.cos(lon);
        const targetY = surfaceRadius * Math.sin(lat);
        const targetZ = surfaceRadius * Math.cos(lat) * Math.sin(lon);

        pos.setXYZ(i, targetX, targetY, targetZ);
      }
      pos.needsUpdate = true;
      earthGroup.add(mesh);
    });
  });
});

// === Satellites ===
const satellites = [];
const satelliteGeometry = new THREE.SphereGeometry(0.02, 8, 8);
const satelliteMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
for (let i = 0; i < 5; i++) {
  const sat = new THREE.Mesh(satelliteGeometry, satelliteMaterial);
  scene.add(sat);
  satellites.push({ mesh: sat, speed: 0.005 + Math.random() * 0.01, angle: Math.random() * Math.PI * 2 });
}

// === Markers ===
const markersData = [{ lat: 0, lon: 0, name: "Center" }];
const markerGeometry = new THREE.SphereGeometry(0.03, 8, 8);
const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const markers = [];

markersData.forEach(data => {
  const phi = (90 - data.lat) * (Math.PI / 180);
  const theta = (data.lon + 180) * (Math.PI / 180);

  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  marker.position.set(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  ).multiplyScalar(EARTH_RADIUS + 0.02);

  marker.userData = { name: data.name };
  earthGroup.add(marker);
  markers.push(marker);
});

// === NEW FUNCTION: Focal LookAt/Image Zoom Function ===
// Calculates normal trajectory vectors based on intersect variables to reposition look targets smoothly
function focusAndZoomToPoint(intersectObject, zoomDistance = 6.0) {
  autoRotate = false;
  
  // Transform intersected surface location back to international world spaces
  const worldPoint = intersectObject.point.clone();
  targetLookAt.copy(worldPoint);

  // Extrapolate an outwards normal vector line path out from the globe sphere center
  const normalDirection = worldPoint.clone().normalize();
  const offsetPosition = worldPoint.clone().add(normalDirection.multiplyScalar(zoomDistance - EARTH_RADIUS));
  
  targetCameraPos.copy(offsetPosition);
}

function mountCameraAtPoint(intersectObject, altitude = 0.15) {
  autoRotate = false;

  const worldPoint = intersectObject.point.clone();
  const surfaceNormal = worldPoint.clone().normalize();

  // Place the camera just above the surface and look outward from that location.
  const mountPosition = worldPoint.clone().add(surfaceNormal.clone().multiplyScalar(altitude));
  const viewTarget = worldPoint.clone().add(surfaceNormal.clone().multiplyScalar(2.5));

  targetCameraPos.copy(mountPosition);
  targetLookAt.copy(viewTarget);
}

function getMissionPathPoint(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const earthIntersects = raycaster.intersectObjects([earthMesh]);
  if (earthIntersects.length > 0) {
    return earthIntersects[0].point.clone().normalize().multiplyScalar(EARTH_RADIUS + missionAltitude);
  }

  const origin = raycaster.ray.origin;
  const direction = raycaster.ray.direction;
  const center = new THREE.Vector3(0, 0, 0);
  const oc = origin.clone().sub(center);
  const b = 2 * oc.dot(direction);
  const c = oc.dot(oc) - (EARTH_RADIUS + missionAltitude) * (EARTH_RADIUS + missionAltitude);
  const discriminant = b * b - 4 * c;

  if (discriminant < 0) {
    return null;
  }

  const sqrtD = Math.sqrt(discriminant);
  const t1 = (-b - sqrtD) / 2;
  const t2 = (-b + sqrtD) / 2;
  const validT = [t1, t2].find((t) => t > 0.001);

  if (validT === undefined) {
    return null;
  }

  return origin.clone().add(direction.clone().multiplyScalar(validT));
}

// === Interaction & Dragging Handling ===
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isDragging = false;
let autoRotate = true;
let previousMousePosition = { x: 0, y: 0 };

renderer.domElement.addEventListener('mousedown', (event) => {
  if (isDrawingPath || isPlayingPath) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects([earthMesh]);

  if (intersects.length > 0) {
    isDragging = true;
    autoRotate = false;
    previousMousePosition = { x: event.clientX, y: event.clientY };
  }
});

renderer.domElement.addEventListener('mousemove', (event) => {
  if (isDragging) {
    const deltaMove = {
      x: event.clientX - previousMousePosition.x,
      y: event.clientY - previousMousePosition.y
    };

    const deltaQuat = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(deltaMove.y * 0.1),
        THREE.MathUtils.degToRad(deltaMove.x * 0.1),
        0,
        'XYZ'
      ));

    earthGroup.quaternion.multiplyQuaternions(deltaQuat, earthGroup.quaternion);
    
    // Clear targeted focus tracking overrides whenever a user begins manually spinning the globe
    targetCameraPos.copy(camera.position);
    targetLookAt.set(0, 0, 0);
  }

  previousMousePosition = { x: event.clientX, y: event.clientY };
});

const stopDragging = () => {
  if (isDragging) {
    isDragging = false;
    // Delay resuming rotation if camera has reset target back to center
    if(targetLookAt.lengthSq() === 0) autoRotate = true;
  }
};

renderer.domElement.addEventListener('mouseup', stopDragging);
renderer.domElement.addEventListener('mouseleave', stopDragging);

// === Wheel Scroll Zoom handling using vector scaling targets ===
renderer.domElement.addEventListener('wheel', (event) => {
  if (isDrawingPath || isPlayingPath) return;
  event.preventDefault();
  
  const moveDirection = new THREE.Vector3().subVectors(camera.position, targetLookAt).normalize();
  const travelAmt = event.deltaY * 0.005;
  
  targetCameraPos.addScaledVector(moveDirection, travelAmt);
  
  // Enforce boundary restrictions relative to core target tracking points
  const distanceToCheck = targetCameraPos.distanceTo(targetLookAt);
  if (distanceToCheck < 5.0) targetCameraPos.copy(targetLookAt).addScaledVector(moveDirection, 5.0);
  if (distanceToCheck > 40.0) targetCameraPos.copy(targetLookAt).addScaledVector(moveDirection, 40.0);
}, { passive: false });

// === Trigger Close Image Zoom on Double-Click event actions ===
renderer.domElement.addEventListener('dblclick', (event) => {
  if (isDrawingPath || isPlayingPath) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects([earthMesh]);
  
  if (intersects.length > 0) {
    // Zoom tightly into image components directly beneath click coordinates
    focusAndZoomToPoint(intersects[0], 5.8);
  } else {
    // Reset system perspective to frame whole globe object if click strikes space backdrop
    targetCameraPos.set(0, 0, 10);
    targetLookAt.set(0, 0, 0);
    autoRotate = true;
  }
});

renderer.domElement.addEventListener('click', (event) => {
  if (!isDrawingPath) return;

  const point = getMissionPathPoint(event);
  if (!point) {
    setPathStatus('Point outside mission range');
    return;
  }

  addPathPoint(point);
});

renderer.domElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects([earthMesh]);

  if (intersects.length > 0) {
    mountCameraAtPoint(intersects[0], 0.18);
  }
});

// === Resize ===
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});



// === Animate ===
function animate() {
  requestAnimationFrame(animate);

  // Smoothly lerp camera positional updates and look vectors for cinematic zoom properties
  camera.position.lerp(targetCameraPos, 0.05);
  currentLookAt.lerp(targetLookAt, 0.05);
  camera.lookAt(currentLookAt);

  if (autoRotate && !isDragging) {
    earthGroup.rotation.y += 0.001;
  }

  satellites.forEach(sat => {
    sat.angle += sat.speed;
    sat.mesh.position.set(
      Math.cos(sat.angle) * 5,
      Math.sin(sat.angle) * 5,
      Math.sin(sat.angle * 2) * 2
    );
  });

  starField.rotation.y += 0.00005;

  if (isPlayingPath && pathCurve) {
    pathProgress = Math.min(1, pathProgress + pathSpeed);
    const position = pathCurve.getPointAt(pathProgress);
    const lookAhead = pathCurve.getPointAt(Math.min(pathProgress + 0.015, 1));
    targetCameraPos.copy(position);
    targetLookAt.copy(lookAhead);
    if (pathProgress >= 1) {
      isPlayingPath = false;
      setPathStatus('Path finished');
    }
  }

  const now = performance.now();
  dynamicContrast = 1.12 + 0.08 * Math.sin(now * 0.0014);
  dynamicBrightness = 1.02 + 0.05 * Math.cos(now * 0.0011);
  dynamicHueShift = 0.15 * Math.sin(now * 0.0008);
  renderer.toneMappingExposure = 1.05 + 0.03 * Math.sin(now * 0.0009);

  const earthMaterialShader = earthMesh.material?.userData?.shader;
  if (earthMaterialShader) {
    earthMaterialShader.uniforms.contrastFactor.value = dynamicContrast;
    earthMaterialShader.uniforms.brightnessFactor.value = dynamicBrightness;
    earthMaterialShader.uniforms.unrealFactor.value = unrealView ? 0.45 : 0.0;
    earthMaterialShader.uniforms.hueShift.value = dynamicHueShift;
  }

  updatePositionMap();
  renderer.render(scene, camera);
}
animate();