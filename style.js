
// SAMPLE DATA

let products = JSON.parse(localStorage.getItem("stockSystem")) || [
 {name:"Laptop",category:"Electronics",qty:5,price:45000,min:10,sales:3},
 {name:"Mouse",category:"Accessories",qty:35,price:500,min:10,sales:2},
 {name:"Keyboard",category:"Accessories",qty:4,price:1000,min:8,sales:2},
 {name:"Monitor",category:"Electronics",qty:20,price:12000,min:5,sales:1},
 {name:"Printer",category:"Electronics",qty:8,price:8000,min:10,sales:1},
 {name:"Notebook",category:"Stationery",qty:100,price:50,min:20,sales:5}
];

let charts = {};

const money = n => "₹" + n.toLocaleString("en-IN");

function escapeHTML(v) {
 return String(v).replace(/[&<>"']/g,c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",
  '"':"&quot;","'":"&#39;"
 })[c]);
}

function save() {
 localStorage.setItem("stockSystem",JSON.stringify(products));
}

// NAVIGATION

function openPage(id,button) {
 document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
 document.getElementById(id).classList.add("active");

 document.querySelectorAll(".menu button").forEach(b=>b.classList.remove("active"));
 button.classList.add("active");

 const titles = {
  dashboard:"Dashboard Overview",
  inventory:"Inventory Management",
  analytics:"Data Analytics",
  forecast:"Demand Forecasting",
  decision:"Decision Support System",
  simulation:"Stock Simulation",
  reports:"Inventory Reports"
 };

 document.getElementById("pageTitle").innerText = titles[id];
 refresh();
}

// INVENTORY

function addProduct() {
 let name = document.getElementById("name").value.trim();
 let category = document.getElementById("category").value.trim();

 let fields = ["qty","price","minimum","sales"];

 if(!name || !category || fields.some(id=>document.getElementById(id).value==="")) {
  alert("Please complete all product details.");
  return;
 }

 let [qty,price,min,sales] = fields.map(id=>Number(document.getElementById(id).value));

 if(![qty,price,min,sales].every(Number.isFinite) ||
 !Number.isInteger(qty) || !Number.isInteger(min) ||
 !Number.isInteger(sales) || [qty,price,min,sales].some(v=>v<0)) {
  alert("Enter valid non-negative numbers.");
  return;
 }

 products.push({name,category,qty,price,min,sales});
 save();

 document.querySelectorAll("#inventory input").forEach(i=>i.value="");
 refresh();
}

function updateProduct(i) {
 let q = prompt("Enter updated stock quantity:",products[i].qty);
 if(q===null) return;

 if(q.trim()==="" || !Number.isInteger(Number(q)) || Number(q)<0) {
  alert("Enter a valid quantity.");
  return;
 }

 products[i].qty = Number(q);
 save();
 refresh();
}

function deleteProduct(i) {
 if(confirm("Delete this product?")) {
  products.splice(i,1);
  save();
  refresh();
 }
}

function renderInventory() {
 let search = document.getElementById("search").value.toLowerCase();

 document.getElementById("inventoryList").innerHTML =
 products.map((p,i)=>({...p,i}))
 .filter(p=>(p.name+" "+p.category).toLowerCase().includes(search))
 .map(p=>`
  <tr>
   <td>${escapeHTML(p.name)}</td>
   <td>${escapeHTML(p.category)}</td>
   <td>${p.qty}</td>
   <td>${money(p.price)}</td>
   <td class="status ${p.qty<=p.min?"low":"normal"}">
    ${p.qty<=p.min?"Low Stock":"Available"}
   </td>
   <td>
    <button class="btn" onclick="updateProduct(${p.i})">Update</button>
    <button class="btn delete" onclick="deleteProduct(${p.i})">Delete</button>
   </td>
  </tr>
 `).join("");
}

// DASHBOARD

