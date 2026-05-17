const placeholder = `data:image/svg+xml;base64,`;

// Create simple but beautiful SVG portraits for each missing person
function createPersonSVG(name, year, category, hue) {
  const initials = name.split(/\s+/).map(w => w[0]).join('').substring(0,2).toUpperCase();
  const isHistorical = year && parseInt(year) < 1800;
  const bgGrad = isHistorical 
    ? `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue},25%,12%)"/><stop offset="100%" stop-color="hsl(${hue},30%,8%)"/></linearGradient>`
    : `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue},20%,15%)"/><stop offset="100%" stop-color="hsl(${hue},25%,10%)"/></linearGradient>`;
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
    <defs>${bgGrad}
      <radialGradient id="glow" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="hsl(${hue},40%,25%)" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
    </defs>
    <rect width="400" height="500" fill="url(#bg)"/>
    <rect width="400" height="500" fill="url(#glow)"/>
    <circle cx="200" cy="180" r="90" fill="none" stroke="hsl(${hue},50%,35%)" stroke-width="2" opacity="0.3"/>
    <text x="200" y="210" text-anchor="middle" font-family="Georgia,serif" font-size="72" font-weight="bold" fill="hsl(${hue},45%,55%)" opacity="0.8">${initials}</text>
    <text x="200" y="350" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="hsl(${hue},30%,70%)" opacity="0.9">${name.length > 25 ? name.substring(0,22)+'...' : name}</text>
    ${year ? `<text x="200" y="380" text-anchor="middle" font-family="monospace" font-size="14" fill="hsl(${hue},40%,50%)" opacity="0.6">${year}</text>` : ''}
    <text x="200" y="420" text-anchor="middle" font-family="sans-serif" font-size="11" fill="hsl(${hue},30%,40%)" opacity="0.5">${category}</text>
  </svg>`;
  return placeholder + btoa(unescape(encodeURIComponent(svg)));
}

module.exports = { createPersonSVG };
