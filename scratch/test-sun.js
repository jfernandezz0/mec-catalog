const now = new Date("2026-05-31T10:53:02+02:00");
const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
console.log("UTC Hour:", utcHour);

const sunLon = -(utcHour - 12) * 15 * (Math.PI / 180);
console.log("Sun Longitude (rad):", sunLon);
console.log("Sun Longitude (deg):", sunLon * 180 / Math.PI);

const x_incorrect = Math.sin(sunLon);
const z_incorrect = Math.cos(sunLon);
console.log("Incorrect Sun Vector (x, z):", x_incorrect, z_incorrect);

// Spain normal is around (0.99, 0, 0.14)
const dot_incorrect = 0.99 * x_incorrect + 0.14 * z_incorrect;
console.log("Incorrect dot product for Spain:", dot_incorrect);
