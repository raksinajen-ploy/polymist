/* =========================================================
   Body Scent — shared script (all pages)
   Each function runs only if its elements exist on the page.
   ========================================================= */

// ---------- Config: replace with your real URLs ----------
const APPS_SCRIPT_URL = 'APPS_SCRIPT_URL'; // Google Apps Script web app URL (ends with /exec)
const CSV_URL = 'CSV_URL';                 // Google Sheet published-as-CSV URL

const MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* =========================================================
   1) product.html
   ========================================================= */
function initProductPage() {
  const filterBar = document.getElementById('filter-bar');
  const list = document.getElementById('product-list');
  let products = [];

  const params = new URLSearchParams(window.location.search);
  const validKeys = MOODS.map(function (m) { return m.key; });
  let currentMood = params.get('mood') ? params.get('mood').toLowerCase() : 'all';
  if (validKeys.indexOf(currentMood) === -1) currentMood = 'all';

  function renderFilters() {
    if (!filterBar) return;
    filterBar.innerHTML = '';
    MOODS.forEach(function (m) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = m.label;
      btn.dataset.mood = m.key;
      if (m.key === currentMood) btn.classList.add('active');
      btn.addEventListener('click', function () {
        currentMood = m.key;
        renderFilters();
        renderProducts();
      });
      filterBar.appendChild(btn);
    });
  }

  function renderProducts() {
    list.innerHTML = '';
    const shown = products.filter(function (p) {
      return currentMood === 'all' || p.mood === currentMood;
    });

    if (shown.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-center';
      empty.textContent = 'ไม่พบสินค้า';
      list.appendChild(empty);
      return;
    }

    shown.forEach(function (p) {
      const card = document.createElement('article');
      card.className = 'product-card';
      card.dataset.mood = p.mood;

      const img = document.createElement('img');
      img.className = 'product-img';
      img.src = p.image;
      img.alt = p.name;
      img.loading = 'lazy';
      card.appendChild(img);

      const body = document.createElement('div');
      body.className = 'product-body';

      const moodEl = document.createElement('span');
      moodEl.className = 'product-mood';
      moodEl.textContent = p.mood;
      body.appendChild(moodEl);

      const name = document.createElement('h3');
      name.className = 'product-name';
      name.textContent = p.name;
      body.appendChild(name);

      if (p.size) {
        const size = document.createElement('div');
        size.className = 'product-size';
        size.textContent = p.size;
        body.appendChild(size);
      }

      const footer = document.createElement('div');
      footer.className = 'product-footer';

      const price = document.createElement('span');
      price.className = 'product-price';
      price.textContent = Number(p.price).toLocaleString('th-TH') + ' บาท';
      footer.appendChild(price);

      // item = product name (+ size), price = number
      const itemText = p.size ? p.name + ' ' + p.size : p.name;
      const buy = document.createElement('a');
      buy.className = 'btn btn-small';
      buy.textContent = 'สั่งซื้อ';
      buy.href =
        'order.html?item=' + encodeURIComponent(itemText) +
        '&price=' + encodeURIComponent(p.price);
      footer.appendChild(buy);

      body.appendChild(footer);
      card.appendChild(body);
      list.appendChild(card);
    });
  }

  renderFilters();

  fetch('products.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;
      renderProducts();
    })
    .catch(function (error) {
      console.error(error);
      list.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'text-center';
      msg.textContent = 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      list.appendChild(msg);
    });
}

/* =========================================================
   2) order.html
   ========================================================= */
function initOrderPage() {
  const form = document.getElementById('orderForm');
  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  // Auto-fill BOTH #items and #total from URL parameters
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');
  if (item !== null && itemsInput) itemsInput.value = item;
  if (price !== null && totalInput) totalInput.value = price;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* =========================================================
   3) admin.html
   ========================================================= */
function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');

  function showMessage(text) {
    tbody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.textContent = text;
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  fetch(CSV_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      let rows = parseCSV(text);

      // drop a header row if the first cell has no digits (a date always has)
      if (rows.length > 0 && !/\d/.test(rows[0][0] || '')) rows.shift();

      // drop fully empty rows
      rows = rows.filter(function (r) {
        return r.some(function (c) { return c.trim() !== ''; });
      });

      if (rows.length === 0) {
        showMessage('ยังไม่มีคำสั่งซื้อ');
        return;
      }

      // newest first (sheet rows are appended in time order)
      rows.reverse();

      tbody.innerHTML = '';
      rows.forEach(function (r) {
        const tr = document.createElement('tr');
        for (let i = 0; i < 6; i++) {
          const td = document.createElement('td');
          td.textContent = r[i] !== undefined ? r[i] : '';
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (error) {
      console.error(error);
      showMessage('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    });
}

/**
 * Minimal CSV parser (no external library).
 * Handles quoted fields, commas and line breaks inside quotes,
 * and escaped quotes ("").
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  // last field / row without trailing newline
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