function simulate() {
 let i = Number(document.getElementById("simProduct").value);
 let change = Number(document.getElementById("change").value);
 let delay = Number(document.getElementById("delaySlider") ? document.getElementById("delaySlider").value : 0);

 let p = products[i];
 let demand = p.sales*(1+change/100);
 let days = demand>0 ? (p.qty/demand).toFixed(1) : "Unlimited";
 let isCritical = (demand > 0 && p.qty/demand < (7 + delay));

 document.getElementById("simResult").innerHTML = `
  <b>Simulation Stress Test Results</b><br>
  Product: <b>${escapeHTML(p.name)}</b><br>
  Simulated Daily Demand: ${demand.toFixed(2)} units/day<br>
  Supply Chain Delay Factor: ${delay} Days<br>
  Estimated Stock Depletion: <b>${days} days</b><br><br>
  <span style="color: ${isCritical ? 'var(--red)' : 'var(--green)'}; font-weight: bold;">
   Recommendation: ${isCritical ? 
   "⚠️ Critical Risk! Immediate purchase order or shipping expedition required due to combined demand surge and delivery lag." : 
   "✅ Safe Buffer. Current stock levels can comfortably handle these conditions."}
  </span>
 `;
}

// CHARTS

function drawChart(id,type,labels,data,label) {
 if(charts[id]) charts[id].destroy();

 charts[id] = new Chart(document.getElementById(id),{
  type,
  data:{
   labels,
   datasets:[{
    label,
    data,
    backgroundColor:[
     "#2563eb","#16a34a","#f97316",
     "#8b5cf6","#06b6d4","#ec4899"
    ],
    borderWidth:1
   }]
  },
  options:{responsive:true,maintainAspectRatio:true}
 });
}

function analytics() {
 let categories = {};

 products.forEach(p=>{
  categories[p.category] = (categories[p.category]||0)+p.qty;
 });

 drawChart("stockChart","bar",products.map(p=>p.name),products.map(p=>p.qty),"Stock Units");

 drawChart("categoryChart","doughnut",Object.keys(categories),Object.values(categories),"Category Stock");

 drawChart("valueChart","bar",products.map(p=>p.name),products.map(p=>p.qty*p.price),"Stock Value");

 let value = products.reduce((s,p)=>s+p.qty*p.price,0);

 document.getElementById("performance").innerHTML = `
  <div class="result">
   Total Inventory Value: ${money(value)}<br>
   Total Products: ${products.length}<br>
   Total Stock Units: ${products.reduce((s,p)=>s+p.qty,0)}<br>
   Low Stock Products: ${products.filter(p=>p.qty<=p.min).length}
  </div>`;
}

// FORECASTING

