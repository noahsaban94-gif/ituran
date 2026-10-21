import fs from "fs";
import path from "path";

// Generate an ultra-detailed, authentic circular tachograph chart SVG
function generateTachographDiscSvg() {
  const size = 1600;
  const center = size / 2;
  const outerR = 760;
  const innerR = 120;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <!-- Paper parchment gradient -->
    <radialGradient id="discPaper" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fffef9" />
      <stop offset="60%" stop-color="#faf6ec" />
      <stop offset="85%" stop-color="#f5eedc" />
      <stop offset="100%" stop-color="#ece2cc" />
    </radialGradient>
    <radialGradient id="holeGradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1e2229" />
      <stop offset="85%" stop-color="#111317" />
      <stop offset="100%" stop-color="#0a0c0e" />
    </radialGradient>
    <filter id="needleGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#1a202c" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Outer disc background -->
  <circle cx="${center}" cy="${center}" r="${outerR}" fill="url(#discPaper)" stroke="#c4b59d" stroke-width="3" />
  
  <!-- Outer serrated edge / drive notch ring -->
  <circle cx="${center}" cy="${center}" r="${outerR - 10}" fill="none" stroke="#d5c7b0" stroke-width="1.5" stroke-dasharray="4 6" />

  <!-- Speed Scale concentric circles (20, 40, 60, 80, 100, 125 km/h) -->
`;

  // Speeds: 20km/h to 125km/h in the outer band (r: 520 to 720)
  const speedRadii = [
    { speed: 0, r: 520, bold: true },
    { speed: 20, r: 552, bold: false },
    { speed: 40, r: 584, bold: false },
    { speed: 60, r: 616, bold: false },
    { speed: 80, r: 648, bold: true },
    { speed: 100, r: 680, bold: false },
    { speed: 125, r: 720, bold: true },
  ];

  for (const s of speedRadii) {
    const stroke = s.bold ? "#b91c1c" : "#94a3b8";
    const width = s.bold ? "2" : "1";
    const opacity = s.bold ? "0.85" : "0.5";
    svg += `  <circle cx="${center}" cy="${center}" r="${s.r}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}" />\n`;
  }

  // 24 Hour radial lines & numerals (1 to 24)
  for (let h = 0; h < 24; h++) {
    const angleRad = (h * 15 - 90) * (Math.PI / 180);
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    const x1 = center + 260 * cos;
    const y1 = center + 260 * sin;
    const x2 = center + 740 * cos;
    const y2 = center + 740 * sin;

    // Major hour ray
    svg += `  <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#cbd5e1" stroke-width="${h % 6 === 0 ? "2.5" : "1.2"}" stroke-opacity="0.75" />\n`;

    // Half hour tick
    const halfAngleRad = ((h + 0.5) * 15 - 90) * (Math.PI / 180);
    const hx1 = center + 500 * Math.cos(halfAngleRad);
    const hy1 = center + 500 * Math.sin(halfAngleRad);
    const hx2 = center + 730 * Math.cos(halfAngleRad);
    const hy2 = center + 730 * Math.sin(halfAngleRad);
    svg += `  <line x1="${hx1.toFixed(1)}" y1="${hy1.toFixed(1)}" x2="${hx2.toFixed(1)}" y2="${hy2.toFixed(1)}" stroke="#94a3b8" stroke-width="0.8" stroke-opacity="0.5" stroke-dasharray="3 3" />\n`;

    // 10-minute minor ticks
    for (const m of [10, 20, 40, 50]) {
      const minAngle = ((h + m / 60) * 15 - 90) * (Math.PI / 180);
      const mx1 = center + 710 * Math.cos(minAngle);
      const my1 = center + 710 * Math.sin(minAngle);
      const mx2 = center + 725 * Math.cos(minAngle);
      const my2 = center + 725 * Math.sin(minAngle);
      svg += `  <line x1="${mx1.toFixed(1)}" y1="${my1.toFixed(1)}" x2="${mx2.toFixed(1)}" y2="${my2.toFixed(1)}" stroke="#64748b" stroke-width="0.6" stroke-opacity="0.4" />\n`;
    }

    // Hour number at r=735
    const hourLabel = h === 0 ? "24" : String(h);
    const tx = center + 738 * cos;
    const ty = center + 738 * sin;
    const isNight = h >= 20 || h <= 6;
    const textColor = isNight ? "#1e293b" : "#b91c1c";
    svg += `  <text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="${textColor}">${hourLabel}</text>\n`;
  }

  // Distance recording band (concentric rings at r: 420 to 500)
  svg += `  <!-- Distance zigzag band -->\n`;
  svg += `  <circle cx="${center}" cy="${center}" r="430" fill="none" stroke="#64748b" stroke-width="1" stroke-opacity="0.4" />\n`;
  svg += `  <circle cx="${center}" cy="${center}" r="500" fill="none" stroke="#64748b" stroke-width="1.2" stroke-opacity="0.6" />\n`;

  // Activity recording band (r: 310 to 410)
  svg += `  <!-- Activity band -->\n`;
  svg += `  <circle cx="${center}" cy="${center}" r="320" fill="none" stroke="#475569" stroke-width="1.5" stroke-opacity="0.5" />\n`;
  svg += `  <circle cx="${center}" cy="${center}" r="370" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2 4" stroke-opacity="0.4" />\n`;
  svg += `  <circle cx="${center}" cy="${center}" r="410" fill="none" stroke="#475569" stroke-width="1.5" stroke-opacity="0.5" />\n`;

  // Authentic Stylus Chisel / Needle Scribes (Simulated realistic drive/work records for Saban truck)
  // Shift starts ~06:30, finishes ~16:45
  let speedPath = "";
  let distancePath = "";
  let activityPath = "";

  // Generate realistic speed needle graph around 24 hours
  let distState = 440;
  let distDir = 1;

  for (let step = 0; step < 720; step++) {
    const minOfDay = step * 2; // every 2 minutes
    const hour = minOfDay / 60;
    const angleRad = (hour * 15 - 90) * (Math.PI / 180);

    // Is active shift? (06:30 to 16:45)
    let speed = 0;
    let activityR = 330; // resting

    if (hour >= 6.5 && hour <= 16.75) {
      // Periodic driving between stops
      const phase = Math.sin(hour * 3.8);
      const isDriving = phase > 0.1;
      const isPto = !isDriving && Math.sin(hour * 5.2) > 0.3;

      if (isDriving) {
        speed = 45 + Math.sin(hour * 12) * 25 + Math.cos(hour * 24) * 12;
        if (speed < 15) speed = 20;
        if (speed > 88) speed = 88;
        activityR = 395; // driving band

        // Zigzag distance accumulation
        distState += distDir * 2.5;
        if (distState >= 495) distDir = -1;
        if (distState <= 435) distDir = 1;
      } else if (isPto) {
        speed = 0;
        activityR = 365; // work/PTO band
      } else {
        speed = 0;
        activityR = 345; // idle/site stay
      }
    }

    // Speed radius (0km/h = 520, 125km/h = 720)
    const speedR = 520 + (speed / 125) * 200;
    const sx = (center + speedR * Math.cos(angleRad)).toFixed(1);
    const sy = (center + speedR * Math.sin(angleRad)).toFixed(1);

    const dx = (center + distState * Math.cos(angleRad)).toFixed(1);
    const dy = (center + distState * Math.sin(angleRad)).toFixed(1);

    const ax = (center + activityR * Math.cos(angleRad)).toFixed(1);
    const ay = (center + activityR * Math.sin(angleRad)).toFixed(1);

    if (step === 0) {
      speedPath += `M ${sx} ${sy}`;
      distancePath += `M ${dx} ${dy}`;
      activityPath += `M ${ax} ${ay}`;
    } else {
      speedPath += ` L ${sx} ${sy}`;
      distancePath += ` L ${dx} ${dy}`;
      activityPath += ` L ${ax} ${ay}`;
    }
  }

  // Draw stylus scribes with characteristic wax-paper incision look (dark blue-black graphite trace)
  svg += `  <!-- Stylus records: speed trace -->\n`;
  svg += `  <path d="${speedPath}" fill="none" stroke="#0f172a" stroke-width="1.8" stroke-linejoin="round" opacity="0.9" filter="url(#needleGlow)" />\n`;

  svg += `  <!-- Stylus records: distance zigzag -->\n`;
  svg += `  <path d="${distancePath}" fill="none" stroke="#1e293b" stroke-width="1.4" opacity="0.85" />\n`;

  svg += `  <!-- Stylus records: activity mode -->\n`;
  svg += `  <path d="${activityPath}" fill="none" stroke="#090d16" stroke-width="2.2" stroke-linecap="round" opacity="0.95" />\n`;

  // Central driver verification card and inner disc cutout
  svg += `
  <!-- Central Header & Saban Verification Plate -->
  <circle cx="${center}" cy="${center}" r="260" fill="#fffefb" stroke="#94a3b8" stroke-width="1.5" />
  <circle cx="${center}" cy="${center}" r="252" fill="none" stroke="#e2e8f0" stroke-width="1" />

  <!-- Company Branding Box -->
  <rect x="${center - 180}" y="${center - 190}" width="360" height="90" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2" />
  <text x="${center}" y="${center - 165}" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="17" font-weight="bold" fill="#0f172a">ח. סבן חומרי בניין (1994) בע״מ</text>
  <text x="${center}" y="${center - 140}" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="13" font-weight="600" fill="#475569">בקרת דיסקיות טכוגרף וציר זמן לוגיסטי</text>
  <text x="${center}" y="${center - 118}" text-anchor="middle" font-family="monospace" font-size="11" fill="#64748b">KIENZLE 125-24 EC 4B • DIN ISO 7736</text>

  <!-- Driver & Truck Info Fields -->
  <g font-family="'Segoe UI', Arial, sans-serif" font-size="11" fill="#334155">
    <!-- Driver row -->
    <text x="${center - 170}" y="${center - 80}" font-weight="bold">שם הנהג:</text>
    <text x="${center - 110}" y="${center - 80}" font-family="sans-serif" font-size="12" fill="#0369a1" font-weight="bold">ראמי עזאם / ח. סבן</text>

    <!-- Truck ID -->
    <text x="${center + 40}" y="${center - 80}" font-weight="bold">משאית:</text>
    <text x="${center + 95}" y="${center - 80}" font-family="monospace" font-size="12" fill="#b91c1c" font-weight="bold">490-67-202</text>

    <!-- Date -->
    <text x="${center - 170}" y="${center - 55}" font-weight="bold">תאריך:</text>
    <text x="${center - 120}" y="${center - 55}" font-family="monospace">13/10/2026</text>

    <!-- Place -->
    <text x="${center + 40}" y="${center - 55}" font-weight="bold">מקום:</text>
    <text x="${center + 85}" y="${center - 55}">חולון - אתרי מרכז</text>
  </g>

  <!-- Center Pear-shaped / Keyhole Spindle cutout -->
  <circle cx="${center}" cy="${center + 30}" r="${innerR}" fill="url(#holeGradient)" stroke="#000000" stroke-width="4" />
  <!-- Spindle drive pear notch -->
  <path d="M ${center - 28} ${center + 30 - innerR + 10} Q ${center} ${center - 10} ${center + 28} ${center + 30 - innerR + 10} Z" fill="#0f172a" />
  <circle cx="${center}" cy="${center + 30}" r="35" fill="#2d3748" stroke="#4a5568" stroke-width="2" />
  <circle cx="${center}" cy="${center + 30}" r="15" fill="#1a202c" />

  <!-- Verification Stamp -->
  <g transform="translate(${center - 80}, ${center + 140}) rotate(-8)">
    <rect x="-10" y="-18" width="180" height="34" rx="4" fill="none" stroke="#15803d" stroke-width="2" stroke-dasharray="4 2" />
    <text x="80" y="4" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="12" font-weight="bold" fill="#15803d">מאושר • בקרת איתוראן</text>
  </g>
</svg>`;

  return svg;
}

