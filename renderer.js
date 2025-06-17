const { ipcRenderer } = require("electron");

// Variables globales
let produits = [];
let ventesData = [];
let allVentesData = [];
let chartInstance = null;
let stockData = [];
let cart = [];

// ==================== INITIALISATION ====================
document.addEventListener("DOMContentLoaded", async () => {
  await initializeApp();
});

async function initializeApp() {
  try {
    await loadProduits();
    await loadApprovisionnements();
    await loadVentes();
    await loadFactures(); // S'assurer que les factures sont chargées
    await loadStock();
    initDateDefaults();
    setupAllEventListeners();
    renderProductsForSale();
    console.log("Application initialisée avec succès");
  } catch (error) {
    console.error("Erreur lors de l'initialisation:", error);
  }
}

// ==================== GESTION DES ONGLETS ====================
function showTab(tabName) {
  // Masquer tous les onglets
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  // Afficher l'onglet sélectionné
  const targetTab = document.getElementById(tabName);
  if (targetTab) {
    targetTab.classList.add("active");
  }
  
  if (event && event.target) {
    event.target.classList.add("active");
  }

  // Actions spécifiques par onglet
  switch (tabName) {
    case "stock":
      loadStock();
      break;
    case "factures":
      console.log("Onglet factures activé, rechargement...");
      loadFactures();
      break;
    case "ventes":
      renderProductsForSale();
      break;
  }
}

// ==================== CONFIGURATION DES ÉVÉNEMENTS ====================
function setupAllEventListeners() {
  setupFormEventListeners();
  setupSalesEventListeners();
  setupModalEventListeners();
}

function setupFormEventListeners() {
  // Formulaire produits
  const formProduit = document.getElementById("form-produit");
  if (formProduit) {
    formProduit.addEventListener("submit", handleAddProduit);
  }

  // Formulaire approvisionnement
  const formApprovisionnement = document.getElementById("form-approvisionnement");
  if (formApprovisionnement) {
    formApprovisionnement.addEventListener("submit", handleAddApprovisionnement);
  }
}

function setupSalesEventListeners() {
  // Recherche de produits
  const productSearch = document.getElementById('product-search');
  if (productSearch) {
    productSearch.addEventListener('input', (e) => {
      renderProductsForSale(e.target.value);
    });
  }

  // Actions du panier
  const clearCartBtn = document.getElementById('clear-cart');
  const processSaleBtn = document.getElementById('process-sale');
  
  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', clearCart);
  }
  
  if (processSaleBtn) {
    processSaleBtn.addEventListener('click', processSale);
  }
}

function setupModalEventListeners() {
  // Gérer la fermeture de la modal de plusieurs façons
  document.addEventListener('click', (e) => {
    const modal = document.getElementById('invoice-modal');
    
    // Fermer en cliquant sur le X
    if (e.target.classList.contains('close')) {
      closeModal();
    }
    
    // Fermer en cliquant en dehors de la modal
    if (e.target === modal) {
      closeModal();
    }
  });

  // Fermer avec la touche Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });

  // Bouton d'impression
  document.addEventListener('click', (e) => {
    if (e.target.id === 'print-invoice') {
      printInvoice();
    }
  });
}

// ==================== GESTION DES DATES ====================
function initDateDefaults() {
  const today = new Date().toISOString().split("T")[0];
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString().split("T")[0];

  // Définir les dates avec vérification
  setValueSafely('input[name="date_appro"]', today);
  setValueSafely('date-debut-stats', firstDayOfMonth);
  setValueSafely('date-fin-stats', today);
  setValueSafely('date-debut-ventes', firstDayOfMonth);
  setValueSafely('date-fin-ventes', today);
}

function setValueSafely(selector, value) {
  const element = typeof selector === 'string' 
    ? document.getElementById(selector) || document.querySelector(selector)
    : selector;
  
  if (element) {
    element.value = value;
  }
}

// ==================== UTILITAIRES ====================
function showMessage(containerId, message, type = "success") {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = `<div class="${type}-message">${message}</div>`;
  setTimeout(() => {
    container.innerHTML = "";
  }, 3000);
}

