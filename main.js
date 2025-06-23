const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");

let mainWindow;
let db;

// Fonction pour obtenir le chemin de la base de données
function getDatabasePath() {
  // En développement : dossier du projet
  if (!app.isPackaged) {
    return path.join(__dirname, "ags_boutique.db");
  }

  // En production : dossier Documents/ada-global-service
  const documentsPath = app.getPath("documents");
  const appDataPath = path.join(documentsPath, "ada-global-service");

  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }

  return path.join(appDataPath, "ags_boutique.db");
}

// Initialisation de la base de données
function initDatabase() {
  const dbPath = getDatabasePath();

  try {
    console.log("Chemin de la base de données:", dbPath);
    db = new Database(dbPath);

    // Configuration pour de meilleures performances
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("cache_size = 1000000");
    db.pragma("temp_store = memory");

    console.log("Base de données connectée:", dbPath);

    // Création des tables si elles n'existent pas
    createTables();
    insertSampleData();
  } catch (error) {
    console.error(
      "Erreur lors de l'initialisation de la base de données:",
      error
    );
  }
}

function createTables() {
  try {
    // Table des produits
    db.exec(`CREATE TABLE IF NOT EXISTS produits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT UNIQUE,
        nom TEXT,
        categorie TEXT,
        prix_vente REAL,
        stock_minimum INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Table des approvisionnements
    db.exec(`CREATE TABLE IF NOT EXISTS approvisionnements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produit_id INTEGER,
        fournisseur TEXT,
        quantite INTEGER,
        prix_achat REAL,
        date_appro DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produit_id) REFERENCES produits (id)
    )`);

    // Table des ventes (modifiée pour supporter les ventes par lot)
    db.exec(`CREATE TABLE IF NOT EXISTS ventes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        facture_id TEXT,
        produit_id INTEGER,
        quantite INTEGER,
        prix_unitaire REAL,
        total REAL,
        commentaire TEXT,
        date_vente DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (produit_id) REFERENCES produits (id)
    )`);

    // Nouvelle table pour les factures de vente par lot
    db.exec(`CREATE TABLE IF NOT EXISTS factures (
        id TEXT PRIMARY KEY,
        total_facture REAL,
        nb_articles INTEGER,
        commentaire TEXT,
        date_facture DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log("Tables créées avec succès");
  } catch (error) {
    console.error("Erreur lors de la création des tables:", error);
  }
}

function insertSampleData() {
  try {
    // Vérifier si la table produits est vide
    const count = db.prepare("SELECT COUNT(*) as count FROM produits").get();

    if (count.count === 0) {
      console.log("Insertion des données d'exemple...");

      const exemples = [
        ["REF001", "T-shirt Blanc", "Vêtements", 15000, 5],
        ["REF002", "Jean Bleu", "Vêtements", 25000, 3],
        ["REF003", "Sneakers Blanches", "Chaussures", 45000, 2],
        ["REF004", "Sac à Main Noir", "Accessoires", 20000, 4],
        ["REF005", "Montre Sport", "Accessoires", 65000, 2],
      ];

      const insertProduit = db.prepare(
        "INSERT INTO produits (reference, nom, categorie, prix_vente, stock_minimum) VALUES (?, ?, ?, ?, ?)"
      );

      const insertMany = db.transaction((products) => {
        for (const product of products) {
          insertProduit.run(product);
        }
      });

      insertMany(exemples);

      // Ajout d'approvisionnements d'exemple
      const approExemples = [
        [1, "Fournisseur A", 20, 8000, "2024-01-15"],
        [2, "Fournisseur B", 15, 12000, "2024-01-15"],
        [3, "Fournisseur C", 10, 22000, "2024-01-16"],
      ];

      const insertAppro = db.prepare(
        "INSERT INTO approvisionnements (produit_id, fournisseur, quantite, prix_achat, date_appro) VALUES (?, ?, ?, ?, ?)"
      );

      const insertApproMany = db.transaction((approvisionnements) => {
        for (const appro of approvisionnements) {
          insertAppro.run(appro);
        }
      });

      insertApproMany(approExemples);

      console.log("Données d'exemple insérées avec succès");
    }
  } catch (error) {
    console.error("Erreur lors de l'insertion des données d'exemple:", error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, "assets", "icon.ico"),
  });

  mainWindow.loadFile("index.html");

  // Ouvre les DevTools en mode développement
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (db) {
      db.close();
      console.log("Base de données fermée");
    }
    app.quit();
  }
});

// Ajouter un handler pour obtenir le chemin de la base de données (utile pour debug)
ipcMain.handle("get-database-path", () => {
  return getDatabasePath();
});

// IPC Handlers pour communiquer avec le renderer

