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

    // Table des ventes
    db.run(`CREATE TABLE IF NOT EXISTS ventes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produit_id INTEGER,
            quantite INTEGER,
            prix_unitaire REAL,
            total REAL,
            commentaire TEXT,
            date_vente DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (produit_id) REFERENCES produits (id)
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

// Ventes
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
    const { produit_id, quantite, prix_unitaire, commentaire, date_vente } =
      vente;
    const total = quantite * prix_unitaire;
    db.run(
      "INSERT INTO ventes (produit_id, quantite, prix_unitaire, total, commentaire, date_vente) VALUES (?, ?, ?, ?, ?, ?)",
      [produit_id, quantite, prix_unitaire, total, commentaire, date_vente],
      function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
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
      // Nombre de transactions
      `SELECT COUNT(*) as nb_transactions FROM ventes WHERE date_vente BETWEEN ? AND ?`,
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
        db.get(queries[1], [dateDebut, dateFin], (err, row) =>
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

ipcMain.handle("update-produit", (event, produit) => {
  return new Promise((resolve, reject) => {
    const { id, reference, nom, categorie, prix_vente, stock_minimum } =
      produit;
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
