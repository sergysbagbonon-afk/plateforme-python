/**
 * SergysPyLearn — Backend API
 * Stack : Node.js + Express + better-sqlite3
 * Hébergement : Render.com (free tier)
 */

const express    = require('express');
const Database   = require('better-sqlite3');
const cors       = require('cors');
const session    = require('express-session');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── BASE DE DONNÉES ────────────────────────────────────────────────── */
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'sergyspylearn.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ── UPLOADS ────────────────────────────────────────────────────────── */
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = crypto.randomBytes(12).toString('hex') + ext;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf'));
  }
});

/* ── CORS ───────────────────────────────────────────────────────────── */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .concat([
    'https://sergysbagbonon-afk.github.io',
    'http://localhost',
    'http://127.0.0.1',
    'null'   // file:// opens as null origin
  ]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS bloqué : ' + origin));
  },
  credentials: true
}));

/* ── SESSION ────────────────────────────────────────────────────────── */
app.use(session({
  secret:            process.env.SESSION_SECRET || 'sergyspylearn_secret_2026',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000   // 7 jours
  }
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── INITIALISATION BDD ─────────────────────────────────────────────── */
db.exec(`
  CREATE TABLE IF NOT EXISTS modules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    level       TEXT    NOT NULL CHECK(level IN ('beginner','intermediate','advanced')),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id        INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    title            TEXT    NOT NULL,
    description      TEXT    NOT NULL DEFAULT '',
    content          TEXT    NOT NULL DEFAULT '',
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id     INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    title         TEXT    NOT NULL,
    description   TEXT    NOT NULL DEFAULT '',
    starter_code  TEXT    NOT NULL DEFAULT '',
    solution_code TEXT    NOT NULL DEFAULT '',
    expected_output TEXT  NOT NULL DEFAULT '',
    difficulty    TEXT    NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
    hints         TEXT    NOT NULL DEFAULT '[]',
    sort_order    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS resources (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    filename    TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'general',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/* ── SEED : données initiales si BDD vide ───────────────────────────── */
function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as n FROM modules').get().n;
  if (count > 0) return;

  console.log('🌱 Initialisation de la base de données…');

  const insertModule  = db.prepare('INSERT INTO modules  (title,description,level,sort_order) VALUES (?,?,?,?)');
  const insertLesson  = db.prepare('INSERT INTO lessons  (module_id,title,description,content,duration_minutes,sort_order) VALUES (?,?,?,?,?,?)');
  const insertExercise= db.prepare('INSERT INTO exercises (lesson_id,title,description,starter_code,solution_code,expected_output,difficulty,hints,sort_order) VALUES (?,?,?,?,?,?,?,?,?)');

  const modules = [
    // ── DÉBUTANT ─────────────────────────────────────────────────────
    { title:'Introduction à Python',       desc:'Premiers pas avec Python : installation, syntaxe de base et votre premier programme.',                     level:'beginner',     order:1  },
    { title:'Variables et Types de données', desc:'Comprendre les variables, les types (int, float, str, bool) et les opérateurs.',                          level:'beginner',     order:2  },
    { title:'Structures de contrôle',       desc:'Conditions if/elif/else, boucles for et while pour contrôler le flux de votre programme.',                 level:'beginner',     order:3  },
    { title:'Fonctions',                    desc:'Définir et appeler des fonctions, paramètres, valeurs de retour et portée des variables.',                  level:'beginner',     order:4  },
    { title:'Listes et Tuples',             desc:'Collections ordonnées : création, indexation, slicing et méthodes des listes et tuples.',                  level:'beginner',     order:5  },
    // ── INTERMÉDIAIRE ─────────────────────────────────────────────────
    { title:'Dictionnaires et Ensembles',   desc:'Structures de données clé-valeur : dictionnaires, sets et leurs opérations.',                              level:'intermediate', order:6  },
    { title:'Programmation Orientée Objet', desc:'Classes, objets, héritage, encapsulation et polymorphisme en Python.',                                     level:'intermediate', order:7  },
    { title:'Gestion des erreurs',          desc:'Exceptions, try/except/finally et création de ses propres exceptions.',                                    level:'intermediate', order:8  },
    { title:'Fichiers et I/O',              desc:'Lire et écrire des fichiers texte, CSV et JSON. Gestion des chemins avec pathlib.',                        level:'intermediate', order:9  },
    { title:'Modules et Packages',          desc:'Importer des modules, créer ses propres packages et utiliser pip.',                                        level:'intermediate', order:10 },
    // ── AVANCÉ ────────────────────────────────────────────────────────
    { title:'Compréhensions et Générateurs', desc:'List/dict/set comprehensions, expressions génératrices et le mot-clé yield.',                             level:'advanced',     order:11 },
    { title:'Décorateurs et Closures',       desc:'Fonctions d\'ordre supérieur, closures, décorateurs avec et sans arguments.',                             level:'advanced',     order:12 },
    { title:'Concurrence et asyncio',        desc:'Programmation asynchrone avec async/await, asyncio et threading.',                                        level:'advanced',     order:13 },
    { title:'Traitement de données',         desc:'Manipulation de données avec les bibliothèques standard : csv, json, collections, itertools.',             level:'advanced',     order:14 },
    { title:'Tests et Qualité du code',      desc:'Écrire des tests unitaires avec unittest et pytest. Bonnes pratiques PEP 8.',                             level:'advanced',     order:15 },
  ];

  const lessonData = {
    1: [ // Introduction à Python
      { title:'Qu\'est-ce que Python ?', desc:'Histoire, usages et installation de Python.', dur:10,
        content:`## Qu'est-ce que Python ?

Python est un langage de programmation **interprété**, **orienté objet** et à **typage dynamique**, créé par Guido van Rossum en 1991.

### Pourquoi Python ?

- **Simple à apprendre** : syntaxe claire proche du français
- **Polyvalent** : web, data science, IA, scripts, automatisation
- **Communauté immense** : millions de bibliothèques disponibles
- **Très demandé** : l'un des langages les plus utilisés au monde

### Vérifier votre installation

\`\`\`python
python --version
# Python 3.12.x
\`\`\`

### Votre premier programme

\`\`\`python
print("Bonjour, monde !")
print("Bienvenue dans SergysPyLearn !")
\`\`\`` },

      { title:'Syntaxe de base', desc:'Indentation, commentaires et structure d\'un programme Python.', dur:15,
        content:`## Syntaxe de base

### L'indentation — règle fondamentale

En Python, l'indentation **n'est pas optionnelle**, elle définit les blocs de code :

\`\`\`python
if True:
    print("Ce code est indenté")   # 4 espaces
    print("Il fait partie du bloc if")

print("Ceci est hors du bloc")
\`\`\`

### Commentaires

\`\`\`python
# Commentaire sur une ligne

"""
Commentaire
sur plusieurs lignes
(docstring)
"""
\`\`\`

### La fonction print()

\`\`\`python
print("Texte simple")
print("Valeur :", 42)
print("A", "B", "C", sep="-")   # A-B-C
print("Ligne 1", end=" | ")
print("Ligne 2")                 # Ligne 1 | Ligne 2
\`\`\`` },

      { title:'Variables et affectation', desc:'Créer et utiliser des variables en Python.', dur:12,
        content:`## Variables et affectation

### Créer une variable

\`\`\`python
nom = "Sergys"
age = 22
taille = 1.75
etudiant = True
\`\`\`

### Règles de nommage

\`\`\`python
# ✅ Noms valides
mon_nom = "OK"
_privee = "OK"
maVariable2 = "OK"

# ❌ Noms invalides
2variable = "ERREUR"   # commence par un chiffre
mon-nom = "ERREUR"     # tiret interdit
class = "ERREUR"       # mot réservé
\`\`\`

### Affectation multiple

\`\`\`python
x = y = z = 0          # Même valeur
a, b, c = 1, 2, 3      # Déballage
a, b = b, a            # Échange de valeurs !
\`\`\`` },
    ],

    3: [ // Structures de contrôle
      { title:'Conditions if/elif/else', desc:'Prendre des décisions dans votre code.', dur:15,
        content:`## Conditions if / elif / else

### Structure de base

\`\`\`python
note = 14

if note >= 16:
    print("Très bien !")
elif note >= 12:
    print("Bien")
elif note >= 10:
    print("Passable")
else:
    print("Insuffisant")
\`\`\`

### Opérateurs de comparaison

| Opérateur | Signification |
|-----------|--------------|
| ==  | Égal à |
| !=  | Différent de |
| >   | Supérieur à |
| <   | Inférieur à |
| >=  | Supérieur ou égal |
| <=  | Inférieur ou égal |

### Opérateurs logiques

\`\`\`python
age = 20
if age >= 18 and age < 65:
    print("Adulte actif")

if age < 18 or age >= 65:
    print("Tarif réduit")

if not (age == 0):
    print("Pas un nouveau-né")
\`\`\`` },

      { title:'Boucles for', desc:'Répéter des actions avec for.', dur:15,
        content:`## Boucle for

### Itérer sur une séquence

\`\`\`python
# Itérer sur une liste
fruits = ["pomme", "banane", "orange"]
for fruit in fruits:
    print(fruit)

# Itérer sur une plage de nombres
for i in range(5):
    print(i)   # 0, 1, 2, 3, 4

# range(start, stop, step)
for i in range(1, 10, 2):
    print(i)   # 1, 3, 5, 7, 9
\`\`\`

### enumerate() — index + valeur

\`\`\`python
langages = ["Python", "JavaScript", "C++"]
for i, lang in enumerate(langages, start=1):
    print(f"{i}. {lang}")
# 1. Python
# 2. JavaScript
# 3. C++
\`\`\`

### break et continue

\`\`\`python
for i in range(10):
    if i == 3:
        continue   # Sauter i=3
    if i == 7:
        break      # Arrêter à i=7
    print(i)
\`\`\`` },
    ],

    4: [ // Fonctions
      { title:'Définir une fonction', desc:'Créer des fonctions réutilisables.', dur:20,
        content:`## Définir une fonction

### Syntaxe de base

\`\`\`python
def saluer(nom):
    """Affiche un message de bienvenue."""
    message = f"Bonjour, {nom} !"
    return message

resultat = saluer("Sergys")
print(resultat)   # Bonjour, Sergys !
\`\`\`

### Paramètres par défaut

\`\`\`python
def puissance(base, exposant=2):
    return base ** exposant

print(puissance(3))      # 9  (exposant=2 par défaut)
print(puissance(3, 3))   # 27
\`\`\`

### *args et **kwargs

\`\`\`python
def somme(*nombres):
    return sum(nombres)

print(somme(1, 2, 3, 4))   # 10

def infos(**details):
    for cle, val in details.items():
        print(f"{cle} : {val}")

infos(nom="Sergys", ville="Lokossa", age=22)
\`\`\`` },
    ],

    7: [ // POO
      { title:'Classes et Objets', desc:'Introduction à la programmation orientée objet.', dur:25,
        content:`## Classes et Objets

### Créer une classe

\`\`\`python
class Etudiant:
    """Représente un étudiant."""

    # Attribut de classe (partagé)
    etablissement = "INSTI Lokossa"

    def __init__(self, nom, filiere):
        # Attributs d'instance
        self.nom = nom
        self.filiere = filiere
        self.notes = []

    def ajouter_note(self, note):
        self.notes.append(note)

    def moyenne(self):
        if not self.notes:
            return 0
        return sum(self.notes) / len(self.notes)

    def __str__(self):
        return f"Étudiant {self.nom} ({self.filiere})"


# Utilisation
s = Etudiant("Sergys", "Génie électrique")
s.ajouter_note(15)
s.ajouter_note(18)
print(s)                  # Étudiant Sergys (Génie électrique)
print(s.moyenne())        # 16.5
print(s.etablissement)    # INSTI Lokossa
\`\`\`` },
    ],
  };

  db.transaction(() => {
    for (const [i, m] of modules.entries()) {
      const { lastInsertRowid: mid } = insertModule.run(m.title, m.desc, m.level, m.order);
      const lessons = lessonData[i + 1] || [];
      for (const [j, l] of lessons.entries()) {
        const { lastInsertRowid: lid } = insertLesson.run(mid, l.title, l.desc, l.content, l.dur, j + 1);
        // Ajouter des exercices pour les premières leçons
        if (mid === 1 && j === 1) { // Syntaxe de base
          insertExercise.run(lid,
            'Premier print()',
            'Affichez le message : "Bonjour SergysPyLearn !"',
            '# Écrivez votre code ici\n',
            'print("Bonjour SergysPyLearn !")',
            'Bonjour SergysPyLearn !',
            'easy',
            JSON.stringify(['Utilisez la fonction print()', 'Le texte doit être entre guillemets']),
            1
          );
          insertExercise.run(lid,
            'Commentaire et print',
            'Ajoutez un commentaire puis affichez votre prénom.',
            '# Ajoutez un commentaire ici\n# Puis affichez votre prénom\n',
            '# Mon premier commentaire\nprint("Sergys")',
            'Sergys',
            'easy',
            JSON.stringify(['Les commentaires commencent par #']),
            2
          );
        }
        if (mid === 3 && j === 0) { // Conditions
          insertExercise.run(lid,
            'Pair ou Impair',
            'Écrivez une fonction qui affiche si un nombre est pair ou impair.',
            'def pair_ou_impair(n):\n    # Votre code ici\n    pass\n\nprint(pair_ou_impair(4))\nprint(pair_ou_impair(7))',
            'def pair_ou_impair(n):\n    if n % 2 == 0:\n        return "pair"\n    else:\n        return "impair"\n\nprint(pair_ou_impair(4))\nprint(pair_ou_impair(7))',
            'pair\nimpair',
            'easy',
            JSON.stringify(['Utilisez l\'opérateur modulo %', 'Si n % 2 == 0, c\'est pair']),
            1
          );
        }
      }
    }
  })();

  console.log('✅ Base de données initialisée avec', modules.length, 'modules');
}

