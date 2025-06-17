const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

let mainWindow;
let db;

// Initialisation de la base de données
function initDatabase() {
  const dbPath = path.join(__dirname, "ags_boutique.db");
  db = new sqlite3.Database(dbPath);

  // Création des tables si elles n'existent pas
  db.serialize(() => {
    // Table des produits
    db.run(`CREATE TABLE IF NOT EXISTS produits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference TEXT UNIQUE,
            nom TEXT,
            categorie TEXT,
            prix_vente REAL,
            stock_minimum INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

    // Table des approvisionnements
    db.run(`CREATE TABLE IF NOT EXISTS approvisionnements (
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
    db.run(`CREATE TABLE IF NOT EXISTS ventes (
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
    db.run(`CREATE TABLE IF NOT EXISTS factures (
            id TEXT PRIMARY KEY,
            total_facture REAL,
            nb_articles INTEGER,
            commentaire TEXT,
            date_facture DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

    // Insertion de données d'exemple si la table est vide
    db.get("SELECT COUNT(*) as count FROM produits", (err, row) => {
      if (row.count === 0) {
        const exemples = [
          ["REF001", "T-shirt Blanc", "Vêtements", 15000, 5],
          ["REF002", "Jean Bleu", "Vêtements", 25000, 3],
          ["REF003", "Sneakers Blanches", "Chaussures", 45000, 2],
          ["REF004", "Sac à Main Noir", "Accessoires", 20000, 4],
          ["REF005", "Montre Sport", "Accessoires", 65000, 2],
        ];

        const stmt = db.prepare(
          "INSERT INTO produits (reference, nom, categorie, prix_vente, stock_minimum) VALUES (?, ?, ?, ?, ?)"
        );
        exemples.forEach((produit) => stmt.run(produit));
        stmt.finalize();

        // Ajout d'approvisionnements d'exemple
        const approStmt = db.prepare(
          "INSERT INTO approvisionnements (produit_id, fournisseur, quantite, prix_achat, date_appro) VALUES (?, ?, ?, ?, ?)"
        );
        const approExemples = [
          [1, "Fournisseur A", 20, 8000, "2024-01-15"],
          [2, "Fournisseur B", 15, 12000, "2024-01-15"],
          [3, "Fournisseur C", 10, 22000, "2024-01-16"],
        ];
        approExemples.forEach((appro) => approStmt.run(appro));
        approStmt.finalize();
      }
    });
  });
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
  mainWindow.webContents.openDevTools();
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
    if (db) db.close();
    app.quit();
  }
});

// IPC Handlers pour communiquer avec le renderer

// Produits
ipcMain.handle("get-produits", () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM produits ORDER BY nom", (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle("add-produit", (event, produit) => {
  return new Promise((resolve, reject) => {
    const { reference, nom, categorie, prix_vente, stock_minimum } = produit;
    db.run(
      "INSERT INTO produits (reference, nom, categorie, prix_vente, stock_minimum) VALUES (?, ?, ?, ?, ?)",
      [reference, nom, categorie, prix_vente, stock_minimum],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
});

ipcMain.handle("update-produit", (event, produit) => {
  return new Promise((resolve, reject) => {
    const { id, reference, nom, categorie, prix_vente, stock_minimum } = produit;
    db.run(
      "UPDATE produits SET reference = ?, nom = ?, categorie = ?, prix_vente = ?, stock_minimum = ? WHERE id = ?",
      [reference, nom, categorie, prix_vente, stock_minimum, id],
      function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      }
    );
  });
});

// Approvisionnements
ipcMain.handle("get-approvisionnements", () => {
  return new Promise((resolve, reject) => {
    db.all(
      `
            SELECT a.*, p.reference, p.nom 
            FROM approvisionnements a 
            JOIN produits p ON a.produit_id = p.id 
            ORDER BY a.date_appro DESC
        `,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
});

ipcMain.handle("add-approvisionnement", (event, appro) => {
  return new Promise((resolve, reject) => {
    const { produit_id, fournisseur, quantite, prix_achat, date_appro } = appro;
    db.run(
      "INSERT INTO approvisionnements (produit_id, fournisseur, quantite, prix_achat, date_appro) VALUES (?, ?, ?, ?, ?)",
      [produit_id, fournisseur, quantite, prix_achat, date_appro],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
});

// Ventes individuelles (ancien système)
ipcMain.handle("get-ventes", () => {
  return new Promise((resolve, reject) => {
    db.all(
      `
            SELECT v.*, p.reference, p.nom 
            FROM ventes v 
            JOIN produits p ON v.produit_id = p.id 
            ORDER BY v.date_vente DESC
        `,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
});

ipcMain.handle("add-vente", (event, vente) => {
  return new Promise((resolve, reject) => {
    const { produit_id, quantite, prix_unitaire, commentaire, date_vente } = vente;
    const total = quantite * prix_unitaire;
    const facture_id = null; // Vente individuelle
    
    db.run(
      "INSERT INTO ventes (facture_id, produit_id, quantite, prix_unitaire, total, commentaire, date_vente) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [facture_id, produit_id, quantite, prix_unitaire, total, commentaire, date_vente],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      }
    );
  });
});

// Nouvelles fonctions pour les ventes par lot
ipcMain.handle("add-vente-lot", (event, venteData) => {
  return new Promise((resolve, reject) => {
    const { items, commentaire, date_vente } = venteData;
    const factureId = `FAC-${Date.now()}`;
    
    // Calculer le total de la facture
    const totalFacture = items.reduce((sum, item) => sum + (item.quantite * item.prix_unitaire), 0);
    const nbArticles = items.reduce((sum, item) => sum + item.quantite, 0);
    
    db.serialize(() => {
      // Commencer une transaction
      db.run("BEGIN TRANSACTION");
      
      try {
        // Insérer la facture
        db.run(
          "INSERT INTO factures (id, total_facture, nb_articles, commentaire, date_facture) VALUES (?, ?, ?, ?, ?)",
          [factureId, totalFacture, nbArticles, commentaire, date_vente],
          function (err) {
            if (err) {
              db.run("ROLLBACK");
              reject(err);
              return;
            }
          }
        );
        
        // Insérer chaque vente
        let completed = 0;
        items.forEach((item) => {
          const total = item.quantite * item.prix_unitaire;
          db.run(
            "INSERT INTO ventes (facture_id, produit_id, quantite, prix_unitaire, total, commentaire, date_vente) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [factureId, item.produit_id, item.quantite, item.prix_unitaire, total, commentaire, date_vente],
            function (err) {
              if (err) {
                db.run("ROLLBACK");
                reject(err);
                return;
              }
              
              completed++;
              if (completed === items.length) {
                db.run("COMMIT");
                resolve({ factureId, totalFacture, nbArticles });
              }
            }
          );
        });
        
      } catch (error) {
        db.run("ROLLBACK");
        reject(error);
      }
    });
  });
});

// Obtenir les factures
ipcMain.handle("get-factures", () => {
  return new Promise((resolve, reject) => {
    db.all(
      `
            SELECT f.*, 
                   COUNT(v.id) as nb_lignes,
                   GROUP_CONCAT(p.nom, ', ') as produits
            FROM factures f
            LEFT JOIN ventes v ON f.id = v.facture_id
            LEFT JOIN produits p ON v.produit_id = p.id
            GROUP BY f.id, f.total_facture, f.nb_articles, f.commentaire, f.date_facture, f.created_at
            ORDER BY f.created_at DESC
        `,
      (err, rows) => {
        if (err) {
          console.error("Erreur SQL get-factures:", err);
          reject(err);
        } else {
          console.log("Factures chargées:", rows?.length || 0);
          resolve(rows || []);
        }
      }
    );
  });
});

// Obtenir le détail d'une facture
ipcMain.handle("get-facture-detail", (event, factureId) => {
  return new Promise((resolve, reject) => {
    db.all(
      `
            SELECT v.*, p.reference, p.nom, f.date_facture, f.total_facture, f.commentaire as commentaire_facture
            FROM ventes v
            JOIN produits p ON v.produit_id = p.id
            JOIN factures f ON v.facture_id = f.id
            WHERE v.facture_id = ?
            ORDER BY p.nom
        `,
      [factureId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
});

// Stock actuel
ipcMain.handle("get-stock", () => {
  return new Promise((resolve, reject) => {
    db.all(
      `
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
        `,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
});

// Statistiques
ipcMain.handle("get-stats", (event, dateDebut, dateFin) => {
  return new Promise((resolve, reject) => {
    const queries = [
      // Total des ventes
      `SELECT COALESCE(SUM(total), 0) as total_ventes FROM ventes WHERE date_vente BETWEEN ? AND ?`,
      // Nombre de transactions (incluant les factures)
      `SELECT 
         (SELECT COUNT(*) FROM ventes WHERE date_vente BETWEEN ? AND ? AND facture_id IS NULL) +
         (SELECT COUNT(*) FROM factures WHERE date_facture BETWEEN ? AND ?) as nb_transactions`,
      // Ventes par produit
      `SELECT p.reference, p.nom, SUM(v.quantite) as qte_vendue, SUM(v.total) as ca_total
             FROM ventes v 
             JOIN produits p ON v.produit_id = p.id 
             WHERE v.date_vente BETWEEN ? AND ?
             GROUP BY p.id, p.reference, p.nom
             ORDER BY ca_total DESC`,
    ];

    Promise.all([
      new Promise((res, rej) =>
        db.get(queries[0], [dateDebut, dateFin], (err, row) =>
          err ? rej(err) : res(row)
        )
      ),
      new Promise((res, rej) =>
        db.get(queries[1], [dateDebut, dateFin, dateDebut, dateFin], (err, row) =>
          err ? rej(err) : res(row)
        )
      ),
      new Promise((res, rej) =>
        db.all(queries[2], [dateDebut, dateFin], (err, rows) =>
          err ? rej(err) : res(rows)
        )
      ),
    ])
      .then((results) => {
        resolve({
          totalVentes: results[0].total_ventes,
          nbTransactions: results[1].nb_transactions,
          ventesParProduit: results[2],
        });
      })
      .catch(reject);
  });
});