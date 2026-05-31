console.log("Hour | SunLon | Incorrect (x, z) | Correct (x, z)");
console.log("-------------------------------------------------");
for (let h = 0; h < 24; h += 2) {
  const sunLon = -(h - 12) * 15 * (Math.PI / 180);
  const x_inc = Math.sin(sunLon).toFixed(2);
  const z_inc = Math.cos(sunLon).toFixed(2);
  const x_cor = Math.cos(sunLon).toFixed(2);
  const z_cor = (-Math.sin(sunLon)).toFixed(2);
  console.log(`${String(h).padStart(4)} | ${(sunLon * 180 / Math.PI).toFixed(0).padStart(6)} | (${x_inc}, ${z_inc}) | (${x_cor}, ${z_cor})`);
}
