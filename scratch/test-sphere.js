const THREE = require('three');

const geom = new THREE.SphereGeometry(1, 4, 4);
const pos = geom.getAttribute('position');
const uv = geom.getAttribute('uv');

for (let i = 0; i < pos.count; i++) {
  console.log(`Vertex ${i}: pos=(${pos.getX(i).toFixed(3)}, ${pos.getY(i).toFixed(3)}, ${pos.getZ(i).toFixed(3)}), uv=(${uv.getX(i).toFixed(3)}, ${uv.getY(i).toFixed(3)})`);
}