function formatCFA(montant) {
  return new Intl.NumberFormat("fr-FR").format(montant) + " CFA";
}

function searchInTable(tableId, searchValue, columnIndexes) {
  const table = document.getElementById(tableId);
  if (!table) return;
  
  const rows = table.getElementsByTagName("tr");

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].getElementsByTagName("td");
    if (cells.length > 0) {
      let found = false;

      for (let colIndex of columnIndexes) {
        if (cells[colIndex]) {
          const cellText = cells[colIndex].textContent || cells[colIndex].innerText;
          if (cellText.toLowerCase().includes(searchValue.toLowerCase())) {
            found = true;
            break;
          }
        }
      }

      rows[i].style.display = found ? "" : "none";
    }
  }
}

// ==================== GESTION DES PRODUITS ====================
async function loadProduits() {
  try {
    produits = await ipcRenderer.invoke("get-produits");
    produits.sort((a, b) => a.nom.localeCompare(b.nom));
    displayProduits();
    updateProduitsSelects();
  } catch (error) {
    console.error("Erreur lors du chargement des produits:", error);
  }
}

function displayProduits() {
  const tbody = document.getElementById("produits-list");
  if (!tbody) return;

  if (produits.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Aucun produit enregistré</td></tr>';
    return;
  }

  tbody.innerHTML = produits
    .map((produit) => `
      <tr id="produit-${produit.id}">
        <td>${produit.reference}</td>
        <td>${produit.nom}</td>
        <td>${produit.categorie || "-"}</td>
        <td>${produit.prix_vente ? formatCFA(produit.prix_vente) : "-"}</td>
        <td>${produit.stock_minimum || "-"}</td>
        <td>
          <button class="btn btn-edit" onclick="editProduit(${produit.id})">
            ✏️ Modifier
          </button>
        </td>
      </tr>
    `)
    .join("");
}

function updateProduitsSelects() {
  const selectAppro = document.getElementById("select-produit-appro");
  if (!selectAppro) return;

  const sortedProduits = [...produits].sort((a, b) => a.nom.localeCompare(b.nom));
  const options = sortedProduits
    .map((produit) => `<option value="${produit.id}">${produit.nom} (${produit.reference})</option>`)
    .join("");

  selectAppro.innerHTML = '<option value="">Sélectionner un produit</option>' + options;
}

async function handleAddProduit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  try {
    const produit = {
      reference: formData.get("reference"),
      nom: formData.get("nom"),
      categorie: formData.get("categorie"),
      prix_vente: parseFloat(formData.get("prix_vente")),
      stock_minimum: parseInt(formData.get("stock_minimum")) || 0,
    };

    await ipcRenderer.invoke("add-produit", produit);
    showMessage("produit-message", "Produit ajouté avec succès !");
    e.target.reset();
    await loadProduits();
  } catch (error) {
    showMessage("produit-message", "Erreur lors de l'ajout du produit: " + error.message, "error");
  }
}

function editProduit(produitId) {
  const produit = produits.find((p) => p.id === produitId);
  if (!produit) return;

  const row = document.getElementById(`produit-${produitId}`);
  if (!row) return;

  row.innerHTML = `
    <td><input type="text" class="edit-input" value="${produit.reference}" id="edit-ref-${produitId}"></td>
    <td><input type="text" class="edit-input" value="${produit.nom}" id="edit-nom-${produitId}"></td>
    <td><input type="text" class="edit-input" value="${produit.categorie || ""}" id="edit-cat-${produitId}"></td>
    <td><input type="number" class="edit-input" value="${produit.prix_vente || ""}" step="1" id="edit-prix-${produitId}"></td>
    <td><input type="number" class="edit-input" value="${produit.stock_minimum || ""}" id="edit-stock-${produitId}"></td>
    <td>
      <button class="btn btn-success" onclick="saveProduit(${produitId})" style="margin-right: 5px; padding: 5px 10px; font-size: 12px;">💾 Sauver</button>
      <button class="btn btn-primary" onclick="cancelEdit(${produitId})" style="padding: 5px 10px; font-size: 12px;">❌ Annuler</button>
    </td>
  `;
}

