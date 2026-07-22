const canvas = document.querySelector('#Canvas');
const dataid = document.querySelector('#dataid');
const datax = document.querySelector('#datax');
const datay = document.querySelector('#datay');
const mapIframe = document.getElementById('osm-frame');


const MAP_HALF_WIDTH_DEG_BASE = 0.009 / 2;
const MAP_HALF_HEIGHT_DEG_BASE = 0.006 / 2;
const MAP_LOGICAL_WIDTH = 60; // 600 
const MAP_LOGICAL_HEIGHT = 40; //400 
const PAN_STEP_PX = 20;
const ZOOM_STEP = 1.12;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

let mapZoom = 1;
let isPanning = false;
let panStart = null;
let id = 0;
let center = { lon: 139.4595, lat: 35.6285 };


if (canvas && mapIframe && dataid && datax && datay) {
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.clientWidth || 600;
    const height = rect.height || canvas.clientHeight || 400;
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    draw();
  }

  function lonToMerc(lon) {
    return (lon * Math.PI) / 180;
  }

  function latToMerc(lat) {
    const rad = (lat * Math.PI) / 180;
    return Math.log(Math.tan(Math.PI / 4 + rad / 2));
  }

  function mercToLon(mx) {
    return (mx * 180) / Math.PI;
  }

  function mercToLat(my) {
    return (2 * Math.atan(Math.exp(my)) - Math.PI / 2) * 180 / Math.PI;
  }

  function getMercScale() {
    const centerX = lonToMerc(center.lon);
    const centerY = latToMerc(center.lat);
    const halfWidthDeg = MAP_HALF_WIDTH_DEG_BASE / mapZoom;
    const halfHeightDeg = MAP_HALF_HEIGHT_DEG_BASE / mapZoom;
    const halfWidthMerc = lonToMerc(center.lon + halfWidthDeg) - centerX;
    const halfHeightMerc = centerY - latToMerc(center.lat + halfHeightDeg);
    return {
      centerX,
      centerY,
      scaleX: halfWidthMerc / (MAP_LOGICAL_WIDTH / 2),
      scaleY: halfHeightMerc / (MAP_LOGICAL_HEIGHT / 2),
    };
  }

  function updateMapIframe() {
    if (!mapIframe) return;
    const halfWidthDeg = MAP_HALF_WIDTH_DEG_BASE / mapZoom;
    const halfHeightDeg = MAP_HALF_HEIGHT_DEG_BASE / mapZoom;
    const bbox = [
      center.lon - halfWidthDeg,
      center.lat - halfHeightDeg,
      center.lon + halfWidthDeg,
      center.lat + halfHeightDeg,
    ].map((value) => value.toFixed(7)).join(',');
    mapIframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}`;
  }

  function logicalToGps(logical) {
    const merc = getMercScale();
    return {
      lon: mercToLon(merc.centerX + logical.x * merc.scaleX),
      lat: mercToLat(merc.centerY - logical.y * merc.scaleY),
    };
  }

  function gpsToLogical(gps) {
    const merc = getMercScale();
    return {
      x: (lonToMerc(gps.lon) - merc.centerX) / merc.scaleX,
      y: (merc.centerY - latToMerc(gps.lat)) / merc.scaleY,
    };
  }

  function canvasToGps(pos) {
    return logicalToGps(canvasToLogical(pos));
  }

  function gpsToCanvas(gps) {
    return logicalToCanvas(gpsToLogical(gps));
  }

  const points = [];

  let draggingPoint = null;
  let lastClickedPoint = null;

  function canvasToLogical(pos) {
    const scaleX = canvas.width / MAP_LOGICAL_WIDTH;
    const scaleY = canvas.height / MAP_LOGICAL_HEIGHT;
    return {
      x: (pos.x - canvas.width / 2) / scaleX,
      y: -1 * (pos.y - canvas.height / 2) / scaleY,
    };
  }

  function logicalToCanvas(point) {
    const scaleX = canvas.width / MAP_LOGICAL_WIDTH;
    const scaleY = canvas.height / MAP_LOGICAL_HEIGHT;
    return {
      x: canvas.width / 2 + point.x * scaleX,
      y: canvas.height / 2 - point.y * scaleY,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const point of points) {
      const screen = gpsToCanvas(point);
      ctx.fillStyle =  '#448f94';

      ctx.beginPath();
      ctx.arc(screen.x, screen.y, point.radius, 0, Math.PI * 2);
      ctx.fill();
      if (lastClickedPoint && point.id === lastClickedPoint.id) {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.stroke();
        continue;
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  }

  function clampLogical(point) {
    const radius = Number(point.radius) || 0;
    const scaleX = canvas.width / 62;
    const scaleY = canvas.height / 62;
    const maxX = (canvas.width / 2 - radius) / scaleX;
    const minX = -(canvas.width / 2 - radius) / scaleX;
    const maxY = (canvas.height / 2 - radius) / scaleY;
    const minY = -(canvas.height / 2 - radius) / scaleY;
    return {
      x: Math.max(minX, Math.min(maxX, point.x)),
      y: Math.max(minY, Math.min(maxY, point.y)),
    };
  }

  function findPointAt(pos) {
    return points.find((point) => {
      const screen = gpsToCanvas(point);
      const dx = pos.x - screen.x;
      const dy = pos.y - screen.y;
      return Math.sqrt(dx * dx + dy * dy) <= point.radius + 4;
    });
  }

  function place(lon, lat) {
    const parsedLon = Number(lon);
    const parsedLat = Number(lat);
    if (!Number.isFinite(parsedLon) || !Number.isFinite(parsedLat)) {
      return null;
    }
    const point = {
      id: id,
      lon: parsedLon,
      lat: parsedLat,
      radius: 10,
    };
    points.push(point);
    id++;
    refreshList();
    draw();
    return point;
  }

  function addPoint(pos) {
    if (canvas.width === 0 || canvas.height === 0) {
      resizeCanvas();
    }
    const gps = canvasToGps(pos);
    return place(gps.lon, gps.lat, 0);
  }

  canvas.addEventListener('mousedown', (evt) => {
    const pos = getMousePos(evt);
    draggingPoint = findPointAt(pos);
    lastClickedPoint = draggingPoint;
    if (!draggingPoint) {
      isPanning = true;
      panStart = { x: evt.clientX, y: evt.clientY, center: { ...center } };
    }
  });

  window.addEventListener('mousemove', (evt) => {
    if (isPanning && !draggingPoint && panStart) {
      const dx = evt.clientX - panStart.x;
      const dy = evt.clientY - panStart.y;
      const halfWidthDeg = MAP_HALF_WIDTH_DEG_BASE / mapZoom;
      const halfHeightDeg = MAP_HALF_HEIGHT_DEG_BASE / mapZoom;
      const degPerPixel = {
        lon: (2 * halfWidthDeg) / canvas.width,
        lat: (2 * halfHeightDeg) / canvas.height,
      };
      center.lon = panStart.center.lon - dx * degPerPixel.lon;
      center.lat = panStart.center.lat + dy * degPerPixel.lat;
      updateMapIframe();
      draw();
      return;
    }

    if (!draggingPoint) {
      return;
    }

    const pos = getMousePos(evt);
    const logical = canvasToLogical(pos);
    const clamped = clampLogical({ x: logical.x, y: logical.y, radius: draggingPoint.radius });
    const gps = logicalToGps({ x: clamped.x, y: clamped.y });
    draggingPoint.lon = gps.lon;
    draggingPoint.lat = gps.lat;
    draw();
  });

  window.addEventListener('mouseup', () => {
    let p = draggingPoint;
    draggingPoint = null;
    isPanning = false;
    panStart = null;
    if (p) {
      dataid.value = p.id;
      datax.value = p.lon;
      datay.value = p.lat;
    }
  });

  function updatePointFromInputs() {
    const idVal = parseInt(dataid.value, 10);
    if (Number.isNaN(idVal)) return;
    const p = points.find(pt => pt.id === idVal);
    if (!p) return;

    const nx = parseFloat(datax.value);
    const ny = parseFloat(datay.value);
    const nextLon = Number.isFinite(nx) ? nx : p.lon;
    const nextLat = Number.isFinite(ny) ? ny : p.lat;
    const logical = gpsToLogical({ lon: nextLon, lat: nextLat });
    const clamped = clampLogical({ x: logical.x, y: logical.y, radius: p.radius });
    const clampedGps = logicalToGps({ x: clamped.x, y: clamped.y });
    p.lon = clampedGps.lon;
    p.lat = clampedGps.lat;

    lastClickedPoint = p;
    draw();
    refreshList();
  }

  datax.addEventListener('input', updatePointFromInputs);
  datay.addEventListener('input', updatePointFromInputs);

  // when dataid changes, refresh input fields with the selected point values
  dataid.addEventListener('input', () => {
    const idVal = parseInt(dataid.value, 10);
    if (Number.isNaN(idVal)) return;
    const p = points.find(pt => pt.id === idVal);
    if (!p) return;
    datax.value = p.lon;
    datay.value = p.lat;
    lastClickedPoint = p;
    draw();
  });
  
  const listDiv = document.getElementById('list');
  function refreshList() {
    if (!listDiv) return;
    const table = listDiv.querySelector('table');
    if (!table) return;
    let tbody = table.querySelector('tbody');
    if (!tbody) {
      tbody = document.createElement('tbody');
      table.appendChild(tbody);
    }
    tbody.innerHTML = '';
    for (const pt of points) {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      const tdId = document.createElement('td'); tdId.textContent = pt.id;
      const tdX = document.createElement('td'); tdX.textContent = Number.isFinite(pt.lon) ? pt.lon.toFixed(6) : '';
      const tdY = document.createElement('td'); tdY.textContent = Number.isFinite(pt.lat) ? pt.lat.toFixed(6) : '';
      const tdDel = document.createElement('td');
      const btn = document.createElement('button');
      btn.textContent = 'Del';
      btn.style.padding = '2px 6px';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePoint(pt.id);
      });
      tdDel.appendChild(btn);
      tr.appendChild(tdId);
      tr.appendChild(tdX);
      tr.appendChild(tdY);
      tr.appendChild(tdDel);
      tr.addEventListener('click', () => {
        dataid.value = pt.id;
        datax.value = pt.lon;
        datay.value = pt.lat;
        lastClickedPoint = pt;
        draw();
      });
      tbody.appendChild(tr);
    }
    if (points.length > 12) {
      listDiv.style.maxHeight = '24em';
      listDiv.style.overflowY = 'auto';
    } else {
      listDiv.style.maxHeight = '';
      listDiv.style.overflowY = '';
    }
  }

  function deletePoint(idToDelete) {
    const idx = points.findIndex(pt => pt.id === idToDelete);
    if (idx === -1) return;
    const removed = points.splice(idx, 1)[0];

    // reindex ids sequentially
    points.forEach((pt, i) => pt.id = i);
    id = points.length;

    // clear selection if removed
    if (lastClickedPoint && lastClickedPoint.id === idToDelete) {
      lastClickedPoint = null;
      dataid.value = '';
      datax.value = '';
      datay.value = '';
    } else {
      // if selection exists, update its id value (because ids shifted)
      if (lastClickedPoint) {
        dataid.value = lastClickedPoint.id;
      }
    }

    refreshList();
    draw();
  }
  canvas.addEventListener('dblclick', (evt) => {
    const pos = getMousePos(evt);
    let p = findPointAt(pos);
    if (p == null) {
      p = addPoint(pos);
    }
    lastClickedPoint = p;
    dataid.value = p.id;
    datax.value = p.lon;
    datay.value = p.lat;
    draw();
  });

  canvas.addEventListener('click', (evt) => {
    const pos = getMousePos(evt);
    let p = findPointAt(pos);
    lastClickedPoint = p;

    if (p) {
      dataid.value = p.id;
      datax.value = p.lon;
      datay.value = p.lat;
      draw();
    }

  });

  canvas.addEventListener('wheel', (evt) => {
    evt.preventDefault();
    const delta = evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    mapZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, mapZoom * delta));
    updateMapIframe();
    draw();
  });

  window.addEventListener('resize', resizeCanvas);

  window.addEventListener('keydown', (evt) => {
    const degPerPixel = {
      lon: (2 * MAP_HALF_WIDTH_DEG) / canvas.width,
      lat: (2 * MAP_HALF_HEIGHT_DEG) / canvas.height,
    };
    let moved = false;
    switch (evt.key) {
      case 'ArrowLeft':
        center.lon += PAN_STEP_PX * degPerPixel.lon;
        moved = true;
        break;
      case 'ArrowRight':
        center.lon -= PAN_STEP_PX * degPerPixel.lon;
        moved = true;
        break;
      case 'ArrowUp':
        center.lat -= PAN_STEP_PX * degPerPixel.lat;
        moved = true;
        break;
      case 'ArrowDown':
        center.lat += PAN_STEP_PX * degPerPixel.lat;
        moved = true;
        break;
    }
    if (!moved) return;
    evt.preventDefault();
    updateMapIframe();
    draw();
  });
  
  const sendBtn = document.getElementById('send');
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      try {
        sendBtn.disabled = true;
        const payload = points.map(pt => ({ id: pt.id, lat: pt.lat,lon: pt.lon}));
        const resp = await fetch('/incidents/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          console.error('Envoi failed', resp.status);
          alert('Erreur lors de l\'envoi: ' + resp.status);
        } else {
          alert('Liste envoyée avec succès');
        }
      } catch (err) {
        console.error(err);
        alert('Erreur réseau lors de l\'envoi');
      } finally {
        sendBtn.disabled = false;
      }
    
  //      alert('demo version no connection to database');
      });
  }

  async function fetchData() {
    try {
      const response = await fetch('/incidents/data');
      if (!response.ok) throw new Error('Erreur HTTP ' + response.status);
      const data = await response.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          const lon = Number(item.lon ?? item.x);
          const lat = Number(item.lat ?? item.y);
          if (Number.isFinite(lon) && Number.isFinite(lat)) {
            points.push({ id: id, lon: lon, lat: lat, radius: 10 });
            id++;
          }
        }
        refreshList();
        draw();
      } else {
        console.warn('fetchData: expected array from server', data);
      }
    } catch (err) {
      console.error('fetchData error:', err);
    }
  }

fetchData().catch(console.error);
  updateMapIframe();
  resizeCanvas();
} else {
  console.warn('draggable.js: canvas introuvable (#Canvas).');
}