function forecasting() {
 document.getElementById("forecastList").innerHTML =
 products.map(p => {
  let days = p.sales > 0 ? (p.qty / p.sales).toFixed(1) : 999;
  let numericDays = Number(days);
  
  // Determine health status and progress bar color
  let statusText = numericDays < 3 ? "🔴 Critical Outage Risk (< 3 Days)" : numericDays < 10 ? "🟠 Moderate Run-rate" : "🟢 Stable Runway";
  let barColor = numericDays < 3 ? "var(--red)" : numericDays < 10 ? "var(--orange)" : "var(--green)";
  let progressWidth = Math.min(100, (numericDays / 30) * 100); // normalized against a 30-day window

  return `
   <div class="result" style="border-left: 5px solid ${barColor}; margin-bottom: 15px; background: white; padding: 18px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
     <b style="font-size: 16px; color: var(--dark);">${escapeHTML(p.name)}</b>
     <span style="font-size: 12px; font-weight: bold; color: ${barColor};">${statusText}</span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; font-size: 13px; color: var(--muted); margin-bottom: 12px;">
     <div>Current Stock: <b>${p.qty} units</b></div>
     <div>Daily Consumption: <b>${p.sales} units/day</b></div>
     <div>Estimated Runway: <b style="color: var(--text);">${numericDays === 999 ? 'Unlimited' : numericDays + ' Days'}</b></div>
    </div>
    <!-- Visual Runway Progress Bar -->
    <div style="width: 100%; background: #e2e8f0; height: 8px; border-radius: 4px; overflow: hidden;">
     <div style="width: ${progressWidth}%; background: ${barColor}; height: 100%; transition: width 0.4s ease;"></div>
    </div>
   </div>`;
 }).join("");
}
// ADVANCED DECISION SUPPORT SYSTEM
function decisions() {
 let output = "";

 products.forEach(p => {
  let reorder = Math.max(0, (p.min * 2) - p.qty);
  let daysInStock = p.sales > 0 ? Math.round(p.qty / (p.sales * 0.2)) : 45; 
  let carbonWaste = (p.qty * 0.15 * (daysInStock / 10)).toFixed(1);

  if (p.qty <= p.min) {
   output += `
    <div style="background: white; border-left: 5px solid var(--red); padding: 20px; border-radius: 10px; margin-bottom: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
     <div style="flex: 1; min-width: 250px;">
      <span style="background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">CRITICAL RESTOCK ACTION</span>
      <h4 style="margin: 8px 0; color: var(--dark); font-size: 17px;">${escapeHTML(p.name)}</h4>
      <p style="font-size: 13px; color: var(--muted); line-height: 1.6;">
       Current Stock: <b>${p.qty}</b> | Minimum Threshold: <b>${p.min}</b><br>
       Suggested Purchase Order: <b style="color: var(--red);">${reorder} units</b> (Reason: Stock below minimum level).
      </p>
     </div>
     <div>
      <button class="btn success" onclick="alert('✅ Purchase Order successfully approved and transmitted to supplier network!')">
       ⚡ Approve & Dispatch PO
      </button>
     </div>
    </div>`;
  } else if (p.qty > p.min * 3 && p.min > 0) {
   output += `
    <div style="background: white; border-left: 5px solid var(--orange); padding: 20px; border-radius: 10px; margin-bottom: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
     <div style="flex: 1; min-width: 250px;">
      <span style="background: #ffedd5; color: #9a3412; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">OVERSTOCK & CARBON RISK</span>
      <h4 style="margin: 8px 0; color: var(--dark); font-size: 17px;">${escapeHTML(p.name)}</h4>
      <p style="font-size: 13px; color: var(--muted); line-height: 1.6;">
       Available: <b>${p.qty} units</b> (Exceeds 3x minimum threshold).<br>
       Warehousing Carbon Overhead: <b style="color: var(--orange);">${carbonWaste} kg CO2e</b>
      </p>
     </div>
     <div>
      <button class="btn" style="background: var(--orange);" onclick="alert('🏷️ Flash clearance campaign initiated! 15% discount broadcasted to online channels.')">
       🌱 Trigger Eco-Liquidation
      </button>
     </div>
    </div>`;
  }
 });

 const decisionContainer = document.getElementById("decisionList");
 if(decisionContainer) {
  decisionContainer.innerHTML = output || "<p style='padding: 15px; background: white; border-radius: 8px;'>✅ All inventory items are balanced. No purchasing or liquidation interventions required.</p>";
 }

 // Optional Overstock list cleanup or sync
 let over = products.filter(p => p.min > 0 && p.qty > p.min * 3);
 const overstockContainer = document.getElementById("overstockList");
 if(overstockContainer) {
  overstockContainer.innerHTML = over.length ? 
   `<p style="font-size: 13px; color: var(--muted);">Detected ${over.length} overstocked asset(s) contributing to high carrying costs and carbon footprint.</p>` : 
   "<p>No overstock hazards detected.</p>";
 }
}



 

// SIMULATION

