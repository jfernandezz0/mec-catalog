'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { getFlagEmoji } from '@/lib/utils';

type Category = {
  id: number;
  name: string;
  country_code: string;
  articles?: Array<{ count: number }>;
};

interface GlobeProps {
  categories: Category[];
}

// Dominant flag colors for active countries hovers
const flagColors: Record<string, string> = {
  DE: '#ef4444', // Germany
  JP: '#ef4444', // Japan
  IT: '#22c55e', // Italy
  US: '#3b82f6', // USA
  FR: '#2563eb', // France
  GB: '#4f46e5', // UK
  HR: '#dc2626', // Croatia
  SE: '#eab308', // Sweden
  ES: '#ea580c', // Spain
  KR: '#0284c7', // Korea
  AT: '#ef4444', // Austria
  DK: '#e11d48', // Denmark
};

// Spanish names mapping for tooltips
const countryNamesES: Record<string, string> = {
  DE: 'Alemania',
  JP: 'Japón',
  IT: 'Italia',
  US: 'Estados Unidos',
  FR: 'Francia',
  GB: 'Reino Unido',
  HR: 'Croacia',
  SE: 'Suecia',
  ES: 'España',
  KR: 'Corea del Sur',
  AT: 'Austria',
  DK: 'Dinamarca'
};