async function saveProduit(produitId) {
  try {
    const produitModifie = {
      id: produitId,
      reference: document.getElementById(`edit-ref-${produitId}`).value,
      nom: document.getElementById(`edit-nom-${produitId}`).value,
      categorie: document.getElementById(`edit-cat-${produitId}`).value,
      prix_vente: parseFloat(document.getElementById(`edit-prix-${produitId}`).value) || 0,
      stock_minimum: parseInt(document.getElementById(`edit-stock-${produitId}`).value) || 0,
    };

    if (!produitModifie.reference || !produitModifie.nom) {
      alert("La référence et le nom sont obligatoires");
      return;
    }

    await ipcRenderer.invoke("update-produit", produitModifie);
    showMessage("produit-message", "Produit modifié avec succès !");
    await loadProduits();
  } catch (error) {
    showMessage("produit-message", "Erreur lors de la modification: " + error.message, "error");
  }
}

function cancelEdit(produitId) {
  loadProduits();
}

// ==================== GESTION DES APPROVISIONNEMENTS ====================
async function loadApprovisionnements() {
  try {
    const approvisionnements = await ipcRenderer.invoke("get-approvisionnements");
    displayApprovisionnements(approvisionnements);
  } catch (error) {
    console.error("Erreur lors du chargement des approvisionnements:", error);
  }
}

function displayApprovisionnements(approvisionnements) {
  const tbody = document.getElementById("approvisionnements-list");
  if (!tbody) return;

  if (approvisionnements.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">Aucun approvisionnement enregistré</td></tr>';
    return;
  }

  tbody.innerHTML = approvisionnements
    .map((appro) => `
      <tr>
        <td>${new Date(appro.date_appro).toLocaleDateString("fr-FR")}</td>
        <td>${appro.reference}</td>
        <td>${appro.nom}</td>
        <td>${appro.fournisseur || "-"}</td>
        <td>${appro.quantite}</td>
        <td>${appro.prix_achat ? formatCFA(appro.prix_achat) : "-"}</td>
        <td>${appro.prix_achat ? formatCFA(appro.quantite * appro.prix_achat) : "-"}</td>
      </tr>
    `)
    .join("");
}

async function handleAddApprovisionnement(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  try {
    const appro = {
      produit_id: parseInt(formData.get("produit_id")),
      fournisseur: formData.get("fournisseur"),
      quantite: parseInt(formData.get("quantite")),
      prix_achat: parseFloat(formData.get("prix_achat")) || 0,
      date_appro: formData.get("date_appro"),
    };

    await ipcRenderer.invoke("add-approvisionnement", appro);
    showMessage("appro-message", "Approvisionnement enregistré avec succès !");
    e.target.reset();
    setValueSafely('input[name="date_appro"]', new Date().toISOString().split("T")[0]);
    await loadApprovisionnements();
    await loadStock();
  } catch (error) {
    showMessage("appro-message", "Erreur lors de l'enregistrement: " + error.message, "error");
  }
}

// ==================== GESTION DU STOCK ====================
async function loadStock() {
  try {
    const stock = await ipcRenderer.invoke("get-stock");
    stockData = stock;
    displayStock(stock);
  } catch (error) {
    console.error("Erreur lors du chargement du stock:", error);
  }
}

function displayStock(stock) {
  const tbody = document.getElementById("stock-list");
  if (!tbody) return;

  if (stock.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">Aucun produit en stock</td></tr>';
    return;
  }

  tbody.innerHTML = stock
    .map((item) => {
      const valeurStock = item.stock_actuel * item.prix_vente;
      const statut = item.stock_actuel <= item.stock_minimum ? "CRITIQUE" : "OK";
      const statutClass = statut === "CRITIQUE" ? "status-critique" : "status-ok";

      return `
        <tr>
          <td>${item.reference}</td>
          <td>${item.nom}</td>
          <td>${item.stock_entre}</td>
          <td>${item.stock_vendu}</td>
          <td><strong>${item.stock_actuel}</strong></td>
          <td>${formatCFA(valeurStock)}</td>
          <td class="${statutClass}">${statut}</td>
        </tr>
      `;
    })
    .join("");
}