const svgContent = generateTachographDiscSvg();

// 1. Write to public/assets/default-tachograph-disc.svg
const publicAssetsDir = path.resolve(process.cwd(), "public/assets");
if (!fs.existsSync(publicAssetsDir)) {
  fs.mkdirSync(publicAssetsDir, { recursive: true });
}
fs.writeFileSync(path.join(publicAssetsDir, "default-tachograph-disc.svg"), svgContent, "utf-8");
console.log("Wrote public/assets/default-tachograph-disc.svg");

// 2. Write to public/__l5e/assets-v1/2a523071-4f46-4cfe-a91d-b8dcb22c62e4/galya-1310-p13.jpg
// so legacy Lovable path never 404s
const legacyDir = path.resolve(process.cwd(), "public/__l5e/assets-v1/2a523071-4f46-4cfe-a91d-b8dcb22c62e4");
if (!fs.existsSync(legacyDir)) {
  fs.mkdirSync(legacyDir, { recursive: true });
}
// We write both the SVG content and a copy for galya-1310-p13.jpg
fs.writeFileSync(path.join(legacyDir, "galya-1310-p13.jpg"), svgContent, "utf-8");
console.log("Wrote legacy fallback galya-1310-p13.jpg");

// 3. Export as TypeScript data URL in src/assets/default-disc.ts
const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
const tsContent = `// Auto-generated 100% reliable fallback tachograph disc asset
export const DEFAULT_TACHOGRAPH_DISC_SVG_URL = "/assets/default-tachograph-disc.svg";
export const DEFAULT_TACHOGRAPH_DISC_DATA_URL = ${JSON.stringify(dataUrl)};
`;
fs.writeFileSync(path.resolve(process.cwd(), "src/assets/default-disc.ts"), tsContent, "utf-8");
console.log("Wrote src/assets/default-disc.ts");
