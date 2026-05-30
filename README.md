# SergysPyLearn — Plateforme d'apprentissage Python

> Créé par **Sergys BAGBONON** — INSTI Lokossa, Bénin

## 🌐 URL Publique

**https://sergysbagbonon-afk.github.io/plateforme-python**

---

## 🏗 Architecture

```
GitHub Pages  →  index.html  (frontend statique)
      ↕ API HTTPS
Render.com    →  api/server.js  (backend Node.js + SQLite)
```

---

## 🚀 Déploiement en 3 étapes

### Étape 1 — Pousser sur GitHub

```bash
git clone https://github.com/sergysbagbonon-afk/plateforme-python.git
cd plateforme-python

# Copier les fichiers reçus de Claude dans ce dossier
# puis :
git add .
git commit -m "🚀 SergysPyLearn — déploiement initial"
git push
```

### Étape 2 — Déployer le backend sur Render.com

1. Aller sur **https://render.com** → créer un compte gratuit
2. **New → Web Service**
3. Connecter votre repo GitHub `sergysbagbonon-afk/plateforme-python`
4. Paramètres :
   - **Name** : `sergyspylearn-api`
   - **Build Command** : `npm install`
   - **Start Command** : `node api/server.js`
   - **Plan** : Free
5. Variables d'environnement à ajouter :
   - `APP_PASSWORD` → votre mot de passe (ex: `sergyspython2026`)
   - `NODE_ENV` → `production`
   - `ALLOWED_ORIGINS` → `https://sergysbagbonon-afk.github.io`
6. Cliquer **Create Web Service**
7. Attendre ~2 minutes → l'URL sera `https://sergyspylearn-api.onrender.com`

### Étape 3 — Activer GitHub Pages

1. Sur GitHub → votre repo → **Settings → Pages**
2. Source : **Deploy from a branch**
3. Branch : **main** / **(root)**
4. Cliquer **Save**
5. Après 1 minute : **https://sergysbagbonon-afk.github.io/plateforme-python**

---

## 🔑 Mot de passe par défaut

`sergyspython2026`

*(Modifiez la variable `APP_PASSWORD` sur Render pour le changer)*

---

## 📁 Structure des fichiers

```
plateforme-python/
├── index.html          ← Frontend (servi par GitHub Pages)
├── api/
│   └── server.js       ← Backend Express + SQLite
├── package.json        ← Dépendances Node.js
├── render.yaml         ← Config déploiement Render.com
├── db/                 ← Base de données (créée automatiquement)
└── .gitignore
```

---

## 🗄 Base de données

La base SQLite est créée **automatiquement** au premier démarrage avec :
- **15 modules** (5 débutant, 5 intermédiaire, 5 avancé)
- **Leçons** avec contenu complet en Markdown
- **Exercices** avec correction automatique
- **Tables** : modules, lessons, exercises, resources

---

## 🔧 Développement local

```bash
npm install
APP_PASSWORD=monmotdepasse node api/server.js
# → http://localhost:3000
```

---

*© 2026 Sergys BAGBONON — INSTI Lokossa, Bénin*
