const canvas = document.querySelector('#Canvas');
const dataid = document.querySelector('#dataid');
const datax = document.querySelector('#datax');
const datay = document.querySelector('#datay');
const dataz = document.querySelector('#dataz');
let id = 0;
if (canvas) {
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    draw();
  }

  const points = [
    //{ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2, radius: 10 },
  ];

  let draggingPoint = null;
  let lastClickedPoint = null;

  function canvasToLogical(pos) {
    const scaleX = canvas.width / 62;
    const scaleY = canvas.height / 62;
    return {
      x: (pos.x - canvas.width / 2) / scaleX,
      y: -1 * (pos.y - canvas.height / 2) / scaleY,
    };
  }

  function logicalToCanvas(point) {
    const scaleX = canvas.width / 62;
    const scaleY = canvas.height / 62;
    return {
      x: canvas.width / 2 + point.x * scaleX,
      y: canvas.height / 2 - point.y * scaleY,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    for (const point of points) {
      const screen = logicalToCanvas(point);
      let color = point.z < 25 ? 125 - point.z * 12 : 0;
      let strcolor = '#' + color.toString(16).padStart(2, '0') + '00' + (255 - color).toString(16).padStart(2, '0');
      ctx.fillStyle = strcolor;

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
    const scaleX = canvas.width / 62;
    const scaleY = canvas.height / 62;
    const maxX = (canvas.width / 2 - point.radius) / scaleX;
    const minX = -(canvas.width / 2 - point.radius) / scaleX;
    const maxY = (canvas.height / 2 - point.radius) / scaleY;
    const minY = -(canvas.height / 2 - point.radius) / scaleY;
    return {
      x: Math.max(minX, Math.min(maxX, point.x)),
      y: Math.max(minY, Math.min(maxY, point.y)),
    };
  }

  function findPointAt(pos) {
    return points.find((point) => {
      const screen = logicalToCanvas(point);
      const dx = pos.x - screen.x;
      const dy = pos.y - screen.y;
      return Math.sqrt(dx * dx + dy * dy) <= point.radius + 4;
    });
  }

  function addPoint(pos) {
    const logical = canvasToLogical(pos);
    const clamped = clampLogical({ x: logical.x, y: logical.y, radius: 10 });
    let p = { id: id, x: clamped.x, y: clamped.y, z: 0, radius: 10 };
    points.push(p);
    id++;
    draw();
    refreshList();
    return p;
  }

  canvas.addEventListener('mousedown', (evt) => {
    const pos = getMousePos(evt);
    draggingPoint = findPointAt(pos);
    lastClickedPoint = draggingPoint;
  });

  window.addEventListener('mousemove', (evt) => {
    if (!draggingPoint) {
      return;
    }
    const pos = getMousePos(evt);
    const logical = canvasToLogical(pos);
    const clamped = clampLogical({ x: logical.x, y: logical.y, radius: draggingPoint.radius });
    draggingPoint.x = clamped.x;
    draggingPoint.y = clamped.y;
    draw();
  });

  window.addEventListener('mouseup', () => {
    let p = draggingPoint;
    draggingPoint = null;
    if (p) {
      dataid.value = p.id;
      datax.value = p.x;
      datay.value = p.y;
      dataz.value = p.z;
    }
  });

  function updatePointFromInputs() {
    const idVal = parseInt(dataid.value, 10);
    if (Number.isNaN(idVal)) return;
    const p = points.find(pt => pt.id === idVal);
    if (!p) return;

    const nx = parseFloat(datax.value);
    const ny = parseFloat(datay.value);
    const nz = parseFloat(dataz.value);

    // apply parsed values if valid, then clamp to remain inside canvas
    if (!Number.isNaN(nx)) p.x = clampLogical({ x: nx, y: p.y, radius: p.radius }).x;
    if (!Number.isNaN(ny)) p.y = clampLogical({ x: p.x, y: ny, radius: p.radius }).y;
    if (!Number.isNaN(nz)) p.z = nz;

    // keep lastClickedPoint in sync
    lastClickedPoint = p;
    draw();
    refreshList();
  }

  datax.addEventListener('input', updatePointFromInputs);
  datay.addEventListener('input', updatePointFromInputs);
  dataz.addEventListener('input', updatePointFromInputs);

  // when dataid changes, refresh input fields with the selected point values
  dataid.addEventListener('input', () => {
    const idVal = parseInt(dataid.value, 10);
    if (Number.isNaN(idVal)) return;
    const p = points.find(pt => pt.id === idVal);
    if (!p) return;
    datax.value = p.x;
    datay.value = p.y;
    dataz.value = p.z;
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
      const tdX = document.createElement('td'); tdX.textContent = Number(pt.x).toFixed(2);
      const tdY = document.createElement('td'); tdY.textContent = Number(pt.y).toFixed(2);
      const tdZ = document.createElement('td'); tdZ.textContent = pt.z;
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
      tr.appendChild(tdZ);
      tr.appendChild(tdDel);
      tr.addEventListener('click', () => {
        dataid.value = pt.id;
        datax.value = pt.x;
        datay.value = pt.y;
        dataz.value = pt.z;
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
      dataz.value = '';
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
    datax.value = p.x;
    datay.value = p.y;
    dataz.value = p.z;
    draw();
  });

  canvas.addEventListener('click', (evt) => {
    const pos = getMousePos(evt);
    let p = findPointAt(pos);
    lastClickedPoint = p;

    if (p) {
      dataid.value = p.id;
      datax.value = p.x;
      datay.value = p.y;
      dataz.value = p.z;
      draw();
    }
  });

  canvas.addEventListener('wheel', (evt) => {
    if (!lastClickedPoint) {
      return;
    }
    evt.preventDefault();
    const step = evt.deltaY > 0 ? -1 : 1;
    lastClickedPoint.z = (lastClickedPoint.z ?? 0) + step;
    dataz.value = lastClickedPoint.z;
    draw();
    refreshList();
  });

  window.addEventListener('resize', resizeCanvas);
  
  const sendBtn = document.getElementById('send');
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
    //   try {
    //     sendBtn.disabled = true;
    //     const payload = points.map(pt => ({ id: pt.id, x: pt.x, y: pt.y, z: pt.z }));
    //     const resp = await fetch('/signs/data', {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify(payload),
    //     });
    //     if (!resp.ok) {
    //       console.error('Envoi failed', resp.status);
    //       alert('Erreur lors de l\'envoi: ' + resp.status);
    //     } else {
    //       alert('Liste envoyée avec succès');
    //     }
    //   } catch (err) {
    //     console.error(err);
    //     alert('Erreur réseau lors de l\'envoi');
    //   } finally {
    //     sendBtn.disabled = false;
    //   }
    
        alert('demo version no connection to database');
      });
  }

  async function fetchData() {
    try {
      const response = await fetch('/signs/data');
      if (!response.ok) throw new Error('Erreur HTTP ' + response.status);
      const data = await response.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          const x = Number(item.x);
          const y = Number(item.y);
          const z = Number(item.z ?? 0);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            points.push({ id: id, x: x, y: y, z: z, radius: 10 });
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
  resizeCanvas();
} else {
  console.warn('draggable.js: canvas introuvable (#Canvas).');
}
