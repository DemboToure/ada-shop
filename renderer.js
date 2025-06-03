const { ipcRenderer } = require("electron");

// Variables globales
let produits = [];
let ventesData = [];
let allVentesData = []; // Pour stocker toutes les ventes avant filtrage
let chartInstance = null;

// Initialisation
document.addEventListener("DOMContentLoaded", async () => {
  await loadProduits();
  await loadApprovisionnements();
  await loadVentes();
  await loadStock();
  initDateDefaults();
  setupEventListeners();
});

// Gestion des onglets
function showTab(tabName) {
  // Masquer tous les onglets
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  // Afficher l'onglet sélectionné
  document.getElementById(tabName).classList.add("active");
  event.target.classList.add("active");

  // Recharger les données si nécessaire
  if (tabName === "stock") {
    loadStock();
  }
}

// Initialisation des dates par défaut
function initDateDefaults() {
  const today = new Date().toISOString().split("T")[0];
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .split("T")[0];

  // Dates d'aujourd'hui pour les formulaires
  document.querySelector('input[name="date_appro"]').value = today;
  document.querySelector('input[name="date_vente"]').value = today;

  // Période du mois pour les statistiques
  document.getElementById("date-debut-stats").value = firstDayOfMonth;
  document.getElementById("date-fin-stats").value = today;

  // Période pour le filtre des ventes (par défaut : ce mois)
  document.getElementById("date-debut-ventes").value = firstDayOfMonth;
  document.getElementById("date-fin-ventes").value = today;
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
  // Formulaire produits
  document
    .getElementById("form-produit")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await addProduit(new FormData(e.target));
    });

  // Formulaire approvisionnement
  document
    .getElementById("form-approvisionnement")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await addApprovisionnement(new FormData(e.target));
    });

  // Formulaire ventes
  document
    .getElementById("form-ventes")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await addVente(new FormData(e.target));
    });

  // Auto-remplissage du prix lors de la sélection d'un produit
  document
    .getElementById("select-produit-vente")
    .addEventListener("change", (e) => {
      const produitId = e.target.value;
      if (produitId) {
        const produit = produits.find((p) => p.id == produitId);
        if (produit) {
          document.getElementById("prix-unitaire-vente").value =
            produit.prix_vente;
        }
      }
    });
}

// Fonctions pour afficher les messages
function showMessage(elementId, message, type = "success") {
  const element = document.getElementById(elementId);
  element.innerHTML = `<div class="${type}-message">${message}</div>`;
  setTimeout(() => {
    element.innerHTML = "";
  }, 3000);
}

// Fonction pour formater les montants en CFA
function formatCFA(montant) {
  return new Intl.NumberFormat("fr-FR").format(montant) + " CFA";
}