// Helper to convert hex to RGBA
function hexToRGBA(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper to get realistic satellite colors without clouds
function getRealisticCountryColor(iso: string, name: string): string {
  const desertISO = [
    'DZ', 'EG', 'LY', 'MA', 'SD', 'TN', 'EH', 'SA', 'YE', 'OM', 'AE', 'QA', 'KW', 'IQ', 'JO', 'SY', 'IR', 'AF', 'PK', 'KP', 'MN', 'UZ', 'TM', 'KG', 'TJ'
  ];
  const tundraISO = ['RU', 'CA', 'GL', 'IS', 'FI', 'NO', 'SE'];
  const mediterraneanISO = ['ES', 'PT', 'IT', 'GR', 'TR', 'SY', 'IL', 'LB', 'CY'];
  
  if (iso === 'AQ' || name.includes('ANTARCTICA')) return '#ffffff'; // Snowy Antarctica
  if (iso === 'AU') return '#b8704c'; // Reddish outback Australia
  if (desertISO.includes(iso)) return '#e4c49d'; // Sandy beige desert (Sahara, Middle East, Gobi)
  if (tundraISO.includes(iso)) return '#1f3a22'; // Dark coniferous pine green (Russia, Canada, Scandinavia)
  if (mediterraneanISO.includes(iso)) return '#445c36'; // Dry Mediterranean olive green (Spain, Italy, Greece, Turkey)
  return '#2d5e2d'; // Lush standard green vegetation (US, Amazon, Central Africa, Europe)
}

// Helper to get the center of the largest mainland polygon to prevent off-center jumps for multi-island nations (like France, US, UK)
function getGeometryMainlandCenter(geom: any) {
  const W = 2048;
  const H = 1024;
  
  if (!geom) return { cx: W / 2, cy: H / 2 };
  
  let targetRing: [number, number][] | null = null;
  let maxPoints = 0;

  if (geom.type === 'Polygon') {
    targetRing = geom.coordinates[0];
  } else if (geom.type === 'MultiPolygon') {
    // Find the polygon with the most vertices in its outer ring (which represents the mainland)
    geom.coordinates.forEach((poly: any) => {
      const outerRing = poly[0];
      if (outerRing && outerRing.length > maxPoints) {
        maxPoints = outerRing.length;
        targetRing = outerRing;
      }
    });
  }

  if (!targetRing || targetRing.length === 0) {
    return { cx: W / 2, cy: H / 2 };
  }

  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  targetRing.forEach(([lon, lat]) => {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });

  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;

  return {
    cx: W * (centerLon + 180) / 360,
    cy: H * (90 - centerLat) / 180
  };
}

// Major global city lights coords [lon, lat]
const cityLights = [
  [-0.1278, 51.5074], // London
  [-74.0060, 40.7128], // New York
  [139.6917, 35.6762], // Tokyo
  [2.3522, 48.8566],   // Paris
  [12.4964, 41.9028],  // Rome
  [-3.7038, 40.4168],  // Madrid
  [13.4050, 52.5200],  // Berlin
  [126.9780, 37.5665], // Seoul
  [18.0686, 59.3293],  // Stockholm
  [15.9819, 45.8150],  // Zagreb
  [-77.0369, 38.9072], // Washington DC
  [-118.2437, 34.0522],// Los Angeles
  [-122.4194, 37.7749],// San Francisco
  [116.4074, 39.9042], // Beijing
  [151.2093, -33.8688],// Sydney
  [31.2357, 30.0444],  // Cairo
  [-43.1729, -22.9068],// Rio de Janeiro
  [37.6173, 55.7558],  // Moscow
  [72.8777, 19.0760],  // Mumbai
  [121.4737, 31.2304], // Shanghai
  [114.1694, 22.3193], // Hong Kong
  [-46.6333, -23.5505],// Sao Paulo
  [-99.1332, 19.4326], // Mexico City
  [3.3792, 6.5244],    // Lagos
  [18.4241, -33.9249], // Cape Town
];

// Helper to check if point [x, y] is inside a polygon
function isPointInPolygon(point: [number, number], polygon: [number, number][][]) {
  const [x, y] = point;
  let inside = false;
  const ring = polygon[0]; // Outer boundary
  if (!ring || ring.length < 3) return false;
  
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Helper to check if point is inside a GeoJSON feature geometry
function isPointInFeature(point: [number, number], geometry: any) {
  if (!geometry) return false;
  const { type, coordinates } = geometry;
  if (type === 'Polygon') {
    return isPointInPolygon(point, coordinates);
  } else if (type === 'MultiPolygon') {
    for (let i = 0; i < coordinates.length; i++) {
      if (isPointInPolygon(point, coordinates[i])) {
        return true;
      }
    }
  }
  return false;
}

// Dynamic country matching linking category country_code to GeoJSON properties
function matchCountry(dbCode: string, featureProps: any): boolean {
  if (!dbCode || !featureProps) return false;
  const code = dbCode.toUpperCase().trim();
  
  const iso2 = (featureProps.ISO_A2 || featureProps.iso_a2 || '').toUpperCase();
  const iso3 = (featureProps.ISO_A3 || featureProps.iso_a3 || '').toUpperCase();
  const adm3 = (featureProps.ADM0_A3 || featureProps.adm0_a3 || '').toUpperCase();
  const name = (featureProps.NAME || '').toUpperCase();
  const nameLong = (featureProps.NAME_LONG || '').toUpperCase();
  const nameEs = (featureProps.NAME_ES || '').toUpperCase();
  const postal = (featureProps.POSTAL || '').toUpperCase();
  
  if (code === iso2 || code === iso3 || code === adm3 || code === postal) return true;
  if (code === name || code === nameLong || code === nameEs) return true;
  
  const aliases: Record<string, string[]> = {
    'ALE': ['DE', 'DEU', 'GERMANY', 'ALEMANIA', 'DEUTSCHLAND'],
    'JAP': ['JP', 'JPN', 'JAPAN', 'JAPÓN', 'JAPON'],
    'UK': ['GB', 'GBR', 'UNITED KINGDOM', 'REINO UNIDO', 'GREAT BRITAIN'],
    'SUE': ['SE', 'SWE', 'SWEDEN', 'SUECIA'],
    'CRO': ['HR', 'HRV', 'CROATIA', 'CROACIA'],
    'ESP': ['ES', 'ESP', 'SPAIN', 'ESPAÑA', 'ESPANA'],
    'ES': ['ES', 'ESP', 'SPAIN', 'ESPAÑA', 'ESPANA'],
    'KOR': ['KR', 'KOR', 'SOUTH KOREA', 'COREA DEL SUR'],
    'KR': ['KR', 'KOR', 'SOUTH KOREA', 'COREA DEL SUR'],
    'AUT': ['AT', 'AUT', 'AUSTRIA'],
    'AT': ['AT', 'AUT', 'AUSTRIA'],
    'DNK': ['DK', 'DNK', 'DENMARK', 'DINAMARCA'],
    'DK': ['DK', 'DNK', 'DENMARK', 'DINAMARCA']
  };
  
  const mapped = aliases[code];
  if (mapped) {
    return (
      mapped.includes(iso2) ||
      mapped.includes(iso3) ||
      mapped.includes(name) ||
      mapped.includes(nameEs)
    );
  }
  
  return false;
}

export default function Globe({ categories }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();

  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    visible: boolean;
    name: string;
    flag: string;
    articles: number;
    code: string;
  } | null>(null);

  // Map categories to speed up lookup by uppercase code
  const categoriesByISO2 = categories.reduce<Record<string, Category>>((acc, curr) => {
    const rawCode = curr.country_code.toUpperCase().trim();
    acc[rawCode] = curr;
    return acc;
  }, {});

  // Observe theme changes on html node
  useEffect(() => {
    const checkTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    };

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    checkTheme();

    return () => observer.disconnect();
  }, []);

  // Fetch GeoJSON world map once
  useEffect(() => {
    fetch('/world.geo.json')
      .then(res => res.json())
      .then(data => {
        data.features.forEach((feature: any) => {
          const matchedCat = categories.find(cat => matchCountry(cat.country_code, feature.properties));
          if (matchedCat) {
            feature.category = matchedCat;
          }
        });
        setGeoJsonData(data);
      })
      .catch(err => console.error('Error cargando GeoJSON del mapa:', err));
  }, [categories]);

  // Three.js and Canvas setup
  useEffect(() => {
    if (!geoJsonData || !containerRef.current || !canvasRef.current) return;

    const calculateCameraZ = (a: number) => {
      const minZ = 2.3; // Close-up for wide screens
      const calculatedZ = 1.2 / (Math.tan((45 * Math.PI / 180) / 2) * a);
      return Math.max(minZ, Math.min(calculatedZ, 3.0));
    };

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const aspect = width / height;

    // Create texture canvas (single dynamic holographic map)
    const globeCanvas = document.createElement('canvas');
    globeCanvas.width = 2048;
    globeCanvas.height = 1024;
    const globeCtx = globeCanvas.getContext('2d')!;

    // Init Three.js Scene
    const scene = new THREE.Scene();
    scene.background = null; 

    // Camera setup - camera position calculated dynamically to prevent side cropping.
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 0, calculateCameraZ(aspect));

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);

    // Dynamic texture
    const globeTexture = new THREE.CanvasTexture(globeCanvas);
    globeTexture.colorSpace = THREE.SRGBColorSpace;

    // Create shader material performing shading in LOCAL COORDINATE SPACE with scanlines and atmospheric cyan glow.
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uGlobeTex: { value: globeTexture },
        uTime: { value: 0 }, // Time uniform for scanline/hologram animations
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalV;
        varying vec3 vViewDir;

        void main() {
          vUv = uv;
          vNormalV = normalize(normalMatrix * normal); // View space normal
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = -mvPosition.xyz;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uGlobeTex;
        uniform float uTime;

        varying vec2 vUv;
        varying vec3 vNormalV;
        varying vec3 vViewDir;

        void main() {
          vec3 texColor = texture2D(uGlobeTex, vUv).rgb;

          // Base emission glow to prevent it from being too dark
          vec3 finalColor = texColor + vec3(0.015, 0.08, 0.16);

          // Futuristic Scanline overlay
          float scanline = sin(vUv.y * 500.0 - uTime * 6.0) * 0.08 + 0.92;
          finalColor *= scanline;

          // Holographic glowing horizontal ring scanner (visible globally!)
          float scanner = smoothstep(0.96, 1.0, cos(vUv.y * 6.28318 - uTime * 1.2));
          vec3 scanColor = vec3(0.0, 0.95, 1.0);
          finalColor += scanColor * scanner * 0.35;

          // Atmosphere rim glow using view space vectors
          vec3 normalV = normalize(vNormalV);
          vec3 viewDir = normalize(vViewDir);
          float fresnel = pow(1.0 - max(0.0, dot(normalV, viewDir)), 2.5);
          vec3 glowColor = vec3(0.0, 0.85, 1.0); // Neon cyan glow
          finalColor += glowColor * fresnel * 0.85;

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      transparent: true,
    });

    // Sphere Geometry (radius = 1)
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const globe = new THREE.Mesh(geometry, material);
    globe.position.y = -0.20; // Balanced offset: top cap visible, minimal dead space above, south regions not cut
    scene.add(globe);

    // Glowing energy core inside the Earth (radius = 0.95, pulses Additively)
    const coreGeom = new THREE.SphereGeometry(0.95, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x0066aa,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    globe.add(core);

    // Futuristic holographic outer wireframe shell (radius slightly larger than 1)
    const wireframeGeom = new THREE.SphereGeometry(1.015, 32, 32);
    const wireframeMat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
    });
    const wireframe = new THREE.Mesh(wireframeGeom, wireframeMat);
    globe.add(wireframe);

    // Floating cyber-dust/star field in a shell around the globe
    const starsGeom = new THREE.BufferGeometry();
    const starsCount = 150;
    const starsPos = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1.4 + Math.random() * 0.8;
      starsPos[i] = r * Math.sin(phi) * Math.cos(theta);
      starsPos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starsPos[i + 2] = r * Math.cos(phi);
    }
    starsGeom.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.015,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    const starField = new THREE.Points(starsGeom, starsMat);
    scene.add(starField);

    // Add glowing orbital rings as CHILDREN OF GLOBE (rotate with it!)
    const ringGeom = new THREE.RingGeometry(1.12, 1.125, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    });
    const orbitalRing1 = new THREE.LineLoop(ringGeom, ringMat1);
    orbitalRing1.rotation.x = Math.PI / 3;
    orbitalRing1.rotation.y = Math.PI / 4;
    globe.add(orbitalRing1);

    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xff00ff, // Neon magenta/purple
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15,
    });
    const orbitalRing2 = new THREE.LineLoop(ringGeom, ringMat2);
    orbitalRing2.rotation.x = -Math.PI / 3;
    orbitalRing2.rotation.y = -Math.PI / 5;
    globe.add(orbitalRing2);

    // Initial Y rotation to center Atlantic / Europe in front
    let rotationY = -Math.PI / 2.2;
    let targetRotationY = rotationY;
    globe.rotation.y = rotationY;

    // Center vision at the 45th parallel (42 degrees North tilt)
    globe.rotation.x = 42 * Math.PI / 180; 

    // Create high-tech digital patterns
    // 1. Regular Land Pattern (Subtle cyan dots)
    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = 12;
    dotCanvas.height = 12;
    const dotCtx = dotCanvas.getContext('2d')!;
    dotCtx.fillStyle = 'rgba(0, 180, 255, 0.25)';
    dotCtx.beginPath();
    dotCtx.arc(3, 3, 1, 0, Math.PI * 2);
    dotCtx.fill();
    const landPattern = globeCtx.createPattern(dotCanvas, 'repeat')!;

    // 2. Active Country Pattern (Dense glowing cyan/green grid)
    const activeDotCanvas = document.createElement('canvas');
    activeDotCanvas.width = 8;
    activeDotCanvas.height = 8;
    const activeDotCtx = activeDotCanvas.getContext('2d')!;
    activeDotCtx.fillStyle = 'rgba(0, 255, 180, 0.45)';
    activeDotCtx.beginPath();
    activeDotCtx.arc(2, 2, 1.2, 0, Math.PI * 2);
    activeDotCtx.fill();
    const activePattern = globeCtx.createPattern(activeDotCanvas, 'repeat')!;

    // Helper to get glowing pattern in a specific color on hover
    const getGlowingPattern = (ctx: CanvasRenderingContext2D, color: string) => {
      const c = document.createElement('canvas');
      c.width = 6;
      c.height = 6;
      const cc = c.getContext('2d')!;
      cc.fillStyle = color;
      cc.beginPath();
      cc.arc(2, 2, 1.5, 0, Math.PI * 2);
      cc.fill();
      return ctx.createPattern(c, 'repeat')!;
    };

    // Helper to draw HUD reticle at active country center coordinates
    const drawReticle = (ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, isHovered: boolean) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 1.5 : 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = isHovered ? 10 : 4;
      
      const r = isHovered ? 12 : 8;
      // Draw outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Draw crosshair ticks
      ctx.beginPath();
      ctx.moveTo(cx - r - 4, cy); ctx.lineTo(cx - r + 2, cy);
      ctx.moveTo(cx + r + 4, cy); ctx.lineTo(cx + r - 2, cy);
      ctx.moveTo(cx, cy - r - 4); ctx.lineTo(cx, cy - r + 2);
      ctx.moveTo(cx, cy + r + 4); ctx.lineTo(cx, cy + r - 2);
      ctx.stroke();
      
      // Draw center dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // Helper to draw coordinate lines (lat/long grid)
    const drawGridLines = (ctx: CanvasRenderingContext2D) => {
      const W = 2048;
      const H = 1024;
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.08)';
      ctx.lineWidth = 0.5;
      // Latitude lines
      for (let lat = -90; lat <= 90; lat += 15) {
        const y = H * (90 - lat) / 180;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      // Longitude lines
      for (let lon = -180; lon <= 180; lon += 15) {
        const x = W * (lon + 180) / 360;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
    };

    // Helper to draw GeoJSON coordinates onto canvas
    const drawGeometry = (ctx: CanvasRenderingContext2D, geom: any) => {
      const W = 2048;
      const H = 1024;
      
      const drawRing = (ring: [number, number][]) => {
        if (ring.length < 2) return;
        ctx.beginPath();
        for (let i = 0; i < ring.length; i++) {
          const [lon, lat] = ring[i];
          const x = W * (lon + 180) / 360;
          const y = H * (90 - lat) / 180;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };

      if (geom.type === 'Polygon') {
        geom.coordinates.forEach((ring: any) => drawRing(ring));
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach((poly: any) => {
          poly.forEach((ring: any) => drawRing(ring));
        });
      }
    };

    // Bounding box of a geometry
    function getGeometryBounds(geom: any) {
      let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
      
      const processRing = (ring: [number, number][]) => {
        ring.forEach(([lon, lat]) => {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        });
      };

      if (!geom) return null;
      if (geom.type === 'Polygon') {
        geom.coordinates.forEach((ring: any) => processRing(ring));
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach((poly: any) => {
          poly.forEach((ring: any) => processRing(ring));
        });
      }
      return { minLon, maxLon, minLat, maxLat };
    }

    // Helper to draw connection lanes (dashed curves) between active country nodes
    const drawConnectionArc = (ctx: CanvasRenderingContext2D, cx1: number, cy1: number, cx2: number, cy2: number) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      
      const mx = (cx1 + cx2) / 2;
      const dx = cx1 - cx2;
      const arcHeight = Math.min(250, Math.max(50, Math.abs(dx) * 0.18));
      const my = (cy1 + cy2) / 2 - arcHeight;
      
      ctx.beginPath();
      ctx.moveTo(cx1, cy1);
      ctx.quadraticCurveTo(mx, my, cx2, cy2);
      ctx.stroke();
      ctx.restore();
    };

    // Draw Map Texture with futuristic holographic styling, clear outlines, sonar echoes and data lanes
    const renderGlobeTexture = (hoveredCode: string | null) => {
      const W = 2048;
      const H = 1024;
      globeCtx.clearRect(0, 0, W, H);

      // Pitch black/navy holographic ocean
      globeCtx.fillStyle = '#02050e';
      globeCtx.fillRect(0, 0, W, H);

      // Draw latitude/longitude grid lines
      drawGridLines(globeCtx);

      // Draw Countries
      geoJsonData.features.forEach((feature: any) => {
        const cat = feature.category;
        const name = (feature.properties.NAME || '').toUpperCase();
        const rawIso = feature.properties.ISO_A2 || feature.properties.iso_a2;
        const iso = rawIso ? rawIso.toUpperCase() : '';
        
        const isActive = !!cat;
        const isHovered = hoveredCode && cat && cat.country_code === hoveredCode;

        if (isHovered) {
          // Scale ONLY the country shape relative to its center, add glowing shadow!
          globeCtx.save();
          const { cx, cy } = getGeometryMainlandCenter(feature.geometry);
          globeCtx.translate(cx, cy);
          globeCtx.scale(1.12, 1.12); // Enlarge ONLY this country by 12%
          globeCtx.translate(-cx, -cy);

          // Intense glowing shadow
          globeCtx.shadowColor = flagColors[iso] || '#ffffff';
          globeCtx.shadowBlur = 20;

          // Fill with glowing flag color pattern
          globeCtx.fillStyle = getGlowingPattern(globeCtx, flagColors[iso] || '#ea580c');
          drawGeometry(globeCtx, feature.geometry);

          globeCtx.strokeStyle = '#ffffff';
          globeCtx.lineWidth = 3.5;
          drawGeometry(globeCtx, feature.geometry);

          // Draw HUD reticle at mainland center
          drawReticle(globeCtx, cx, cy, flagColors[iso] || '#ea580c', true);
          globeCtx.restore();

        } else if (iso === 'AQ' || name === 'ANTARCTICA') {
          // Antarctica: subtle white grid pattern
          globeCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          drawGeometry(globeCtx, feature.geometry);
          
          globeCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          globeCtx.lineWidth = 0.5;
          drawGeometry(globeCtx, feature.geometry);
        } else if (isActive) {
          // Active countries: dark cyan base silhouette + dense active dots
          globeCtx.save();
          globeCtx.fillStyle = 'rgba(0, 255, 180, 0.08)';
          drawGeometry(globeCtx, feature.geometry);

          globeCtx.fillStyle = activePattern;
          drawGeometry(globeCtx, feature.geometry);

          // Glowing border stroke
          globeCtx.strokeStyle = flagColors[iso] || '#00ffcc';
          globeCtx.lineWidth = 2.0;
          drawGeometry(globeCtx, feature.geometry);

          // Draw HUD reticle at mainland center
          const { cx, cy } = getGeometryMainlandCenter(feature.geometry);
          drawReticle(globeCtx, cx, cy, flagColors[iso] || '#00ffcc', false);
          globeCtx.restore();
        } else {
          // Inactive countries: clearly visible silhouettes and outlines to avoid empty blackness
          globeCtx.save();
          globeCtx.fillStyle = 'rgba(0, 150, 255, 0.05)';
          drawGeometry(globeCtx, feature.geometry);

          globeCtx.fillStyle = landPattern;
          drawGeometry(globeCtx, feature.geometry);

          // Visible cyber boundary stroke
          globeCtx.strokeStyle = 'rgba(0, 180, 255, 0.22)';
          globeCtx.lineWidth = 0.6;
          drawGeometry(globeCtx, feature.geometry);

          // Bathymetric sonar eco wave outline (offset outline drawing)
          globeCtx.strokeStyle = 'rgba(0, 150, 255, 0.04)';
          globeCtx.lineWidth = 3.2;
          drawGeometry(globeCtx, feature.geometry);
          globeCtx.restore();
        }
      });

      // Scatter city lights dots globally (glowing networks)
      cityLights.forEach(([lon, lat]) => {
        const cx = W * (lon + 180) / 360;
        const cy = H * (90 - lat) / 180;
        
        const rad = 2.5 + Math.random() * 3.5;
        const grad = globeCtx.createRadialGradient(cx, cy, 0.2, cx, cy, rad);
        grad.addColorStop(0, '#fef08a'); // Gold core
        grad.addColorStop(0.3, 'rgba(245, 158, 11, 0.85)');
        grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        
        globeCtx.fillStyle = grad;
        globeCtx.beginPath();
        globeCtx.arc(cx, cy, rad, 0, Math.PI * 2);
        globeCtx.fill();
      });

      // Add extra city light points inside active countries
      geoJsonData.features.forEach((feature: any) => {
        const cat = feature.category;
        if (cat) {
          const bounds = getGeometryBounds(feature.geometry);
          if (bounds) {
            for (let i = 0; i < 15; i++) {
              const randLon = bounds.minLon + Math.random() * (bounds.maxLon - bounds.minLon);
              const randLat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);
              if (isPointInFeature([randLon, randLat], feature.geometry)) {
                const cx = W * (randLon + 180) / 360;
                const cy = H * (90 - randLat) / 180;
                
                const rad = 1.5 + Math.random() * 2;
                globeCtx.fillStyle = 'rgba(251, 146, 60, 0.85)';
                globeCtx.beginPath();
                globeCtx.arc(cx, cy, rad, 0, Math.PI * 2);
                globeCtx.fill();
              }
            }
          }
        }
      });

      // Draw connection lines (dashed data/maritime routes) between active countries
      const activeCoordinates: Record<string, { cx: number, cy: number }> = {};
      geoJsonData.features.forEach((feature: any) => {
        const cat = feature.category;
        if (cat) {
          const { cx, cy } = getGeometryMainlandCenter(feature.geometry);
          activeCoordinates[cat.country_code] = { cx, cy };
        }
      });

      // Define logical network connection links between active countries
      const connections = [
        ['US', 'GB'], ['GB', 'FR'], ['FR', 'DE'], ['DE', 'IT'], 
        ['IT', 'HR'], ['DE', 'SE'], ['DE', 'ES'], ['JP', 'KR'], ['US', 'JP']
      ];
      connections.forEach(([c1, c2]) => {
        const node1 = activeCoordinates[c1];
        const node2 = activeCoordinates[c2];
        if (node1 && node2) {
          drawConnectionArc(globeCtx, node1.cx, node1.cy, node2.cx, node2.cy);
        }
      });

      globeTexture.needsUpdate = true;
    };

    // Initialize texture
    renderGlobeTexture(null);

    // Raycaster for mouse interactions
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let currentHoveredCode: string | null = null;

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(globe, false);

      if (intersects.length > 0) {
        const uv = intersects[0].uv;
        if (uv) {
          const lon = uv.x * 360 - 180;
          const lat = uv.y * 180 - 90;

          let foundCategory: Category | null = null;
          let foundCode: string | null = null;
          let foundFeature: any = null;

          for (const feature of geoJsonData.features) {
            if (feature.category && isPointInFeature([lon, lat], feature.geometry)) {
              foundCategory = feature.category;
              foundCode = feature.category.country_code;
              foundFeature = feature;
              break;
            }
          }

          if (foundCode !== currentHoveredCode) {
            currentHoveredCode = foundCode;
            setHoveredCountry(foundCode);
            renderGlobeTexture(foundCode);
          }

          if (foundCategory && foundFeature) {
            const count = Array.isArray(foundCategory.articles)
              ? foundCategory.articles[0]?.count ?? 0
              : 0;
            
            setTooltip({
              x: e.clientX,
              y: e.clientY,
              visible: true,
              name: countryNamesES[foundCategory.country_code] || foundCategory.name,
              flag: getFlagEmoji(foundCategory.country_code),
              articles: count,
              code: foundCategory.country_code,
            });
          } else {
            setTooltip(prev => prev ? { ...prev, visible: false } : null);
          }
        }
      } else {
        if (currentHoveredCode !== null) {
          currentHoveredCode = null;
          setHoveredCountry(null);
          renderGlobeTexture(null);
        }
        setTooltip(prev => prev ? { ...prev, visible: false } : null);
      }
    };

    const handlePointerOut = () => {
      if (currentHoveredCode !== null) {
        currentHoveredCode = null;
        setHoveredCountry(null);
        renderGlobeTexture(null);
      }
      setTooltip(prev => prev ? { ...prev, visible: false } : null);
    };

    // Pointer Dragging for rotation (covers touch/mouse via pointer events)
    let isDragging = false;
    let previousPointerX = 0;
    let dragDistance = 0;

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      previousPointerX = e.clientX;
      dragDistance = 0;
    };

    const handlePointerMoveGlobal = (e: PointerEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - previousPointerX;
        targetRotationY += deltaX * 0.005;
        dragDistance += Math.abs(deltaX);
        previousPointerX = e.clientX;
      }
    };

    const handlePointerUpGlobal = () => {
      isDragging = false;
    };

    const handleClick = (e: MouseEvent) => {
      // If we dragged more than 15px, don't trigger click navigation
      if (dragDistance > 15) return;

      if (currentHoveredCode) {
        router.push(`/category/${currentHoveredCode.toLowerCase()}`);
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(globe, false);

      if (intersects.length > 0) {
        const uv = intersects[0].uv;
        if (uv) {
          const lon = uv.x * 360 - 180;
          const lat = uv.y * 180 - 90;

          for (const feature of geoJsonData.features) {
            if (feature.category && isPointInFeature([lon, lat], feature.geometry)) {
              router.push(`/category/${feature.category.country_code.toLowerCase()}`);
              break;
            }
          }
        }
      }
    };

    // Canvas bindings
    const canvasEl = canvasRef.current;
    canvasEl.addEventListener('pointerdown', handlePointerDown);
    canvasEl.addEventListener('mousemove', handlePointerMove);
    canvasEl.addEventListener('mouseout', handlePointerOut);
    canvasEl.addEventListener('click', handleClick);

    window.addEventListener('pointermove', handlePointerMoveGlobal, { passive: true });
    window.addEventListener('pointerup', handlePointerUpGlobal, { passive: true });

    // Handle Window Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.position.z = calculateCameraZ(camera.aspect);
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      if (!isDragging && !currentHoveredCode) {
        // Slow auto rotation when idle and not hovering over any country
        targetRotationY += 0.0007;
      }
      rotationY += (targetRotationY - rotationY) * 0.05;
      globe.rotation.y = rotationY;

      // Update time uniform for scanline/scanner animations
      material.uniforms.uTime.value += 0.016;

      // Spin the orbital rings relative to the globe they are attached to
      orbitalRing1.rotation.z += 0.003;
      orbitalRing2.rotation.z -= 0.002;

      // Pulse the glowing core scale slightly
      core.scale.setScalar(0.95 + Math.sin(material.uniforms.uTime.value * 3.0) * 0.03);

      // Rotate star field
      starField.rotation.y += 0.0005;
      starField.rotation.x += 0.0003;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMoveGlobal);
      window.removeEventListener('pointerup', handlePointerUpGlobal);
      
      if (canvasEl) {
        canvasEl.removeEventListener('pointerdown', handlePointerDown);
        canvasEl.removeEventListener('pointermove', handlePointerMove);
        canvasEl.removeEventListener('pointerout', handlePointerOut);
        canvasEl.removeEventListener('click', handleClick);
      }

      // Dispose resources
      geometry.dispose();
      material.dispose();
      globeTexture.dispose();
      
      // Dispose new holographic assets
      wireframeGeom.dispose();
      wireframeMat.dispose();
      ringGeom.dispose();
      ringMat1.dispose();
      ringMat2.dispose();
      coreGeom.dispose();
      coreMat.dispose();
      starsGeom.dispose();
      starsMat.dispose();
      
      renderer.dispose();
    };
  }, [geoJsonData, categories, router]);

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 gap-4">
      <div 
        ref={containerRef} 
        className="relative w-full h-[480px] sm:h-[560px] md:h-[660px] flex items-center justify-center overflow-hidden"
      >
        <canvas 
          ref={canvasRef} 
          className="cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        />
        
        {tooltip && tooltip.visible && (
          <div 
            className="pointer-events-none fixed z-[9999] rounded-2xl border border-[color:var(--border-card-glass)] bg-[color:var(--bg-card-glass)] px-4 py-3 backdrop-blur-md shadow-2xl transition-all duration-150 ease-out flex flex-col gap-1.5"
            style={{
              left: `${tooltip.x + 15}px`,
              top: `${tooltip.y + 15}px`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none">{tooltip.flag}</span>
              <span className="font-bold text-sm text-[color:var(--text-primary)]">
                {tooltip.name}
              </span>
            </div>
            <div className="text-xs text-[color:var(--text-secondary)] font-medium">
              Artículos disponibles: <span className="font-bold text-[color:var(--text-primary)]">{tooltip.articles}</span>
            </div>
            <div className="text-[10px] font-bold tracking-wider uppercase mt-0.5" style={{ color: '#00f0ff' }}>
              HACER CLIC PARA VER
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



