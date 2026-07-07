// Minimal SVGLoader (not full features)
// You should replace with full SVGLoader from three.js/examples/js/loaders/SVGLoader.js

THREE.SVGLoader = function () {};
THREE.SVGLoader.prototype.load = function (url, onLoad) {
  const loader = new THREE.FileLoader();
  loader.load(url, function (text) {
    const paths = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const pathElements = doc.querySelectorAll('path');
    pathElements.forEach((p) => {
      const d = p.getAttribute('d');
      if (d) {
        paths.push({ toShapes: () => [new THREE.Shape()] });
      }
    });
    onLoad({ paths: paths });
  });
};