seedDatabase();

/* ── MIDDLEWARE AUTH ────────────────────────────────────────────────── */
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: 'Non authentifié' });
}

/* ── ROUTES AUTH ────────────────────────────────────────────────────── */
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  const APP_PASSWORD = process.env.APP_PASSWORD || 'sergyspython2026';
  if (password === APP_PASSWORD) {
    req.session.authenticated = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Mot de passe incorrect.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

/* ── ROUTES STATS ───────────────────────────────────────────────────── */
app.get('/api/stats', requireAuth, (req, res) => {
  const totalModules   = db.prepare('SELECT COUNT(*) as n FROM modules').get().n;
  const totalLessons   = db.prepare('SELECT COUNT(*) as n FROM lessons').get().n;
  const totalExercises = db.prepare('SELECT COUNT(*) as n FROM exercises').get().n;
  res.json({ totalModules, totalLessons, totalExercises });
});

/* ── ROUTES MODULES ─────────────────────────────────────────────────── */
app.get('/api/modules', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, COUNT(l.id) as lessonsCount
    FROM modules m
    LEFT JOIN lessons l ON l.module_id = m.id
    GROUP BY m.id
    ORDER BY m.sort_order
  `).all();
  res.json(rows);
});

app.get('/api/modules/:id', requireAuth, (req, res) => {
  const m = db.prepare('SELECT * FROM modules WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Module introuvable' });
  res.json(m);
});

app.get('/api/modules/:id/lessons', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT l.*, COUNT(e.id) as exercisesCount
    FROM lessons l
    LEFT JOIN exercises e ON e.lesson_id = l.id
    WHERE l.module_id = ?
    GROUP BY l.id
    ORDER BY l.sort_order
  `).all(req.params.id);
  res.json(rows);
});

