/* MediCare Online – front-end prototype.
   Prescription verification here is SIMULATED in the browser (localStorage).
   A real pharmacy must verify doctor registration numbers on a secure server. */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = n => "₹" + n.toLocaleString("en-IN");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = id => PRODUCTS.find(p => p.id === id);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
  };

  let cart = store.get("mc_cart", {});
  let rx = store.get("mc_rx", null);
  let category = "All";
  let query = "";

  const RX_VALID_DAYS = 30;
  const FREE_DELIVERY = 499, DELIVERY_FEE = 49;
  const PHARMA_PASSWORD = "pharma123";

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ---------- Prescription helpers ---------- */
  const rxProducts = () => PRODUCTS.filter(p => p.rx);
  const isRxExpired = r => r && (Date.now() - new Date(r.date).getTime()) / 86400000 > RX_VALID_DAYS;
  const isVerified = () => rx && rx.status === "verified" && !isRxExpired(rx);

  function cartRxIssues() {
    const rxItems = Object.keys(cart).map(Number).map(byId).filter(p => p && p.rx);
    if (!rxItems.length) return null;
    if (!rx) return { type: "none", items: rxItems };
    if (rx.status === "pending") return { type: "pending", items: rxItems };
    if (rx.status === "rejected") return { type: "rejected", items: rxItems };
    if (isRxExpired(rx)) return { type: "expired", items: rxItems };
    const missing = rxItems.filter(p => !rx.meds.includes(p.id));
    if (missing.length) return { type: "missing", items: missing };
    return null;
  }

  /* ---------- Shop ---------- */
  function renderChips() {
    const cats = ["All", "Prescription (℞)", ...new Set(PRODUCTS.map(p => p.cat))];
    $("#chips").innerHTML = cats.map(c =>
      `<button class="chip ${c === category ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  }

  function renderGrid() {
    const q = query.trim().toLowerCase();
    const list = PRODUCTS.filter(p => {
      const catOk = category === "All" || (category.startsWith("Prescription") ? p.rx : p.cat === category);
      const qOk = !q || (p.name + " " + p.cat + " " + p.desc).toLowerCase().includes(q);
      return catOk && qOk;
    });
    $("#grid").innerHTML = list.length ? list.map(p => `
      <article class="card">
        <div class="card-img"><img src="${p.img}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none';this.parentElement.insertAdjacentHTML('afterbegin','<span class=\\'fallback-icon\\'>${p.icon}</span>')"><span class="badge ${p.rx ? "badge-rx" : "badge-otc"}">${p.rx ? "℞ Rx" : "OTC"}</span></div>
        <h3>${esc(p.name)}</h3>
        <div class="form">${esc(p.form)}</div>
        <div class="desc">${esc(p.desc)}</div>
        <div class="card-foot">
          <span class="price">${money(p.price)}</span>
          <button class="add" data-add="${p.id}" aria-label="Add ${esc(p.name)} to cart">Add</button>
        </div>
      </article>`).join("") : `<p class="empty">No medicines found. Try a different search.</p>`;
  }

  /* ---------- Cart ---------- */
  function saveCart() { store.set("mc_cart", cart); }
  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    saveCart(); renderCart();
    const p = byId(id);
    toast(p.rx && !isVerified() ? `${p.name} added – prescription needed at checkout` : `${p.name} added to cart`);
  }
  function changeQty(id, d) {
    cart[id] = (cart[id] || 0) + d;
    if (cart[id] <= 0) delete cart[id];
    saveCart(); renderCart();
  }

  function totals() {
    const subtotal = Object.entries(cart).reduce((s, [id, q]) => s + byId(+id).price * q, 0);
    const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY ? 0 : DELIVERY_FEE;
    return { subtotal, delivery, total: subtotal + delivery };
  }

  function renderCart() {
    const ids = Object.keys(cart).map(Number);
    $("#cartCount").textContent = ids.reduce((s, id) => s + cart[id], 0);
    $("#cartItems").innerHTML = ids.length ? ids.map(id => {
      const p = byId(id);
      return `<div class="cart-line">
        <div class="ico"><img src="${p.img}" alt="${esc(p.name)}" onerror="this.outerHTML='${p.icon}'"></div>
        <div>
          <strong>${esc(p.name)} ${p.rx ? '<span class="badge badge-rx">℞</span>' : ""}</strong>
          <span class="tiny">${esc(p.form)}</span>
          <div class="qty">
            <button data-dec="${id}" aria-label="Decrease">−</button>
            <span>${cart[id]}</span>
            <button data-inc="${id}" aria-label="Increase">+</button>
          </div>
        </div>
        <div class="line-price">${money(p.price * cart[id])}<button class="rm" data-rm="${id}">Remove</button></div>
      </div>`;
    }).join("") : `<div class="cart-empty">🛒<p>Your cart is empty.</p></div>`;

    const t = totals();
    $("#subtotal").textContent = money(t.subtotal);
    $("#delivery").textContent = t.delivery ? money(t.delivery) : "Free";
    $("#total").textContent = money(t.total);

    const issue = cartRxIssues();
    const warn = $("#cartWarn");
    if (issue) {
      const names = issue.items.map(p => esc(p.name)).join(", ");
      const msgs = {
        none: `🔒 <strong>Prescription required</strong> for: ${names}. <a href="#prescription" data-close>Upload prescription</a>`,
        pending: `⏳ Your prescription is awaiting pharmacist verification. Checkout unlocks once approved.`,
        rejected: `❌ Your prescription was rejected${rx.reason ? ": " + esc(rx.reason) : ""}. <a href="#prescription" data-close>Submit a new one</a>`,
        expired: `⌛ Your prescription is older than ${RX_VALID_DAYS} days. <a href="#prescription" data-close>Upload a new one</a>`,
        missing: `⚠️ Not covered by your verified prescription: ${names}. <a href="#prescription" data-close>Add to prescription</a> or remove them.`
      };
      warn.innerHTML = msgs[issue.type];
      warn.hidden = false;
    } else warn.hidden = true;
    $("#checkoutBtn").disabled = !ids.length || !!issue;
  }

  function openCart() { $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#overlay").hidden = false; }
  function closeCart() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); $("#overlay").hidden = true; }

  /* ---------- Prescription UI ---------- */
  function renderRxMeds() {
    $("#rxMedList").innerHTML = rxProducts().map(p =>
      `<label><input type="checkbox" name="meds" value="${p.id}"> ${esc(p.name)}</label>`).join("");
  }

  function renderRxStatus() {
    const btn = $("#rxStatusBtn"), card = $("#rxStatusCard");
    if (!rx) {
      btn.className = "pill pill-none"; btn.textContent = "℞ No prescription";
      card.className = "status-card";
      card.innerHTML = `<h4>No prescription on file</h4><p class="muted">OTC products can be bought freely. Submit a prescription to unlock ℞ medicines.</p>`;
      return;
    }
    const medNames = rx.meds.map(id => esc(byId(id).name));
    const details = `<ul>
      <li>Patient: <strong>${esc(rx.patient)}</strong></li>
      <li>Doctor: <strong>${esc(rx.doctor)}</strong> (Reg. ${esc(rx.regno)})</li>
      <li>Clinic: ${esc(rx.clinic)} · Dated ${esc(rx.date)}</li>
      <li>Medicines: ${medNames.join(", ")}</li></ul>`;
    const expired = rx.status === "verified" && isRxExpired(rx);
    if (expired) {
      btn.className = "pill pill-bad"; btn.textContent = "℞ Expired";
      card.className = "status-card bad";
      card.innerHTML = `<h4>⌛ Prescription expired</h4>${details}<p>Prescriptions are valid for ${RX_VALID_DAYS} days. Please upload a new one.</p>
        <div class="status-actions"><button class="btn btn-ghost" data-rx-clear>Remove</button></div>`;
    } else if (rx.status === "pending") {
      btn.className = "pill pill-pending"; btn.textContent = "℞ Pending review";
      card.className = "status-card pending";
      card.innerHTML = `<h4>⏳ Awaiting pharmacist verification</h4>${details}
        <p class="tiny">In a live site, a pharmacist would check the doctor's registration number with the medical council. For this demo, open the <em>Pharmacist panel</em> in the footer (password <code>pharma123</code>) to approve it.</p>
        <div class="status-actions"><button class="btn btn-ghost" data-rx-clear>Cancel request</button></div>`;
    } else if (rx.status === "verified") {
      btn.className = "pill pill-ok"; btn.textContent = "℞ Verified ✔";
      card.className = "status-card ok";
      card.innerHTML = `<h4>✔ Prescription verified</h4>${details}<p>Listed medicines can now be purchased.</p>
        <div class="status-actions"><a href="#shop" class="btn btn-primary">Shop now</a><button class="btn btn-ghost" data-rx-clear>Remove</button></div>`;
    } else {
      btn.className = "pill pill-bad"; btn.textContent = "℞ Rejected";
      card.className = "status-card bad";
      card.innerHTML = `<h4>❌ Prescription rejected</h4>${details}<p>Reason: ${esc(rx.reason || "Not specified")}</p>
        <div class="status-actions"><button class="btn btn-ghost" data-rx-clear>Submit a new one</button></div>`;
    }
  }

  function validateRx(f) {
    const d = new FormData(f);
    const get = k => String(d.get(k) || "").trim();
    const file = d.get("file");
    const meds = d.getAll("meds").map(Number);
    if (!get("patient") || !get("doctor") || !get("clinic") || !get("regno") || !get("date")) return "Please fill in all fields.";
    if (!/^[A-Za-z]{2,8}[\s\/\-]?\d{3,8}([\s\/\-]\d{2,4})?$/.test(get("regno")))
      return "Enter a valid registration number, e.g. TN/12345/2015 or MH-123456.";
    const dt = new Date(get("date")), now = new Date();
    if (isNaN(dt) || dt > now) return "Prescription date cannot be in the future.";
    if ((now - dt) / 86400000 > RX_VALID_DAYS) return `Prescription is older than ${RX_VALID_DAYS} days and cannot be accepted.`;
    if (!meds.length) return "Select at least one medicine written on the prescription.";
    if (!file || !file.size) return "Please upload your prescription (JPG, PNG or PDF).";
    if (!/^image\/|application\/pdf/.test(file.type)) return "Only images or PDF files are accepted.";
    if (file.size > 5 * 1024 * 1024) return "File is larger than 5 MB.";
    return "";
  }

  function submitRx(e) {
    e.preventDefault();
    const f = e.target, err = validateRx(f);
    $("#rxError").textContent = err;
    if (err) return;
    const d = new FormData(f), file = d.get("file");
    const finish = preview => {
      rx = {
        status: "pending",
        patient: d.get("patient").trim(), doctor: d.get("doctor").trim(),
        regno: d.get("regno").trim().toUpperCase(), clinic: d.get("clinic").trim(),
        date: d.get("date"), meds: d.getAll("meds").map(Number),
        fileName: file.name, preview, submittedAt: new Date().toISOString()
      };
      if (!store.set("mc_rx", rx)) { rx.preview = null; store.set("mc_rx", rx); }
      f.reset(); renderRxStatus(); renderCart();
      toast("Prescription submitted for verification");
    };
    if (file.type.startsWith("image/") && file.size < 1.2 * 1024 * 1024) {
      const r = new FileReader();
      r.onload = () => finish(r.result);
      r.onerror = () => finish(null);
      r.readAsDataURL(file);
    } else finish(null);
  }

  function setRxStatus(status, reason) {
    if (!rx) return;
    rx.status = status; rx.reason = reason || "";
    store.set("mc_rx", rx);
    renderRxStatus(); renderCart(); renderPharma();
  }

  /* ---------- Pharmacist panel (demo) ---------- */
  function renderPharma() {
    const box = $("#pharmaContent");
    if (!rx) { box.innerHTML = `<p class="muted">No prescriptions waiting for review.</p>`; return; }
    box.innerHTML = `<div class="rx-review">
      <strong>Status: ${esc(rx.status.toUpperCase())}</strong>
      <div>Patient: ${esc(rx.patient)}</div>
      <div>Doctor: ${esc(rx.doctor)} · Reg. no. <code>${esc(rx.regno)}</code></div>
      <div>Clinic: ${esc(rx.clinic)} · Date: ${esc(rx.date)}</div>
      <div>Medicines: ${rx.meds.map(id => esc(byId(id).name)).join(", ")}</div>
      <div>File: ${esc(rx.fileName)}</div>
      ${rx.preview ? `<img src="${rx.preview}" alt="Uploaded prescription">` : `<span class="tiny">(No image preview – PDF or large file)</span>`}
      <p class="tiny">Checklist: registration number matches the medical council register · doctor's signature/stamp present · date within ${RX_VALID_DAYS} days · medicines match.</p>
      ${rx.status === "pending" ? `<div class="dlg-actions">
        <button class="btn btn-ghost" id="rejectRx">Reject</button>
        <button class="btn btn-primary" id="approveRx">Approve</button></div>` : ""}
    </div>`;
  }

  /* ---------- Order History ---------- */
  function renderOrderHistory() {
    const orders = store.get("mc_orders", []);
    const container = $("#orderHistory");
    if (!container) return;
    if (!orders.length) {
      container.innerHTML = '<div class="cart-empty"><p>No orders yet. Start shopping!</p></div>';
      return;
    }
    container.innerHTML = orders.map(o => {
      const d = new Date(o.date);
      const itemsSummary = o.items.map(i => `${esc(i.name)} × ${i.qty}`).join(", ");
      const a = o.address || {};
      return `<div class="order-card">
        <div class="order-card-header">
          <h4>Order #${esc(o.id)}</h4>
          <span class="order-status confirmed">✓ Confirmed</span>
        </div>
        <div class="order-card-items">${itemsSummary}</div>
        <div class="order-addr">📍 ${a.fullname ? esc(a.fullname) + ', ' : ''}${a.addr1 ? esc(a.addr1) + ', ' : ''}${a.city ? esc(a.city) : ''} ${a.pincode ? '– ' + esc(a.pincode) : ''}</div>
        <div class="order-card-footer">
          <span class="tiny">${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
          <strong>${money(o.totals.total)}</strong>
        </div>
      </div>`;
    }).join("");
  }

  /* ---------- Enhanced Multi-Step Checkout ---------- */
  let ckStep = 1;
  const ckData = { address: {}, payment: "cod" };

  function goToStep(n) {
    ckStep = n;
    for (let i = 1; i <= 4; i++) {
      const panel = $(`#ckPanel${i}`);
      if (panel) panel.hidden = i !== n;
    }
    // Update progress bar
    $$(".ck-step").forEach(el => {
      const s = +el.dataset.ckstep;
      el.classList.toggle("active", s === n);
      el.classList.toggle("done", s < n);
    });
    // Build content for the step
    if (n === 1) renderCkItems();
    if (n === 4) renderCkReview();
  }

  function renderCkItems() {
    const ids = Object.keys(cart).map(Number);
    $("#ckOrderItems").innerHTML = ids.map(id => {
      const p = byId(id), qty = cart[id];
      return `<div class="ck-item">
        <img class="ck-item-img" src="${p.img}" alt="${esc(p.name)}" onerror="this.outerHTML='<div class=\\'ck-item-img\\' style=\\'display:grid;place-items:center;font-size:1.5rem\\'>${p.icon}</div>'">
        <div class="ck-item-info">
          <span class="ck-item-name">${esc(p.name)} ${p.rx ? '<span class="badge badge-rx">℞</span>' : ''}</span>
          <span class="ck-item-meta">${esc(p.form)}</span>
        </div>
        <div>
          <div class="ck-item-price">${money(p.price * qty)}</div>
          <div class="ck-item-qty">Qty: ${qty} × ${money(p.price)}</div>
        </div>
      </div>`;
    }).join("");
    renderCkTotals("ckTotals1");
  }

  function renderCkTotals(containerId) {
    const t = totals();
    const itemCount = Object.values(cart).reduce((s, q) => s + q, 0);
    $(`#${containerId}`).innerHTML = `
      <div class="total-row small"><span>Items (${itemCount})</span><span>${money(t.subtotal)}</span></div>
      <div class="total-row small"><span>Delivery</span><span>${t.delivery ? money(t.delivery) : '<span style="color:var(--ok)">Free ✓</span>'}</span></div>
      ${t.subtotal > 0 && t.subtotal < FREE_DELIVERY ? `<div class="total-row discount"><span>Add ${money(FREE_DELIVERY - t.subtotal)} more for free delivery!</span><span></span></div>` : ''}
      <div class="total-row big"><span>Total</span><span>${money(t.total)}</span></div>`;
  }

  function validateAddress() {
    const fields = {
      fullname: $("#ckName").value.trim(),
      phone: $("#ckPhone").value.trim(),
      email: $("#ckEmail").value.trim(),
      addr1: $("#ckAddr1").value.trim(),
      city: $("#ckCity").value.trim(),
      state: $("#ckState").value,
      pincode: $("#ckPin").value.trim()
    };
    if (!fields.fullname) return "Please enter your full name.";
    if (!/^[0-9]{10}$/.test(fields.phone)) return "Enter a valid 10-digit phone number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return "Enter a valid email address.";
    if (!fields.addr1) return "Please enter your address.";
    if (!fields.city) return "Please enter your city.";
    if (!fields.state) return "Please select your state.";
    if (!/^[0-9]{6}$/.test(fields.pincode)) return "Enter a valid 6-digit PIN code.";
    ckData.address = {
      ...fields,
      addr2: $("#ckAddr2").value.trim(),
      instructions: $("#ckInstr").value.trim()
    };
    return "";
  }

  function getPaymentLabel(val) {
    return { cod: "Cash on Delivery", upi: "UPI Payment", card: "Credit / Debit Card", netbanking: "Net Banking" }[val] || val;
  }

  function renderCkReview() {
    const a = ckData.address;
    const ids = Object.keys(cart).map(Number);
    $("#ckReviewContent").innerHTML = `
      <div class="ck-review-section">
        <h4>📍 Delivery Address</h4>
        <div class="ck-review-row"><strong>${esc(a.fullname)}</strong></div>
        <div class="ck-review-row" style="display:block;color:var(--muted)">
          ${esc(a.addr1)}${a.addr2 ? ', ' + esc(a.addr2) : ''}<br>
          ${esc(a.city)}, ${esc(a.state)} – ${esc(a.pincode)}<br>
          📞 ${esc(a.phone)} · ✉ ${esc(a.email)}
          ${a.instructions ? '<br>📝 ' + esc(a.instructions) : ''}
        </div>
      </div>
      <div class="ck-review-section">
        <h4>🛒 Items (${ids.length})</h4>
        <div class="ck-review-items">
          ${ids.map(id => {
            const p = byId(id), qty = cart[id];
            return `<div class="ck-review-item"><span>${esc(p.name)} × ${qty}</span><strong>${money(p.price * qty)}</strong></div>`;
          }).join("")}
        </div>
      </div>
      <div class="ck-review-section">
        <h4>💳 Payment</h4>
        <div class="ck-review-row"><span>${getPaymentLabel(ckData.payment)}</span></div>
      </div>`;
    renderCkTotals("ckTotals4");
    // Reset agree checkbox
    $("#ckAgree").checked = false;
    $("#placeOrderBtn").disabled = true;
  }

  function openCheckout() {
    if (cartRxIssues()) return renderCart();
    closeCart();
    ckStep = 1;
    goToStep(1);
    $("#checkoutDlg").showModal();
  }

  function placeOrder() {
    if (cartRxIssues()) { $("#checkoutDlg").close(); toast("Prescription check failed"); return; }
    const t = totals();
    const orderId = "MC" + Date.now().toString().slice(-7);
    const orderDate = new Date();
    const estimatedDays = 2 + Math.floor(Math.random() * 3); // 2-4 days
    const deliveryDate = new Date(orderDate.getTime() + estimatedDays * 86400000);
    const a = ckData.address;
    const ids = Object.keys(cart).map(Number);

    // Build order object for history
    const order = {
      id: orderId,
      date: orderDate.toISOString(),
      items: ids.map(id => ({ name: byId(id).name, qty: cart[id], price: byId(id).price })),
      address: a,
      payment: ckData.payment,
      totals: t
    };

    // Save to order history
    const history = store.get("mc_orders", []);
    history.unshift(order);
    store.set("mc_orders", history);

    // Build success receipt
    $("#successMsg").textContent = `Thank you, ${a.fullname}! Your order has been confirmed.`;
    $("#orderSummaryFinal").innerHTML = `
      <div class="receipt-header">
        <h4>MediCare Online</h4>
        <div class="tiny">Order #${orderId} · ${orderDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
        <div style="margin-top:8px"><span class="receipt-badge">✓ Order Confirmed</span></div>
      </div>
      <div class="receipt-items">
        ${ids.map(id => {
          const p = byId(id), qty = cart[id];
          return `<div class="receipt-row"><span>${esc(p.name)} × ${qty}</span><span>${money(p.price * qty)}</span></div>`;
        }).join("")}
      </div>
      <div class="receipt-row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      <div class="receipt-row"><span>Delivery</span><span>${t.delivery ? money(t.delivery) : 'Free'}</span></div>
      <div class="receipt-row total"><span>Total</span><span>${money(t.total)}</span></div>
      <div class="receipt-delivery">
        📦 Estimated Delivery<br>
        <strong>${deliveryDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</strong>
      </div>
      <div class="receipt-address">
        <strong>Delivering to:</strong><br>
        ${esc(a.fullname)}<br>
        ${esc(a.addr1)}${a.addr2 ? ', ' + esc(a.addr2) : ''}<br>
        ${esc(a.city)}, ${esc(a.state)} – ${esc(a.pincode)}<br>
        📞 ${esc(a.phone)}
      </div>
      <div class="receipt-row"><span>Payment</span><strong>${getPaymentLabel(ckData.payment)}</strong></div>`;

    // Clear cart and close checkout
    cart = {}; saveCart(); renderCart(); renderOrderHistory();
    $("#checkoutDlg").close();
    $("#successDlg").showModal();
  }

  /* ---------- Events ---------- */
  document.addEventListener("click", e => {
    const t = e.target;
    const chip = t.closest("[data-cat]");
    if (chip) { category = chip.dataset.cat; renderChips(); renderGrid(); return; }
    const add = t.closest("[data-add]"); if (add) return addToCart(+add.dataset.add);
    const inc = t.closest("[data-inc]"); if (inc) return changeQty(+inc.dataset.inc, 1);
    const dec = t.closest("[data-dec]"); if (dec) return changeQty(+dec.dataset.dec, -1);
    const rm = t.closest("[data-rm]"); if (rm) { delete cart[rm.dataset.rm]; saveCart(); return renderCart(); }
    if (t.closest("[data-close]")) closeCart();
    if (t.closest("[data-rx-clear]")) {
      rx = null; try { localStorage.removeItem("mc_rx"); } catch {}
      renderRxStatus(); renderCart(); toast("Prescription removed");
    }
    if (t.id === "approveRx") { setRxStatus("verified"); toast("Prescription approved"); }
    if (t.id === "rejectRx") {
      const reason = prompt("Reason for rejection?", "Doctor registration number could not be verified");
      if (reason !== null) setRxStatus("rejected", reason.trim());
    }

    // Checkout step navigation
    const next = t.closest("[data-ck-next]");
    if (next) {
      const toStep = +next.dataset.ckNext;
      // Validate before advancing
      if (toStep === 3) {
        const err = validateAddress();
        if (err) { $("#addrError").textContent = err; return; }
        $("#addrError").textContent = "";
      }
      if (toStep === 4) {
        const selected = document.querySelector('input[name="payMethod"]:checked');
        ckData.payment = selected ? selected.value : "cod";
      }
      goToStep(toStep);
      return;
    }
    const prev = t.closest("[data-ck-prev]");
    if (prev) { goToStep(+prev.dataset.ckPrev); return; }

    // Payment option selection
    const payOption = t.closest(".pay-option");
    if (payOption) {
      $$(".pay-option").forEach(o => o.classList.remove("selected"));
      payOption.classList.add("selected");
      const radio = payOption.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      const val = radio ? radio.value : "";
      // Show/hide payment detail panels
      const upiPanel = $("#upiPanel"), cardPanel = $("#cardPanel");
      if (upiPanel) upiPanel.hidden = val !== "upi";
      if (cardPanel) cardPanel.hidden = val !== "card";
    }
  });

  // Agree checkbox toggles Place Order button
  const agreeBox = $("#ckAgree");
  if (agreeBox) agreeBox.addEventListener("change", () => {
    const btn = $("#placeOrderBtn");
    if (btn) btn.disabled = !agreeBox.checked;
  });

  // Place order button
  const placeBtn = $("#placeOrderBtn");
  if (placeBtn) placeBtn.addEventListener("click", placeOrder);

  // Print receipt
  const printBtn = $("#printOrder");
  if (printBtn) printBtn.addEventListener("click", () => window.print());

  $("#searchInput").addEventListener("input", e => { query = e.target.value; renderGrid(); if (query) $("#shop").scrollIntoView({ behavior: "smooth" }); });
  $("#cartBtn").addEventListener("click", openCart);
  $("#closeCart").addEventListener("click", closeCart);
  $("#overlay").addEventListener("click", closeCart);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeCart(); });
  $("#checkoutBtn").addEventListener("click", openCheckout);
  $("#cancelCheckout").addEventListener("click", () => $("#checkoutDlg").close());
  $("#closeSuccess").addEventListener("click", () => $("#successDlg").close());
  $("#rxForm").addEventListener("submit", submitRx);
  $("#rxStatusBtn").addEventListener("click", () => $("#prescription").scrollIntoView({ behavior: "smooth" }));

  // Pharmacist panel
  const pd = $("#pharmaDlg");
  $("#pharmaBtn").addEventListener("click", () => {
    $("#pharmaLogin").hidden = false; $("#pharmaBody").hidden = true;
    $("#pharmaPass").value = ""; $("#pharmaErr").textContent = "";
    pd.showModal();
  });
  $("#pharmaEnter").addEventListener("click", () => {
    if ($("#pharmaPass").value === PHARMA_PASSWORD) {
      $("#pharmaLogin").hidden = true; $("#pharmaBody").hidden = false; renderPharma();
    } else $("#pharmaErr").textContent = "Incorrect password.";
  });
  $("#pharmaPass").addEventListener("keydown", e => { if (e.key === "Enter") $("#pharmaEnter").click(); });
  $("#pharmaClose1").addEventListener("click", () => pd.close());
  $("#pharmaClose2").addEventListener("click", () => pd.close());

  // Max date for prescription = today
  const dateInput = $('#rxForm [name="date"]');
  dateInput.max = new Date().toISOString().slice(0, 10);

  /* ---------- Init ---------- */
  // drop cart lines for products that no longer exist
  Object.keys(cart).forEach(id => { if (!byId(+id)) delete cart[id]; });
  renderChips(); renderGrid(); renderRxMeds(); renderRxStatus(); renderCart(); renderOrderHistory();
})();
