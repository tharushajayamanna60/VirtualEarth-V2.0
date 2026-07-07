// Minimal OrbitControls (not full features)
// You should replace with full OrbitControls from three.js/examples/js/controls/OrbitControls.js

THREE.OrbitControls = function (object, domElement) {
  this.object = object;
  this.domElement = domElement || document;
  this.enableDamping = false;
  this.autoRotate = false;
  this.autoRotateSpeed = 2.0;
  this.enableZoom = true;

  const scope = this;

  function onMouseMove(event) {
    if (!scope.isDragging) return;
    const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    scope.object.rotation.y -= movementX * 0.005;
  }

  function onMouseDown() { scope.isDragging = true; }
  function onMouseUp() { scope.isDragging = false; }

  this.domElement.addEventListener('mousemove', onMouseMove);
  this.domElement.addEventListener('mousedown', onMouseDown);
  this.domElement.addEventListener('mouseup', onMouseUp);

  this.update = function () {
    if (scope.autoRotate) {
      scope.object.rotation.y += 0.001 * scope.autoRotateSpeed;
    }
  };
};
