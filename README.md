# 🏪 Ada Global Service (AGS) - Application de Gestion

Application de gestion complète pour Ada Global Service avec gestion des stocks, ventes et statistiques.

## 📋 Fonctionnalités

- ✅ **Gestion des produits** - Ajout, référencement et catégorisation
- ✅ **Approvisionnement** - Suivi des entrées de stock par fournisseur
- ✅ **Ventes** - Enregistrement des ventes avec commentaires
- ✅ **Stock en temps réel** - Calcul automatique des stocks
- ✅ **Statistiques** - Analyses par période avec filtres
- ✅ **Base de données locale** - SQLite intégrée, pas besoin d'internet
- ✅ **Interface moderne** - Design responsive et intuitif

## 🚀 Installation et utilisation

### Étape 1: Préparation

1. **Téléchargez Node.js** depuis [nodejs.org](https://nodejs.org) (version LTS)
2. **Créez un dossier** `ada-global-service` sur votre Bureau
3. **Copiez tous les fichiers** dans ce dossier

### Étape 2: Installation des dépendances

Ouvrez une invite de commande dans le dossier (Shift + clic droit → "Ouvrir PowerShell ici") et tapez :

```bash
npm install
```

### Étape 3: Lancement de l'application

```bash
npm start
```

### Étape 4: Création de l'exécutable (optionnel)

Pour créer un fichier .exe distribuable :

```bash
npm run build
```

L'exécutable sera créé dans le dossier `dist/`

## 📁 Structure des fichiers

```
ada-global-service/
├── main.js              # Fichier principal Electron
├── index.html           # Interface utilisateur
├── renderer.js          # Logique de l'interface
├── package.json         # Configuration du projet
├── ags_boutique.db      # Base de données AGS (créée automatiquement)
└── dist/               # Exécutables générés
```

## 🎯 Guide d'utilisation

### 1. Configuration initiale

- Commencez par ajouter vos produits dans l'onglet "Produits"
- Renseignez les références, noms, catégories et prix

### 2. Approvisionnement

- Utilisez l'onglet "Approvisionnement" pour chaque livraison
- Le stock se met à jour automatiquement

### 3. Ventes

- Enregistrez chaque vente dans l'onglet "Ventes"
- Le stock se décompte automatiquement

### 4. Suivi

- Consultez l'état du stock en temps réel
- Analysez les performances dans "Statistiques"

## 🔧 Personnalisation

### Modifier l'icône de l'application

Remplacez les fichiers dans le dossier `assets/` :

- `icon.ico` (Windows)
- `icon.icns` (Mac)
- `icon.png` (Linux)

### Modifier la base de données

La base de données SQLite est stockée dans `ags_boutique.db`. Vous pouvez la sauvegarder ou la restaurer facilement.

## 📊 Base de données

L'application utilise SQLite avec 3 tables principales :

- **produits** - Références, noms, prix, stocks minimum
- **approvisionnements** - Entrées de stock par fournisseur
- **ventes** - Historique des ventes avec commentaires

## 🛠️ Développement

### Commandes disponibles

```bash
npm start           # Lancer en mode développement
npm run build       # Créer l'exécutable pour votre OS
npm run build-win   # Créer l'exécutable Windows
npm run build-mac   # Créer l'exécutable Mac
npm run build-linux # Créer l'exécutable Linux
```

### Mode debug

Décommentez la ligne dans `main.js` pour ouvrir les DevTools :

```javascript
mainWindow.webContents.openDevTools();
```

## 📞 Support

- **Sauvegarde recommandée** : Copiez régulièrement le fichier `ags_boutique.db`
- **Performance** : L'application peut gérer des milliers de produits et transactions
- **Sécurité** : Toutes les données restent locales sur votre ordinateur

## 📝 Notes techniques

- **Electron** : Framework pour applications desktop
- **SQLite** : Base de données locale, rapide et fiable
- **Taille finale** : ~150-200 Mo (normal pour Electron)
- **Compatibilité** : Windows 10+, Mac OS 10.14+, Linux Ubuntu 18+

---

**Développé avec ❤️ pour Ada Global Service (AGS) !**