/* ── ROUTES LESSONS ─────────────────────────────────────────────────── */
app.get('/api/lessons/:id', requireAuth, (req, res) => {
  const l = db.prepare(`
    SELECT l.*, m.level,
      (SELECT COUNT(*) FROM exercises e WHERE e.lesson_id = l.id) as exercisesCount,
      (SELECT id FROM lessons WHERE module_id = l.module_id AND sort_order < l.sort_order ORDER BY sort_order DESC LIMIT 1) as prevLessonId,
      (SELECT id FROM lessons WHERE module_id = l.module_id AND sort_order > l.sort_order ORDER BY sort_order ASC  LIMIT 1) as nextLessonId
    FROM lessons l JOIN modules m ON m.id = l.module_id
    WHERE l.id = ?
  `).get(req.params.id);
  if (!l) return res.status(404).json({ error: 'Leçon introuvable' });
  res.json(l);
});

/* ── ROUTES EXERCISES ───────────────────────────────────────────────── */
app.get('/api/lessons/:id/exercises', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM exercises WHERE lesson_id = ? ORDER BY sort_order').all(req.params.id);
  rows.forEach(r => { try { r.hints = JSON.parse(r.hints); } catch { r.hints = []; } });
  res.json(rows);
});

app.post('/api/exercises/:id/check', requireAuth, (req, res) => {
  const ex = db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id);
  if (!ex) return res.status(404).json({ error: 'Exercice introuvable' });

  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code manquant' });

  // Vérification basée sur l'output attendu (exécution côté client via Pyodide)
  // Ici on vérifie que le code contient les éléments clés de la solution
  const expected = ex.expected_output.trim();
  const solution = ex.solution_code.trim();

  // Feedback intelligent basé sur la solution
  let correct = false;
  let feedback = '';

  // Vérification par mots-clés de la solution
  const solutionKeywords = solution
    .split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => l.trim().replace(/\s+/g, ' '))
    .filter(l => l.length > 3);

  const codeNorm = code.replace(/\s+/g, ' ').toLowerCase();
  const matchCount = solutionKeywords.filter(kw =>
    codeNorm.includes(kw.toLowerCase().replace(/\s+/g, ' '))
  ).length;

  if (matchCount >= Math.ceil(solutionKeywords.length * 0.6)) {
    correct = true;
    feedback = '✅ Excellent ! Votre solution est correcte.';
  } else if (matchCount > 0) {
    feedback = `Vous êtes sur la bonne voie ! Vérifiez la logique de votre solution.`;
  } else {
    feedback = `Ce n'est pas tout à fait ça. Relisez l'énoncé et consultez l'indice si besoin.`;
  }

  res.json({ correct, feedback, expectedOutput: expected });
});