// Fonction de recherche améliorée dans les tableaux
function searchInTable(tableId, searchValue, columnIndexes) {
  const table = document.getElementById(tableId);
  const rows = table.getElementsByTagName("tr");

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].getElementsByTagName("td");
    if (cells.length > 0) {
      let found = false;

      // Rechercher dans toutes les colonnes spécifiées
      for (let colIndex of columnIndexes) {
        if (cells[colIndex]) {
          const cellText =
            cells[colIndex].textContent || cells[colIndex].innerText;
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

// GESTION DES PRODUITS
async function loadProduits() {
  try {
    produits = await ipcRenderer.invoke("get-produits");
    // Trier les produits par nom
    produits.sort((a, b) => a.nom.localeCompare(b.nom));
    displayProduits();
    updateProduitsSelects();
  } catch (error) {
    console.error("Erreur lors du chargement des produits:", error);
  }
}

function displayProduits() {
  const tbody = document.getElementById("produits-list");
  if (produits.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Aucun produit enregistré</td></tr>';
    return;
  }

  tbody.innerHTML = produits
    .map(
      (produit) => `
        <tr id="produit-${produit.id}">
            <td class="ref-cell">${produit.reference}</td>
            <td class="nom-cell">${produit.nom}</td>
            <td class="cat-cell">${produit.categorie || "-"}</td>
            <td class="prix-cell">${
              produit.prix_vente ? formatCFA(produit.prix_vente) : "-"
            }</td>
            <td class="stock-cell">${produit.stock_minimum || "-"}</td>
            <td>
                <button class="btn btn-edit" onclick="editProduit(${
                  produit.id
                })">
                    ✏️ Modifier
                </button>
            </td>
        </tr>
    `
    )
    .join("");
}

// Configuration de la recherche de produits pour les ventes
function setupProductSearch() {
  const searchInput = document.getElementById("search-produit-vente");
  const suggestionsDiv = document.getElementById("produit-suggestions");
  const hiddenInput = document.getElementById("selected-produit-id");
  const prixInput = document.getElementById("prix-unitaire-vente");

  let selectedIndex = -1;
  let filteredProducts = [];

  // Afficher tous les produits au focus
  searchInput.addEventListener("focus", function () {
    if (this.value.length === 0) {
      filteredProducts = produits;
      displaySuggestions(filteredProducts);
    }
  });

  searchInput.addEventListener("input", function () {
    const query = this.value.toLowerCase();
    selectedIndex = -1;

    if (query.length === 0) {
      // Afficher tous les produits si le champ est vide
      filteredProducts = produits;
      displaySuggestions(filteredProducts);
      hiddenInput.value = "";
      prixInput.value = "";
      return;
    }

    // Filtrer les produits par nom ou référence
    filteredProducts = produits.filter(
      (produit) =>
        produit.nom.toLowerCase().includes(query) ||
        produit.reference.toLowerCase().includes(query)
    );

    displaySuggestions(filteredProducts);
  });

  searchInput.addEventListener("keydown", function (e) {
    const items = suggestionsDiv.querySelectorAll(
      ".suggestion-item:not(.no-results)"
    );

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && items[selectedIndex]) {
        selectProduct(filteredProducts[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      suggestionsDiv.style.display = "none";
      selectedIndex = -1;
    }
  });

  // Cacher les suggestions quand on clique ailleurs
  document.addEventListener("click", function (e) {
    if (!searchInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
      suggestionsDiv.style.display = "none";
    }
  });

  function displaySuggestions(products) {
    if (products.length === 0) {
      suggestionsDiv.innerHTML =
        '<div class="no-results">🔍 Aucun produit trouvé</div>';
      suggestionsDiv.style.display = "block";
      return;
    }

    suggestionsDiv.innerHTML = products
      .map(
        (produit, index) => `
            <div class="suggestion-item" onclick="selectProductFromList(${
              produit.id
            })">
                <div class="suggestion-info">
                    <div class="suggestion-ref">${produit.reference}</div>
                    <div class="suggestion-nom">${produit.nom}</div>
                </div>
                <div class="suggestion-prix">${formatCFA(
                  produit.prix_vente
                )}</div>
            </div>
        `
      )
      .join("");

    suggestionsDiv.style.display = "block";
  }

  function updateSelection(items) {
    items.forEach((item, index) => {
      item.classList.toggle("selected", index === selectedIndex);
    });

    // Scroll vers l'élément sélectionné
    if (selectedIndex >= 0) {
      items[selectedIndex].scrollIntoView({ block: "nearest" });
    }
  }

  function selectProduct(produit) {
    searchInput.value = `${produit.reference} - ${produit.nom}`;
    hiddenInput.value = produit.id;
    prixInput.value = produit.prix_vente;
    suggestionsDiv.style.display = "none";
    selectedIndex = -1;
  }

  // Fonction globale pour la sélection depuis la liste
  window.selectProductFromList = function (produitId) {
    const produit = produits.find((p) => p.id === produitId);
    if (produit) {
      selectProduct(produit);
    }
  };
}

function updateProduitsSelects() {
  const selectAppro = document.getElementById("select-produit-appro");
  const selectVente = document.getElementById("select-produit-vente");

  // Trier les produits par nom seulement
  const sortedProduits = [...produits].sort((a, b) =>
    a.nom.localeCompare(b.nom)
  );

  const options = sortedProduits
    .map(
      (produit) =>
        `<option value="${produit.id}">${produit.nom} (${produit.reference})</option>`
    )
    .join("");

  selectAppro.innerHTML =
    '<option value="">Sélectionner un produit</option>' + options;
  selectVente.innerHTML =
    '<option value="">Sélectionner un produit</option>' + options;
}

async function addProduit(formData) {
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
    document.getElementById("form-produit").reset();
    await loadProduits();
  } catch (error) {
    showMessage(
      "produit-message",
      "Erreur lors de l'ajout du produit: " + error.message,
      "error"
    );
  }
}

// Fonction pour modifier un produit
function editProduit(produitId) {
  const produit = produits.find((p) => p.id === produitId);
  if (!produit) return;

  const row = document.getElementById(`produit-${produitId}`);
  if (!row) return;

  // Ajouter la classe d'édition
  row.classList.add("edit-mode");

  // Remplacer les cellules par des inputs
  row.innerHTML = `
        <td><input type="text" class="edit-input" value="${
          produit.reference
        }" id="edit-ref-${produitId}"></td>
        <td><input type="text" class="edit-input" value="${
          produit.nom
        }" id="edit-nom-${produitId}"></td>
        <td><input type="text" class="edit-input" value="${
          produit.categorie || ""
        }" id="edit-cat-${produitId}"></td>
        <td><input type="number" class="edit-input" value="${
          produit.prix_vente || ""
        }" step="1" id="edit-prix-${produitId}"></td>
        <td><input type="number" class="edit-input" value="${
          produit.stock_minimum || ""
        }" id="edit-stock-${produitId}"></td>
        <td>
            <button class="btn btn-success" onclick="saveProduit(${produitId})" style="margin-right: 5px; padding: 5px 10px; font-size: 12px;">
                💾 Sauver
            </button>
            <button class="btn btn-primary" onclick="cancelEdit(${produitId})" style="padding: 5px 10px; font-size: 12px;">
                ❌ Annuler
            </button>
        </td>
    `;
}

// Fonction pour sauvegarder les modifications
async function saveProduit(produitId) {
  try {
    const produitModifie = {
      id: produitId,
      reference: document.getElementById(`edit-ref-${produitId}`).value,
      nom: document.getElementById(`edit-nom-${produitId}`).value,
      categorie: document.getElementById(`edit-cat-${produitId}`).value,
      prix_vente:
        parseFloat(document.getElementById(`edit-prix-${produitId}`).value) ||
        0,
      stock_minimum:
        parseInt(document.getElementById(`edit-stock-${produitId}`).value) || 0,
    };

    // Validation simple
    if (!produitModifie.reference || !produitModifie.nom) {
      alert("La référence et le nom sont obligatoires");
      return;
    }

    await ipcRenderer.invoke("update-produit", produitModifie);
    showMessage("produit-message", "Produit modifié avec succès !");
    await loadProduits(); // Recharger la liste
    await updateProduitsSelects(); // Mettre à jour les listes déroulantes
  } catch (error) {
    showMessage(
      "produit-message",
      "Erreur lors de la modification: " + error.message,
      "error"
    );
  }
}

// Fonction pour annuler l'édition
function cancelEdit(produitId) {
  loadProduits(); // Simplement recharger pour annuler
}

// GESTION DES APPROVISIONNEMENTS
async function loadApprovisionnements() {
  try {
    const approvisionnements = await ipcRenderer.invoke(
      "get-approvisionnements"
    );
    displayApprovisionnements(approvisionnements);
  } catch (error) {
    console.error("Erreur lors du chargement des approvisionnements:", error);
  }
}

function displayApprovisionnements(approvisionnements) {
  const tbody = document.getElementById("approvisionnements-list");
  if (approvisionnements.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7">Aucun approvisionnement enregistré</td></tr>';
    return;
  }

  tbody.innerHTML = approvisionnements
    .map(
      (appro) => `
        <tr>
            <td>${new Date(appro.date_appro).toLocaleDateString("fr-FR")}</td>
            <td>${appro.reference}</td>
            <td>${appro.nom}</td>
            <td>${appro.fournisseur || "-"}</td>
            <td>${appro.quantite}</td>
            <td>${appro.prix_achat ? formatCFA(appro.prix_achat) : "-"}</td>
            <td>${
              appro.prix_achat
                ? formatCFA(appro.quantite * appro.prix_achat)
                : "-"
            }</td>
        </tr>
    `
    )
    .join("");
}

async function addApprovisionnement(formData) {
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
    document.getElementById("form-approvisionnement").reset();
    document.querySelector('input[name="date_appro"]').value = new Date()
      .toISOString()
      .split("T")[0];
    await loadApprovisionnements();
    await loadStock(); // Mettre à jour le stock
  } catch (error) {
    showMessage(
      "appro-message",
      "Erreur lors de l'enregistrement: " + error.message,
      "error"
    );
  }
}

// GESTION DES VENTES
async function loadVentes() {
  try {
    const ventes = await ipcRenderer.invoke("get-ventes");
    allVentesData = ventes; // Stocker toutes les ventes
    displayVentes(ventes);
  } catch (error) {
    console.error("Erreur lors du chargement des ventes:", error);
  }
}

function displayVentes(ventes) {
  ventesData = ventes; // Stocker pour les statistiques
  const tbody = document.getElementById("ventes-list");
  if (ventes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8">Aucune vente enregistrée</td></tr>';
    return;
  }

  tbody.innerHTML = ventes
    .map(
      (vente, index) => `
        <tr>
            <td>${new Date(vente.date_vente).toLocaleDateString("fr-FR")}</td>
            <td>${vente.reference}</td>
            <td>${vente.nom}</td>
            <td>${vente.quantite}</td>
            <td>${formatCFA(vente.prix_unitaire)}</td>
            <td>${formatCFA(vente.total)}</td>
            <td>${vente.commentaire || "-"}</td>
            <td>
                <button class="btn btn-print" onclick="printFacture(${index})">
                    🖨️ Facture
                </button>
            </td>
        </tr>
    `
    )
    .join("");
}

async function addVente(formData) {
  try {
    const vente = {
      produit_id: parseInt(formData.get("produit_id")),
      quantite: parseInt(formData.get("quantite")),
      prix_unitaire: parseFloat(formData.get("prix_unitaire")),
      commentaire: formData.get("commentaire"),
      date_vente: formData.get("date_vente"),
    };

    await ipcRenderer.invoke("add-vente", vente);
    showMessage("vente-message", "Vente enregistrée avec succès !");
    document.getElementById("form-ventes").reset();
    document.querySelector('input[name="date_vente"]').value = new Date()
      .toISOString()
      .split("T")[0];
    await loadVentes();
    await loadStock(); // Mettre à jour le stock
    allVentesData = await ipcRenderer.invoke("get-ventes"); // Recharger toutes les ventes
  } catch (error) {
    showMessage(
      "vente-message",
      "Erreur lors de l'enregistrement: " + error.message,
      "error"
    );
  }
}

// Fonction pour filtrer les ventes par date
function filterVentesByDate() {
  const dateDebut = document.getElementById("date-debut-ventes").value;
  const dateFin = document.getElementById("date-fin-ventes").value;

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
  });

  displayVentes(ventesFiltered);
  showMessage(
    "vente-message",
    `${ventesFiltered.length} vente(s) trouvée(s) pour la période sélectionnée`,
    "success"
  );
}