// ==================== GESTION DES VENTES ====================
async function loadVentes() {
  try {
    const ventes = await ipcRenderer.invoke("get-ventes");
    // Trier par date décroissante (plus récent en premier)
    // Utiliser created_at si disponible (plus précis), sinon date_vente
    allVentesData = ventes.sort((a, b) => {
      const dateA = new Date(a.created_at || a.date_vente);
      const dateB = new Date(b.created_at || b.date_vente);
      return dateB - dateA;
    });
    displayVentes(allVentesData);
  } catch (error) {
    console.error("Erreur lors du chargement des ventes:", error);
  }
}

function displayVentes(ventes) {
  ventesData = ventes;
  const tbody = document.getElementById("ventes-list");
  if (!tbody) return;

  if (ventes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9">Aucune vente enregistrée</td></tr>';
    return;
  }

  tbody.innerHTML = ventes
    .map((vente, index) => {
      const dateVente = new Date(vente.date_vente);
      const dateCreation = new Date(vente.created_at);
      
      // Utiliser created_at si disponible (plus précis avec l'heure), sinon date_vente
      const displayDate = vente.created_at ? dateCreation : dateVente;
      const formattedDateTime = `${displayDate.toLocaleDateString("fr-FR")} ${displayDate.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}`;
      
      return `
        <tr>
          <td>${formattedDateTime}</td>
          <td>${vente.facture_id || '-'}</td>
          <td>${vente.reference}</td>
          <td>${vente.nom}</td>
          <td>${vente.quantite}</td>
          <td>${formatCFA(vente.prix_unitaire)}</td>
          <td>${formatCFA(vente.total)}</td>
          <td>${vente.commentaire || "-"}</td>
          <td>
            ${vente.facture_id ? 
              `<button class="btn btn-print" onclick="printFactureDetail('${vente.facture_id}')">🖨️ Facture</button>` :
              `<button class="btn btn-print" onclick="printFactureIndividuelle(${index})">🖨️ Facture</button>`
            }
          </td>
        </tr>
      `;
    })
    .join("");
}

// ==================== SYSTÈME DE PANIER ====================
function renderProductsForSale(searchTerm = '') {
  const grid = document.getElementById('products-grid');
  if (!grid || !produits || !stockData) return;

  const productsWithStock = produits.map(product => {
    const stock = stockData.find(s => s.id === product.id);
    return {
      ...product,
      stock_actuel: stock ? stock.stock_actuel : 0
    };
  });

  const filteredProducts = productsWithStock.filter(product => 
    product.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filteredProducts.length === 0) {
    grid.innerHTML = '<div style="text-align: center; color: #6c757d; grid-column: 1/-1;">Aucun produit trouvé</div>';
    return;
  }

  grid.innerHTML = filteredProducts.map(product => `
    <div class="product-card" onclick="addToCart(${product.id})">
      <div class="product-ref">${product.reference}</div>
      <div class="product-name">${product.nom}</div>
      <div class="product-category">${product.categorie || '-'}</div>
      <div class="product-price">${formatCFA(product.prix_vente)}</div>
      <div class="product-stock">Stock: ${product.stock_actuel}</div>
      <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart(${product.id})" 
              ${product.stock_actuel <= 0 ? 'disabled' : ''}>
        ${product.stock_actuel <= 0 ? '❌ Rupture' : '➕ Ajouter'}
      </button>
    </div>
  `).join('');
}

function addToCart(productId) {
  const product = produits.find(p => p.id === productId);
  const stock = stockData.find(s => s.id === productId);
  
  if (!product || !stock) return;

  if (stock.stock_actuel <= 0) {
    showMessage('vente-message', 'Produit en rupture de stock', 'error');
    return;
  }

  const existingItem = cart.find(item => item.id === productId);
  if (existingItem) {
    if (existingItem.quantity < stock.stock_actuel) {
      existingItem.quantity++;
    } else {
      showMessage('vente-message', 'Quantité maximum atteinte pour ce produit', 'error');
      return;
    }
  } else {
    cart.push({
      id: productId,
      reference: product.reference,
      nom: product.nom,
      prix_unitaire: product.prix_vente,
      quantity: 1,
      stock_disponible: stock.stock_actuel
    });
  }

  renderCart();
  showMessage('vente-message', `${product.nom} ajouté au panier`, 'success');
}