function simulate() {
 let i = Number(document.getElementById("simProduct").value);
 let change = Number(document.getElementById("change").value);

 if(!products[i] || !Number.isFinite(change) || change < -100) {
  alert("Enter a valid simulation value.");
  return;
 }

 let p = products[i];
 let demand = p.sales*(1+change/100);
 let days = demand>0 ? (p.qty/demand).toFixed(1) : "Unlimited";

 document.getElementById("simResult").innerHTML = `
  <b>Simulation Result</b><br>
  Product: ${escapeHTML(p.name)}<br>
  Original Daily Demand: ${p.sales}<br>
  Changed Daily Demand: ${demand.toFixed(2)}<br>
  Estimated Stock Duration: ${days} days<br>
  Recommendation: ${demand>0 && p.qty/demand<7 ?
  "Consider preparing a restocking plan." :
  "Current stock may be sufficient for the estimated period."}
 `;
}function updateDashboard() {// PRO-LEVEL DASHBOARD & MULTI-SUPPLIER PROCUREMENT COPILOT
function updateDashboard() {
 let units = products.reduce((s,p)=>s+p.qty,0);
 let value = products.reduce((s,p)=>s+p.qty*p.price,0);
 let low = products.filter(p=>p.qty<=p.min).length;
 let health = products.length ?
 Math.round(products.filter(p=>p.qty>p.min).length/products.length*100) : 0;

 document.getElementById("total").innerText = products.length;
 document.getElementById("units").innerText = units;
 document.getElementById("low").innerText = low;
 document.getElementById("value").innerText = money(value);
 document.getElementById("health").innerText = health+"%";

 let alerts = products.filter(p=>p.qty<=p.min);

 // Pro Multi-Supplier Mock Database
 const mockSuppliers = [
  { name: "Global Tech Supplies", costMultiplier: 1.0, deliveryDays: 2, rating: "4.8/5" },
  { name: "Express Logistics Corp", costMultiplier: 1.15, deliveryDays: 1, rating: "4.9/5" },
  { name: "Budget Wholesale India", costMultiplier: 0.9, deliveryDays: 5, rating: "4.2/5" }
 ];

 document.getElementById("dashboardAlerts").innerHTML =
 alerts.length ?
 alerts.map(p => {
  let deficit = (p.min * 2) - p.qty;
  let bestSupplier = mockSuppliers.reduce((prev, curr) => 
   (prev.costMultiplier * prev.deliveryDays < curr.costMultiplier * curr.deliveryDays) ? prev : curr
  );
  let estimatedCost = Math.round(deficit * p.price * bestSupplier.costMultiplier);

  return `
  <div class="supplier-modal-card">
   <div style="display:flex; justify-content:space-between; align-items:flex-start;">
    <div>
     <span class="badge-pro">AI PROCUREMENT COPILOT</span>
     <h4 style="margin:6px 0; color:var(--dark);">${escapeHTML(p.name)} - Stock Critical</h4>
     <p style="font-size:13px; color:var(--muted);">
      Available: <b>${p.qty}</b> | Minimum Threshold: <b>${p.min}</b> | Recommended Restock: <b>${deficit} units</b>
     </p>
     <p style="font-size:13px; margin-top:5px; color:var(--text);">
      💡 <b>Optimal Supplier Match:</b> ${bestSupplier.name} (${bestSupplier.deliveryDays} Days delivery, Est. Cost: ${money(estimatedCost)})
     </p>
    </div>
    <button class="btn success" onclick="executeSmartPO('${escapeHTML(p.name)}', ${deficit}, '${bestSupplier.name}', ${estimatedCost})">
     ⚡ Execute Smart PO
    </button>
   </div>
  </div>`;
 }).join("") : "<p>All products are safely above minimum inventory stock thresholds.</p>";
}

// Pro Action Execution Trigger
function executeSmartPO(productName, qty, supplierName, cost) {
 alert(`🚀 [Autonomous API Trigger]\n\nPurchase Order Successfully Processed!\nProduct: ${productName} (${qty} units)\nAssigned Vendor: ${supplierName}\nTotal Allocation Value: ${money(cost)}\n\nStatus: Electronic Data Interchange (EDI) transmission sent to supplier successfully.`);
}}

// REPORTS

function reports() {
 let total = products.reduce((s,p)=>s+p.qty*p.price,0);

 document.getElementById("report").innerHTML = `
  Total Products: ${products.length}<br><br>
  Total Stock Units: ${products.reduce((s,p)=>s+p.qty,0)}<br><br>
  Low Stock: ${products.filter(p=>p.qty<=p.min).length}<br><br>
  Inventory Value: ${money(total)}
 `;
}