// Produits
ipcMain.handle("get-produits", () => {
  try {
    const stmt = db.prepare("SELECT * FROM produits ORDER BY nom");
    return stmt.all();
  } catch (error) {
    console.error("Erreur get-produits:", error);
    throw error;
  }
});

ipcMain.handle("add-produit", (event, produit) => {
  try {
    const { reference, nom, categorie, prix_vente, stock_minimum } = produit;
    const stmt = db.prepare(
      "INSERT INTO produits (reference, nom, categorie, prix_vente, stock_minimum) VALUES (?, ?, ?, ?, ?)"
    );
    const result = stmt.run(
      reference,
      nom,
      categorie,
      prix_vente,
      stock_minimum
    );
    return { id: result.lastInsertRowid };
  } catch (error) {
    console.error("Erreur add-produit:", error);
    throw error;
  }
});

ipcMain.handle("update-produit", (event, produit) => {
  try {
    const { id, reference, nom, categorie, prix_vente, stock_minimum } =
      produit;
    const stmt = db.prepare(
      "UPDATE produits SET reference = ?, nom = ?, categorie = ?, prix_vente = ?, stock_minimum = ? WHERE id = ?"
    );
    const result = stmt.run(
      reference,
      nom,
      categorie,
      prix_vente,
      stock_minimum,
      id
    );
    return { changes: result.changes };
  } catch (error) {
    console.error("Erreur update-produit:", error);
    throw error;
  }
});

// Approvisionnements
ipcMain.handle("get-approvisionnements", () => {
  try {
    const stmt = db.prepare(`
      SELECT a.*, p.reference, p.nom 
      FROM approvisionnements a 
      JOIN produits p ON a.produit_id = p.id 
      ORDER BY a.date_appro DESC
    `);
    return stmt.all();
  } catch (error) {
    console.error("Erreur get-approvisionnements:", error);
    throw error;
  }
});

ipcMain.handle("add-approvisionnement", (event, appro) => {
  try {
    const { produit_id, fournisseur, quantite, prix_achat, date_appro } = appro;
    const stmt = db.prepare(
      "INSERT INTO approvisionnements (produit_id, fournisseur, quantite, prix_achat, date_appro) VALUES (?, ?, ?, ?, ?)"
    );
    const result = stmt.run(
      produit_id,
      fournisseur,
      quantite,
      prix_achat,
      date_appro
    );
    return { id: result.lastInsertRowid };
  } catch (error) {
    console.error("Erreur add-approvisionnement:", error);
    throw error;
  }
});

// Ventes individuelles (ancien système)
ipcMain.handle("get-ventes", () => {
  try {
    const stmt = db.prepare(`
      SELECT v.*, p.reference, p.nom 
      FROM ventes v 
      JOIN produits p ON v.produit_id = p.id 
      ORDER BY v.date_vente DESC
    `);
    return stmt.all();
  } catch (error) {
    console.error("Erreur get-ventes:", error);
    throw error;
  }
});

ipcMain.handle("add-vente", (event, vente) => {
  try {
    const { produit_id, quantite, prix_unitaire, commentaire, date_vente } =
      vente;
    const total = quantite * prix_unitaire;
    const facture_id = null; // Vente individuelle

    const stmt = db.prepare(
      "INSERT INTO ventes (facture_id, produit_id, quantite, prix_unitaire, total, commentaire, date_vente) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const result = stmt.run(
      facture_id,
      produit_id,
      quantite,
      prix_unitaire,
      total,
      commentaire,
      date_vente
    );
    return { id: result.lastInsertRowid };
  } catch (error) {
    console.error("Erreur add-vente:", error);
    throw error;
  }
});

// Nouvelles fonctions pour les ventes par lot
ipcMain.handle("add-vente-lot", (event, venteData) => {
  try {
    const { items, commentaire, date_vente } = venteData;
    const factureId = `FAC-${Date.now()}`;

    // Calculer le total de la facture
    const totalFacture = items.reduce(
      (sum, item) => sum + item.quantite * item.prix_unitaire,
      0
    );
    const nbArticles = items.reduce((sum, item) => sum + item.quantite, 0);

    // Utiliser une transaction pour s'assurer de la cohérence
    const transaction = db.transaction(
      (factureId, totalFacture, nbArticles, commentaire, date_vente, items) => {
        // Insérer la facture
        const insertFacture = db.prepare(
          "INSERT INTO factures (id, total_facture, nb_articles, commentaire, date_facture) VALUES (?, ?, ?, ?, ?)"
        );
        insertFacture.run(
          factureId,
          totalFacture,
          nbArticles,
          commentaire,
          date_vente
        );

        // Insérer chaque vente
        const insertVente = db.prepare(
          "INSERT INTO ventes (facture_id, produit_id, quantite, prix_unitaire, total, commentaire, date_vente) VALUES (?, ?, ?, ?, ?, ?, ?)"
        );

        for (const item of items) {
          const total = item.quantite * item.prix_unitaire;
          insertVente.run(
            factureId,
            item.produit_id,
            item.quantite,
            item.prix_unitaire,
            total,
            commentaire,
            date_vente
          );
        }

        return { factureId, totalFacture, nbArticles };
      }
    );

    return transaction(
      factureId,
      totalFacture,
      nbArticles,
      commentaire,
      date_vente,
      items
    );
  } catch (error) {
    console.error("Erreur add-vente-lot:", error);
    throw error;
  }
});