function renderCart() {
  const cartContainer = document.getElementById('cart-items');
  const cartCount = document.getElementById('cart-count');
  const cartTotal = document.getElementById('cart-total');

  if (!cartContainer || !cartCount || !cartTotal) return;

  if (cart.length === 0) {
    cartContainer.innerHTML = '<div class="empty-cart">Aucun produit dans le panier<br>Sélectionnez des produits à gauche</div>';
    cartCount.textContent = '0 articles';
    cartTotal.textContent = '0 CFA';
    return;
  }

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.prix_unitaire), 0);

  cartCount.textContent = `${totalItems} article${totalItems > 1 ? 's' : ''}`;
  cartTotal.textContent = formatCFA(totalAmount);

  cartContainer.innerHTML = cart.map((item, index) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div style="font-weight: 600; margin-bottom: 3px;">${item.nom}</div>
        <div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;">${item.reference}</div>
        <div class="cart-item-controls">
          <label style="font-size: 11px;">Qté:</label>
          <input type="number" class="quantity-input" value="${item.quantity}" min="1" max="${item.stock_disponible}" onchange="updateQuantity(${index}, this.value)">
          <label style="font-size: 11px;">Prix:</label>
          <input type="number" class="price-input" value="${item.prix_unitaire}" onchange="updatePrice(${index}, this.value)">
          <button class="remove-btn" onclick="removeFromCart(${index})">❌</button>
        </div>
        <div style="margin-top: 5px; font-size: 12px; color: #28a745; font-weight: 600;">
          ${formatCFA(item.quantity * item.prix_unitaire)}
        </div>
      </div>
    </div>
  `).join('');
}

function updateQuantity(index, newQuantity) {
  const quantity = parseInt(newQuantity);
  if (quantity >= 1 && quantity <= cart[index].stock_disponible) {
    cart[index].quantity = quantity;
    renderCart();
  } else {
    showMessage('vente-message', 'Quantité invalide', 'error');
    renderCart();
  }
}

function updatePrice(index, newPrice) {
  const price = parseFloat(newPrice);
  if (price >= 0) {
    cart[index].prix_unitaire = price;
    renderCart();
  } else {
    showMessage('vente-message', 'Prix invalide', 'error');
    renderCart();
  }
}

function removeFromCart(index) {
  const item = cart[index];
  cart.splice(index, 1);
  renderCart();
  showMessage('vente-message', `${item.nom} retiré du panier`, 'success');
}

function clearCart() {
  if (cart.length === 0) return;
  
  if (confirm('Êtes-vous sûr de vouloir vider le panier ?')) {
    cart = [];
    renderCart();
    showMessage('vente-message', 'Panier vidé', 'success');
  }
}

async function processSale() {
  if (cart.length === 0) {
    showMessage('vente-message', 'Le panier est vide', 'error');
    return;
  }

  try {
    const commentaireInput = document.getElementById('batch-comment');
    const commentaire = commentaireInput ? commentaireInput.value : '';
    const dateVente = new Date().toISOString().split('T')[0];
    
    const venteData = {
      items: cart.map(item => ({
        produit_id: item.id,
        quantite: item.quantity,
        prix_unitaire: item.prix_unitaire
      })),
      commentaire,
      date_vente: dateVente
    };

    const result = await ipcRenderer.invoke("add-vente-lot", venteData);
    
    // Générer et afficher la facture
    generateInvoice(result.factureId, cart, result.totalFacture, commentaire);
    
    // Vider le panier et recharger les données
    cart = [];
    renderCart();
    if (commentaireInput) commentaireInput.value = '';
    await loadStock();
    await loadFactures();
    await loadVentes();
    renderProductsForSale();
    
    showMessage('vente-message', 'Vente enregistrée avec succès !', 'success');
  } catch (error) {
    showMessage('vente-message', 'Erreur lors de l\'enregistrement: ' + error.message, 'error');
  }
}

// ==================== GESTION DE LA MODAL ====================
function generateInvoice(factureId, items, totalAmount, commentaire) {
  const currentDate = new Date();

  const invoiceHTML = `
    <div class="invoice-header">
      <h2>🏪 Ada Global Service</h2>
      <p>Facture de vente</p>
      <div style="margin-top: 15px;">
        <strong>N° Facture:</strong> ${factureId}<br>
        <strong>Date:</strong> ${currentDate.toLocaleDateString('fr-FR')}<br>
        <strong>Heure:</strong> ${currentDate.toLocaleTimeString('fr-FR')}
      </div>
    </div>

    <div class="invoice-items">
      <h3>Détail des articles</h3>
      <table class="invoice-table">
        <thead>
          <tr>
            <th>Référence</th>
            <th>Produit</th>
            <th>Qté</th>
            <th>Prix unitaire</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>${item.reference}</td>
              <td>${item.nom}</td>
              <td>${item.quantity}</td>
              <td>${formatCFA(item.prix_unitaire)}</td>
              <td>${formatCFA(item.quantity * item.prix_unitaire)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${commentaire ? `
      <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <strong>Commentaire:</strong> ${commentaire}
      </div>
    ` : ''}

    <div class="invoice-total">
      <h3>TOTAL À PAYER: ${formatCFA(totalAmount)}</h3>
    </div>

    <div style="text-align: center; margin-top: 30px; border-top: 1px solid #dee2e6; padding-top: 20px;">
      <p>Merci pour votre confiance !</p>
      <p style="color: #6c757d; font-size: 14px;">Ada Global Service - ${currentDate.getFullYear()}</p>
    </div>
  `;

  const invoiceContent = document.getElementById('invoice-content');
  const modal = document.getElementById('invoice-modal');
  
  if (invoiceContent && modal) {
    invoiceContent.innerHTML = invoiceHTML;
    modal.style.display = 'block';
  }
}

function closeModal() {
  const modal = document.getElementById('invoice-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function printInvoice() {
  const invoiceContent = document.getElementById('invoice-content');
  if (!invoiceContent) return;
  
  const content = invoiceContent.innerHTML;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Facture - Ada Global Service</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .invoice-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .invoice-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .invoice-table th, .invoice-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        .invoice-table th { background: #f5f5f5; }
        .invoice-total { text-align: right; margin-top: 20px; font-size: 18px; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>${content}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ==================== GESTION DES FACTURES ====================
async function loadFactures() {
  try {
    console.log("=== DÉBUT CHARGEMENT FACTURES ===");
    
    // Mettre un indicateur de chargement
    const tbody = document.getElementById("factures-list");
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading">Chargement des factures...</td></tr>';
    }
    
    const factures = await ipcRenderer.invoke("get-factures");
    console.log("=== FACTURES REÇUES ===", factures);
    console.log("Nombre de factures:", factures?.length || 0);
    
    if (!factures) {
      console.warn("Aucune facture reçue (null/undefined)");
      displayFactures([]);
      return;
    }
    
    if (factures.length === 0) {
      console.info("Aucune facture dans la base de données");
      displayFactures([]);
      return;
    }
    
    // Afficher les détails des premières factures pour déboguer
    console.log("Première facture:", factures[0]);
    
    // Trier par date décroissante
    const facturesSorted = factures.sort((a, b) => {
      const dateA = new Date(a.created_at || a.date_facture);
      const dateB = new Date(b.created_at || b.date_facture);
      return dateB - dateA;
    });
    
    console.log("=== AFFICHAGE DES FACTURES ===");
    displayFactures(facturesSorted);
    
  } catch (error) {
    console.error("=== ERREUR CHARGEMENT FACTURES ===", error);
    showMessage("facture-message", "Erreur lors du chargement des factures: " + error.message, "error");
    
    // Afficher un message d'erreur dans le tableau
    const tbody = document.getElementById("factures-list");
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" style="color: red; text-align: center;">Erreur de chargement</td></tr>';
    }
  }
}

function displayFactures(factures) {
  const tbody = document.getElementById("factures-list");
  if (!tbody) return;

  if (factures.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Aucune facture enregistrée</td></tr>';
    return;
  }

function displayFactures(factures) {
  const tbody = document.getElementById("factures-list");
  if (!tbody) {
    console.error("Élément factures-list introuvable");
    return;
  }

  console.log("Affichage des factures:", factures?.length || 0);

  if (!factures || factures.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #6c757d;">Aucune facture enregistrée</td></tr>';
    return;
  }

  tbody.innerHTML = factures
    .map((facture) => {
      try {
        const dateFacture = new Date(facture.date_facture);
        const dateCreation = facture.created_at ? new Date(facture.created_at) : null;
        
        // Utiliser created_at si disponible (plus précis avec l'heure), sinon date_facture
        const displayDate = dateCreation || dateFacture;
        
        // Vérifier que la date est valide
        const formattedDateTime = displayDate && !isNaN(displayDate.getTime()) 
          ? `${displayDate.toLocaleDateString("fr-FR")} ${displayDate.toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}`
          : 'Date invalide';
        
        return `
          <tr>
            <td>${facture.id || 'N/A'}</td>
            <td>${formattedDateTime}</td>
            <td>${facture.nb_articles || 0}</td>
            <td>${facture.total_facture ? formatCFA(facture.total_facture) : '0 CFA'}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${facture.produits || '-'}
            </td>
            <td>
              <button class="btn btn-print" onclick="printFactureDetail('${facture.id}')">🖨️ Réimprimer</button>
              <button class="btn btn-primary" onclick="viewFactureDetail('${facture.id}')" style="margin-left: 5px; font-size: 12px;">👁️ Détail</button>
            </td>
          </tr>
        `;
      } catch (error) {
        console.error("Erreur lors de l'affichage de la facture:", facture, error);
        return `
          <tr>
            <td colspan="6" style="color: red;">Erreur d'affichage pour la facture ${facture?.id || 'inconnue'}</td>
          </tr>
        `;
      }
    })
    .join("");
}
}

async function viewFactureDetail(factureId) {
  try {
    const details = await ipcRenderer.invoke("get-facture-detail", factureId);
    if (details.length > 0) {
      const facture = details[0];
      generateInvoice(
        factureId, 
        details.map(d => ({
          reference: d.reference,
          nom: d.nom,
          quantity: d.quantite,
          prix_unitaire: d.prix_unitaire
        })),
        facture.total_facture,
        facture.commentaire_facture
      );
    }
  } catch (error) {
    console.error("Erreur lors du chargement du détail:", error);
  }
}

async function printFactureDetail(factureId) {
  await viewFactureDetail(factureId);
  setTimeout(() => {
    printInvoice();
  }, 100);
}

function printFactureIndividuelle(venteIndex) {
  const vente = ventesData[venteIndex];
  if (!vente || vente.facture_id) return;

  const factureId = `TEMP-${Date.now()}`;
  const items = [{
    reference: vente.reference,
    nom: vente.nom,
    quantity: vente.quantite,
    prix_unitaire: vente.prix_unitaire
  }];
  
  generateInvoice(factureId, items, vente.total, vente.commentaire);
}

// ==================== FILTRES ET RECHERCHE ====================
function filterVentesByDate() {
  const dateDebut = document.getElementById("date-debut-ventes")?.value;
  const dateFin = document.getElementById("date-fin-ventes")?.value;

  if (!dateDebut || !dateFin) {
    alert("Veuillez sélectionner une période complète");
    return;
  }

  if (new Date(dateDebut) > new Date(dateFin)) {
    alert("La date de début doit être antérieure à la date de fin");
    return;
  }

  const ventesFiltered = allVentesData.filter((vente) => {
    const dateVente = new Date(vente.date_vente);
    return dateVente >= new Date(dateDebut) && dateVente <= new Date(dateFin);
  }).sort((a, b) => new Date(b.date_vente) - new Date(a.date_vente)); // Maintenir le tri par date décroissante

  displayVentes(ventesFiltered);
  showMessage("vente-message", `${ventesFiltered.length} vente(s) trouvée(s) pour la période sélectionnée`, "success");
}

function resetVentesFilter() {
  // Réafficher toutes les ventes avec le tri par date décroissante
  const ventesSorted = allVentesData.sort((a, b) => new Date(b.date_vente) - new Date(a.date_vente));
  displayVentes(ventesSorted);
  showMessage("vente-message", "Toutes les ventes sont maintenant affichées", "success");
}

// ==================== GESTION DES STATISTIQUES ====================
async function loadStats() {
  const dateDebut = document.getElementById("date-debut-stats")?.value;
  const dateFin = document.getElementById("date-fin-stats")?.value;

  if (!dateDebut || !dateFin) {
    alert("Veuillez sélectionner une période");
    return;
  }

  try {
    const stats = await ipcRenderer.invoke("get-stats", dateDebut, dateFin);
    displayStats(stats);
  } catch (error) {
    console.error("Erreur lors du chargement des statistiques:", error);
  }
}

function displayStats(stats) {
  setValueSafely("total-ventes", formatCFA(stats.totalVentes));
  setValueSafely("nb-transactions", stats.nbTransactions);

  const tbody = document.getElementById("stats-produits");
  if (!tbody) return;

  if (stats.ventesParProduit.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">Aucune vente sur cette période</td></tr>';
    return;
  }

  tbody.innerHTML = stats.ventesParProduit
    .map((item) => `
      <tr>
        <td>${item.reference}</td>
        <td>${item.nom}</td>
        <td>${item.qte_vendue}</td>
        <td>${formatCFA(item.ca_total)}</td>
      </tr>
    `)
    .join("");

  createChart(stats.ventesParProduit);
}

function createChart(data) {
  const ctx = document.getElementById("ventesChart")?.getContext("2d");
  if (!ctx) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const topProducts = data.slice(0, 5);

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: topProducts.map((item) => item.nom),
      datasets: [
        {
          label: "Chiffre d'affaires (CFA)",
          data: topProducts.map((item) => item.ca_total),
          backgroundColor: [
            "rgba(102, 126, 234, 0.8)",
            "rgba(118, 75, 162, 0.8)",
            "rgba(40, 167, 69, 0.8)",
            "rgba(255, 193, 7, 0.8)",
            "rgba(220, 53, 69, 0.8)",
          ],
          borderColor: [
            "rgba(102, 126, 234, 1)",
            "rgba(118, 75, 162, 1)",
            "rgba(40, 167, 69, 1)",
            "rgba(255, 193, 7, 1)",
            "rgba(220, 53, 69, 1)",
          ],
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "Top 5 des produits les plus vendus",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return new Intl.NumberFormat("fr-FR").format(value) + " CFA";
            },
          },
        },
      },
    },
  });
}

// Fonction de test pour déboguer les factures (utilisable depuis la console)
async function testFactures() {
  console.log("=== TEST FACTURES ===");
  try {
    const factures = await ipcRenderer.invoke("get-factures");
    console.log("Résultat brut:", factures);
    console.log("Type:", typeof factures);
    console.log("Est un array:", Array.isArray(factures));
    console.log("Longueur:", factures?.length);
    
    if (factures && factures.length > 0) {
      console.log("Première facture détaillée:", JSON.stringify(factures[0], null, 2));
    }
    
    return factures;
  } catch (error) {
    console.error("Erreur test factures:", error);
    return null;
  }
}

// Exposer la fonction de test
window.testFactures = testFactures;
window.showTab = showTab;
window.loadStats = loadStats;
window.searchInTable = searchInTable;
window.printFactureIndividuelle = printFactureIndividuelle;
window.printFactureDetail = printFactureDetail;
window.viewFactureDetail = viewFactureDetail;
window.filterVentesByDate = filterVentesByDate;
window.resetVentesFilter = resetVentesFilter;
window.editProduit = editProduit;
window.saveProduit = saveProduit;
window.cancelEdit = cancelEdit;
window.addToCart = addToCart;
window.updateQuantity = updateQuantity;
window.updatePrice = updatePrice;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.processSale = processSale;
window.closeModal = closeModal;
window.printInvoice = printInvoice;