// Fonction pour réinitialiser le filtre des ventes
function resetVentesFilter() {
  displayVentes(allVentesData);
  showMessage(
    "vente-message",
    "Toutes les ventes sont maintenant affichées",
    "success"
  );
}

// GESTION DU STOCK
async function loadStock() {
  try {
    const stock = await ipcRenderer.invoke("get-stock");
    displayStock(stock);
  } catch (error) {
    console.error("Erreur lors du chargement du stock:", error);
  }
}

function displayStock(stock) {
  const tbody = document.getElementById("stock-list");
  if (stock.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">Aucun produit en stock</td></tr>';
    return;
  }

  tbody.innerHTML = stock
    .map((item) => {
      const valeurStock = item.stock_actuel * item.prix_vente;
      const statut =
        item.stock_actuel <= item.stock_minimum ? "CRITIQUE" : "OK";
      const statutClass =
        statut === "CRITIQUE" ? "status-critique" : "status-ok";

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

// GESTION DES STATISTIQUES
async function loadStats() {
  const dateDebut = document.getElementById("date-debut-stats").value;
  const dateFin = document.getElementById("date-fin-stats").value;

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
  // Mise à jour des cartes de statistiques
  document.getElementById("total-ventes").textContent = formatCFA(
    stats.totalVentes
  );
  document.getElementById("nb-transactions").textContent = stats.nbTransactions;

  // Mise à jour du tableau des ventes par produit
  const tbody = document.getElementById("stats-produits");
  if (stats.ventesParProduit.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4">Aucune vente sur cette période</td></tr>';
    return;
  }

  tbody.innerHTML = stats.ventesParProduit
    .map(
      (item) => `
        <tr>
            <td>${item.reference}</td>
            <td>${item.nom}</td>
            <td>${item.qte_vendue}</td>
            <td>${formatCFA(item.ca_total)}</td>
        </tr>
    `
    )
    .join("");

  // Créer le graphique
  createChart(stats.ventesParProduit);
}

// Fonction pour créer le graphique
function createChart(data) {
  const ctx = document.getElementById("ventesChart").getContext("2d");

  // Détruire le graphique précédent s'il existe
  if (chartInstance) {
    chartInstance.destroy();
  }

  // Prendre les 5 meilleurs produits
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
        legend: {
          display: false,
        },
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

// Fonction pour imprimer une facture
function printFacture(venteIndex) {
  const vente = ventesData[venteIndex];
  if (!vente) return;

  const factureContent = `
        <div class="print-section" style="font-family: Arial, sans-serif; padding: 20px; max-width: 400px;">
            <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
                <img src="assets/logo.jpg" alt="Ada Global Service" style="height: 50px; width: auto; margin-bottom: 10px;">
                <p style="margin: 5px 0; font-size: 14px;">AGS - Votre boutique de confiance</p>
                <p style="margin: 0; font-size: 12px;">📞 +221 76 534 46 11 | 📧 adaglobalservices23@gmail.com</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #333; margin: 0 0 10px 0;">🧾 Facture de vente</h3>
                <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(
                  vente.date_vente
                ).toLocaleDateString("fr-FR")}</p>
                <p style="margin: 5px 0;"><strong>Heure:</strong> ${new Date().toLocaleTimeString(
                  "fr-FR"
                )}</p>
            </div>
            
            <div style="border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 0; font-weight: bold;">Produit:</td>
                        <td style="padding: 8px 0;">${vente.nom}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 0; font-weight: bold;">Référence:</td>
                        <td style="padding: 8px 0;">${vente.reference}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 0; font-weight: bold;">Quantité:</td>
                        <td style="padding: 8px 0;">${vente.quantite}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 0; font-weight: bold;">Prix unitaire:</td>
                        <td style="padding: 8px 0;">${formatCFA(
                          vente.prix_unitaire
                        )}</td>
                    </tr>
                    ${
                      vente.commentaire
                        ? `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 0; font-weight: bold;">Note:</td>
                        <td style="padding: 8px 0;">${vente.commentaire}</td>
                    </tr>
                    `
                        : ""
                    }
                </table>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center;">
                <h3 style="color: #667eea; margin: 0 0 10px 0;">TOTAL À PAYER</h3>
                <h2 style="color: #333; margin: 0; font-size: 24px;">${formatCFA(
                  vente.total
                )}</h2>
            </div>
            
            <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
                <p style="margin: 5px 0; font-size: 12px; color: #666;">Merci pour votre confiance !</p>
                <p style="margin: 0; font-size: 12px; color: #666;">Ada Global Service - ${new Date().getFullYear()}</p>
            </div>
        </div>
    `;

  // Créer une nouvelle fenêtre pour l'impression
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Facture - ${vente.reference}</title>
            <style>
                @media print {
                    body { margin: 0; }
                    .print-section { max-width: none !important; }
                }
            </style>
        </head>
        <body>
            ${factureContent}
        </body>
        </html>
    `);
  printWindow.document.close();
  printWindow.print();
}

// Fonction globale pour les onglets (appelée depuis HTML)
window.showTab = showTab;
window.loadStats = loadStats;
window.searchInTable = searchInTable;
window.printFacture = printFacture;
window.filterVentesByDate = filterVentesByDate;
window.resetVentesFilter = resetVentesFilter;
window.editProduit = editProduit;
window.saveProduit = saveProduit;
window.cancelEdit = cancelEdit;