// Obtenir les factures
ipcMain.handle("get-factures", () => {
  try {
    const stmt = db.prepare(`
      SELECT f.*, 
             COUNT(v.id) as nb_lignes,
             GROUP_CONCAT(p.nom, ', ') as produits
      FROM factures f
      LEFT JOIN ventes v ON f.id = v.facture_id
      LEFT JOIN produits p ON v.produit_id = p.id
      GROUP BY f.id, f.total_facture, f.nb_articles, f.commentaire, f.date_facture, f.created_at
      ORDER BY f.created_at DESC
    `);
    const result = stmt.all();
    console.log("Factures récupérées:", result.length);
    return result;
  } catch (error) {
    console.error("Erreur get-factures:", error);
    throw error;
  }
});

// Obtenir le détail d'une facture
ipcMain.handle("get-facture-detail", (event, factureId) => {
  try {
    const stmt = db.prepare(`
      SELECT v.*, p.reference, p.nom, f.date_facture, f.total_facture, f.commentaire as commentaire_facture
      FROM ventes v
      JOIN produits p ON v.produit_id = p.id
      JOIN factures f ON v.facture_id = f.id
      WHERE v.facture_id = ?
      ORDER BY p.nom
    `);
    return stmt.all(factureId);
  } catch (error) {
    console.error("Erreur get-facture-detail:", error);
    throw error;
  }
});

// Stock actuel
ipcMain.handle("get-stock", () => {
  try {
    const stmt = db.prepare(`
      SELECT 
          p.id,
          p.reference,
          p.nom,
          p.categorie,
          p.prix_vente,
          p.stock_minimum,
          COALESCE(SUM(a.quantite), 0) as stock_entre,
          COALESCE(SUM(v.quantite), 0) as stock_vendu,
          (COALESCE(SUM(a.quantite), 0) - COALESCE(SUM(v.quantite), 0)) as stock_actuel
      FROM produits p
      LEFT JOIN approvisionnements a ON p.id = a.produit_id
      LEFT JOIN ventes v ON p.id = v.produit_id
      GROUP BY p.id, p.reference, p.nom, p.categorie, p.prix_vente, p.stock_minimum
      ORDER BY p.nom
    `);
    return stmt.all();
  } catch (error) {
    console.error("Erreur get-stock:", error);
    throw error;
  }
});

// Statistiques
ipcMain.handle("get-stats", (event, dateDebut, dateFin) => {
  try {
    // Total des ventes
    const totalVentesStmt = db.prepare(
      "SELECT COALESCE(SUM(total), 0) as total_ventes FROM ventes WHERE date_vente BETWEEN ? AND ?"
    );
    const totalVentesResult = totalVentesStmt.get(dateDebut, dateFin);

    // Nombre de transactions (incluant les factures)
    const nbTransactionsStmt = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM ventes WHERE date_vente BETWEEN ? AND ? AND facture_id IS NULL) +
        (SELECT COUNT(*) FROM factures WHERE date_facture BETWEEN ? AND ?) as nb_transactions
    `);
    const nbTransactionsResult = nbTransactionsStmt.get(
      dateDebut,
      dateFin,
      dateDebut,
      dateFin
    );

    // Ventes par produit
    const ventesParProduitStmt = db.prepare(`
      SELECT p.reference, p.nom, SUM(v.quantite) as qte_vendue, SUM(v.total) as ca_total
      FROM ventes v 
      JOIN produits p ON v.produit_id = p.id 
      WHERE v.date_vente BETWEEN ? AND ?
      GROUP BY p.id, p.reference, p.nom
      ORDER BY ca_total DESC
    `);
    const ventesParProduitResult = ventesParProduitStmt.all(dateDebut, dateFin);

    return {
      totalVentes: totalVentesResult.total_ventes,
      nbTransactions: nbTransactionsResult.nb_transactions,
      ventesParProduit: ventesParProduitResult,
    };
  } catch (error) {
    console.error("Erreur get-stats:", error);
    throw error;
  }
});