function downloadCSV() {
 let rows = [
  ["Product","Category","Quantity","Price","Minimum Stock","Daily Demand"],
  ...products.map(p=>[p.name,p.category,p.qty,p.price,p.min,p.sales])
 ];

 let csv = rows.map(row=>row.map(v=>
  '"'+String(v).replace(/"/g,'""')+'"'
 ).join(",")).join("\n");

 let blob = new Blob([csv],{type:"text/csv;charset=utf-8"});
 let url = URL.createObjectURL(blob);
 let a = document.createElement("a");

 a.href = url;
 a.download = "Smart_Stock_Report.csv";
 a.click();

 URL.revokeObjectURL(url);
}

// REFRESH

function refresh() {
 renderInventory();
 updateDashboard();
 forecasting();
 decisions();
 reports();

 document.getElementById("simProduct").innerHTML =
 products.map((p,i)=>
  `<option value="${i}">${escapeHTML(p.name)}</option>`
 ).join("");

 analytics();
}

refresh();
function refresh() {
 renderInventory();
 updateDashboard();
 forecasting();
 decisions();
 renderGreenLiquidationEngine(); // <-- ADD THIS LINE HERE
 reports();

 document.getElementById("simProduct").innerHTML =
 products.map((p,i)=>
  `<option value="${i}">${escapeHTML(p.name)}</option>`
 ).join("");

 analytics();
}
renderGreenLiquidationEngine();
function refresh() {
 renderInventory();
 updateDashboard();
 forecasting();
 decisions();
 renderGreenLiquidationEngine(); // <-- ADD THIS LINE
 reports();

 document.getElementById("simProduct").innerHTML =
 products.map((p,i)=>
  `<option value="${i}">${escapeHTML(p.name)}</option>`
 ).join("");

 analytics();
}
// UNIQUE PRO FEATURE: Eco-Aging & Dead-Stock Liquidation Engine
function renderGreenLiquidationEngine() {
 let output = "";

 products.forEach(p => {
  // Simulate aging days based on stock quantity vs sales rate
  let daysInStock = p.sales > 0 ? Math.round(p.qty / (p.sales * 0.2)) : 45; 
  let riskLevel = daysInStock > 60 ? "HIGH RISK (Dead Stock)" : daysInStock > 30 ? "Moderate Aging" : "Fresh Stock";
  let riskColor = daysInStock > 60 ? "var(--red)" : daysInStock > 30 ? "var(--orange)" : "var(--green)";
  
  // Calculate carbon footprint waste index (simulated kg CO2 per unused item per day)
  let carbonWaste = (p.qty * 0.15 * (daysInStock / 10)).toFixed(1);

  if (daysInStock > 30) {
   output += `
   <div class="result" style="border-left: 4px solid ${riskColor}; margin-bottom: 12px;">
    <b>🌱 Eco-Liquidation Alert: ${escapeHTML(p.name)}</b><br>
    Estimated Shelf Aging: <b>${daysInStock} Days</b> | Status: <span style="color:${riskColor}; font-weight:bold;">${riskLevel}</span><br>
    Warehousing Carbon Waste Index: <b>${carbonWaste} kg CO2e</b><br>
    ⚡ <b>Autonomous Recommendation:</b> Trigger a <span style="color:var(--primary); font-weight:bold;">15% Flash Clearance Discount</span> to liquidate excess stock, reduce holding costs, and lower warehouse carbon overhead.
   </div>`;
  }
 });

 const container = document.getElementById("decisionList");
 if(container) {
  container.innerHTML = output || "<p>✅ All inventory items are fresh with optimal turnover rates. Zero dead-stock or carbon waste risks detected.</p>";
 }
}
// UNIQUE PRO FEATURE: Eco-Aging & Carbon-Aware Liquidation Engine
function renderGreenLiquidationEngine() {
 let output = "";

 products.forEach(p => {
  // Simulate aging days based on stock quantity vs sales rate
  let daysInStock = p.sales > 0 ? Math.round(p.qty / (p.sales * 0.2)) : 45; 
  let riskLevel = daysInStock > 60 ? "HIGH RISK (Dead Stock)" : daysInStock > 30 ? "Moderate Aging" : "Fresh Stock";
  let riskColor = daysInStock > 60 ? "var(--red)" : daysInStock > 30 ? "var(--orange)" : "var(--green)";
  
  // Calculate carbon footprint waste index (simulated kg CO2 per unused item per day)
  let carbonWaste = (p.qty * 0.15 * (daysInStock / 10)).toFixed(1);

  if (daysInStock > 30) {
   output += `
   <div class="result" style="border-left: 4px solid ${riskColor}; margin-bottom: 12px;">
    <b>🌱 Eco-Liquidation Alert: ${escapeHTML(p.name)}</b><br>
    Estimated Shelf Aging: <b>${daysInStock} Days</b> | Status: <span style="color:${riskColor}; font-weight:bold;">${riskLevel}</span><br>
    Warehousing Carbon Waste Index: <b>${carbonWaste} kg CO2e</b><br>
    ⚡ <b>Autonomous Recommendation:</b> Trigger a <span style="color:var(--primary); font-weight:bold;">15% Flash Clearance Discount</span> to liquidate excess stock, reduce holding costs, and lower warehouse carbon overhead.
   </div>`;
  }
 });

 const container = document.getElementById("decisionList");
 if(container) {
  container.innerHTML = output || "<p>✅ All inventory items are fresh with optimal turnover rates. Zero dead-stock or carbon waste risks detected.</p>";
 }
}
function askCopilot(question) {
  document.getElementById("copilotQuestion").value = question;
  answerCopilot(question);
}

function submitCopilot(event) {
  event.preventDefault();
  answerCopilot(document.getElementById("copilotQuestion").value);
}

function answerCopilot(raw) {
  const q = String(raw || "").trim().toLowerCase();
  const box = document.getElementById("copilotAnswer");

  if (!q) {
    box.textContent = "Please type a question first.";
    return;
  }

  const low = products.filter(p => p.qty <= p.min);
  const totalValue = products.reduce((sum, p) => sum + p.qty * p.price, 0);
  const totalUnits = products.reduce((sum, p) => sum + p.qty, 0);

  if (q.includes("reorder") || q.includes("low stock")) {
    box.textContent = low.length
      ? low.map(p => `${p.name}: ${p.qty} available; minimum ${p.min}`).join("\n")
      : "No products currently need reordering.";
  } else if (q.includes("value") || q.includes("valuable")) {
    const sorted = [...products].sort(
      (a, b) => b.qty * b.price - a.qty * a.price
    );
    box.textContent = "Highest-value products:\n" +
      sorted.slice(0, 5).map(p =>
        `${p.name}: ₹${(p.qty * p.price).toFixed(2)}`
      ).join("\n");
  } else if (q.includes("summary") || q.includes("health")) {
    box.textContent =
      `Products: ${products.length}\n` +
      `Total units: ${totalUnits}\n` +
      `Total inventory value: ₹${totalValue.toFixed(2)}\n` +
      `Low-stock products: ${low.length}`;
  } else {
    const product = products.find(p => q.includes(p.name.toLowerCase()));

    box.textContent = product
      ? `${product.name}\nQuantity: ${product.qty}\nPrice: ₹${product.price}\nStock value: ₹${product.qty * product.price}\nMinimum stock: ${product.min}`
      : "Try asking about low stock, reorder, product value or stock summary.";
  }
}
function fillQRProducts() {
  const select = document.getElementById("qrProduct");

  select.innerHTML = products.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join("");

  if (products.length) generateProductQR();
}

function generateProductQR() {
  const id = document.getElementById("qrProduct").value;
  const p = products.find(x => String(x.id) === id);

  if (!p) return;

  const passport = {
    productName: p.name,
    category: p.category,
    quantity: p.qty,
    price: p.price,
    minimumStock: p.min,
    dailyDemand: p.sales
  };

  document.getElementById("qrProductDetails").innerHTML =
    `<h3>${p.name}</h3>
     <p>Quantity: ${p.qty}</p>
     <p>Price: ₹${p.price}</p>
     <p>Category: ${p.category}</p>`;

  const target = document.getElementById("productQRCode");
  target.innerHTML = "";

  if (window.QRCode) {
    new QRCode(target, {
      text: JSON.stringify(passport),
      width: 190,
      height: 190
    });
  } else {
    target.textContent = "QR library needs an internet connection.";
  }
}

function downloadProductQR() {
  const target = document.getElementById("productQRCode");
  const image = target.querySelector("img");
  const canvas = target.querySelector("canvas");

  const url = image ? image.src :
    (canvas ? canvas.toDataURL("image/png") : null);

  if (!url) {
    alert("Generate a QR code first.");
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = "stockwise-product-QR.png";
  link.click();
}
function fillSimulation() {
  const select = document.getElementById("simProduct");

  select.innerHTML = products.map(p =>
    `<option value="${p.id}">${p.name}</option>`
  ).join("");
}

function simulate() {
  const id = document.getElementById("simProduct").value;
  const p = products.find(x => String(x.id) === id);

  const change = Number(
    document.getElementById("demandChange").value
  ) || 0;

  const dailyDemand = Number(
    document.getElementById("simDaily").value
  ) || 0;

  const result = document.getElementById("simulationResult");

  if (!p) {
    result.textContent = "Please add a product first.";
    return;
  }

  const newDemand = dailyDemand * (1 + change / 100);
  const days = newDemand > 0 ? p.qty / newDemand : Infinity;

  let recommendation;

  if (days < 7) {
    recommendation = "Plan replenishment soon.";
  } else if (days < 20) {
    recommendation = "Monitor stock levels.";
  } else {
    recommendation = "Current stock coverage appears sufficient.";
  }

  result.innerHTML =
    `<h3>${p.name}</h3>
     <p>Current stock: ${p.qty} units</p>
     <p>Demand change: ${change}%</p>
     <p>New estimated demand: ${newDemand.toFixed(2)} units/day</p>
     <p>Estimated stock coverage: ${Number.isFinite(days)
       ? days.toFixed(1) + " days"
       : "No demand entered"}</p>
     <b>Recommendation: ${recommendation}</b>`;
}
function renderRescue() {
  const cards = [];

  products.forEach(p => {
    const daysLeft = p.expiryDate
      ? Math.ceil(
          (new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
        )
      : null;

    // Check expiry risk
    if (daysLeft !== null && daysLeft < 0) {
      cards.push(`
        <div class="panel">
          <h3>${p.name}</h3>
          <b>High Priority: Expired product</b>
          <p>Expiry date has passed.</p>
          <p>Action: Review the batch and follow your organisation's handling policy.</p>
        </div>
      `);
    } else if (daysLeft !== null && daysLeft <= 30) {
      cards.push(`
        <div class="panel">
          <h3>${p.name}</h3>
          <b>High Priority: Expiry approaching</b>
          <p>${daysLeft} days remaining.</p>
          <p>Action: Review stock rotation and demand.</p>
        </div>
      `);
    }

    // Check low stock
    if (p.qty <= p.min) {
      cards.push(`
        <div class="panel">
          <h3>${p.name}</h3>
          <b>Medium Priority: Low stock</b>
          <p>Available: ${p.qty} units</p>
          <p>Minimum required: ${p.min} units</p>
          <p>Action: Review the reorder recommendation.</p>
        </div>
      `);
    }

    // Check slow-moving stock
    if (p.sales > 0 && p.qty / p.sales > 90) {
      cards.push(`
        <div class="panel">
          <h3>${p.name}</h3>
          <b>Low Priority: Slow-moving stock</b>
          <p>Estimated stock coverage: ${(p.qty / p.sales).toFixed(0)} days</p>
          <p>Action: Review future purchasing requirements.</p>
        </div>
      `);
    }
  });

  document.getElementById("rescueCards").innerHTML =
    cards.length
      ? cards.join("")
      : "<p>No rescue actions detected.</p>";
}
function generateManagementReport() {
  const totalUnits = products.reduce(
    (sum, p) => sum + p.qty, 0
  );

  const totalValue = products.reduce(
    (sum, p) => sum + p.qty * p.price, 0
  );

  const lowStock = products.filter(
    p => p.qty <= p.min
  );

  const rows = products.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>${p.qty}</td>
      <td>₹${p.price}</td>
      <td>₹${p.qty * p.price}</td>
      <td>${p.qty <= p.min ? "Low Stock" : "In Stock"}</td>
    </tr>
  `).join("");

  const reportWindow = window.open("", "_blank");

  if (!reportWindow) {
    alert("Please allow pop-ups to generate the report.");
    return;
  }

  reportWindow.document.write(`
    <html>
    <head>
      <title>StockWise Management Report</title>
      <style>
        body {
          font-family: Arial;
          padding: 25px;
          color: #172033;
        }
        h1 {
          color: #2456c5;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #ccc;
          padding: 10px;
          text-align: left;
        }
        th {
          background: #eaf0ff;
        }
        button {
          padding: 10px 18px;
          background: #2456c5;
          color: white;
          border: none;
          cursor: pointer;
        }
        @media print {
          button { display: none; }
        }
      </style>
    </head>

    <body>
      <button onclick="window.print()">Print / Save as PDF</button>

      <h1>STOCKWISE</h1>
      <h2>Smart Stock Optimization System</h2>
      <p>Inventory Management Report</p>
      <p>Generated: ${new Date().toLocaleString()}</p>

      <h3>Inventory Summary</h3>
      <p>Total Products: ${products.length}</p>
      <p>Total Units: ${totalUnits}</p>
      <p>Total Inventory Value: ₹${totalValue.toFixed(2)}</p>
      <p>Low Stock Products: ${lowStock.length}</p>

      <h3>Product Details</h3>
      <table>
        <tr>
          <th>Product</th>
          <th>Category</th>
          <th>Quantity</th>
          <th>Price</th>
          <th>Stock Value</th>
          <th>Status</th>
        </tr>
        ${rows}
      </table>
    </body>
    </html>
  `);

  reportWindow.document.close();
  reportWindow.onload = () => reportWindow.print();
}