/* ── ROUTES PROGRESS ────────────────────────────────────────────────── */
app.get('/api/progress', requireAuth, (req, res) => {
  const totalModules   = db.prepare('SELECT COUNT(*) as n FROM modules').get().n;
  const totalLessons   = db.prepare('SELECT COUNT(*) as n FROM lessons').get().n;
  const totalExercises = db.prepare('SELECT COUNT(*) as n FROM exercises').get().n;

  const levelBreakdown = db.prepare(`
    SELECT level,
      COUNT(*) as totalModules,
      0 as completedModules
    FROM modules
    GROUP BY level
    ORDER BY CASE level WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 ELSE 3 END
  `).all();

  res.json({ totalModules, totalLessons, totalExercises, levelBreakdown });
});

/* ── ROUTES RESOURCES / PDF ─────────────────────────────────────────── */
app.get('/api/resources', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM resources ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/resources', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier PDF requis.' });
  const { title, description, category } = req.body;
  if (!title) return res.status(400).json({ error: 'Le titre est requis.' });

  const { lastInsertRowid: id } = db.prepare(
    'INSERT INTO resources (title,description,filename,category) VALUES (?,?,?,?)'
  ).run(title, description || '', req.file.filename, category || 'general');

  res.status(201).json({ id, filename: req.file.filename });
});

app.delete('/api/resources/:id', requireAuth, (req, res) => {
  const r = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Ressource introuvable' });
  try { fs.unlinkSync(path.join(UPLOADS_DIR, r.filename)); } catch {}
  db.prepare('DELETE FROM resources WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.get('/api/uploads/:filename', requireAuth, (req, res) => {
  const file = path.join(UPLOADS_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Fichier introuvable' });
  res.sendFile(file);
});

/* ── SANTÉ ──────────────────────────────────────────────────────────── */
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/', (req, res) => res.json({ name: 'SergysPyLearn API', version: '1.0.0' }));

/* ── DÉMARRAGE ──────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`🚀 SergysPyLearn API démarré sur le port ${PORT}`);
});

module.exports = app;
