require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');
const { body, validationResult } = require('express-validator');

const app = express();
const db = require('./database');
const authMiddleware = require('./middleware/auth');
const isAdmin = require('./middleware/isAdmin');

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET manquant dans le fichier .env");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const securityLogPath = path.join(__dirname, 'security.log');
const adminActionsLogPath = path.join(__dirname, 'admin_actions.log');

app.use(helmet());

app.use(cors({
  origin: FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: false
}));

app.use(express.json());

function logSecurityEvent(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;

  fs.appendFile(securityLogPath, line, (err) => {
    if (err) {
      console.error("Erreur écriture security.log :", err.message);
    }
  });
}

function logAdminAction(message) {
  const line = `[${new Date().toISOString()}] - ${message}\n`;

  fs.appendFile(adminActionsLogPath, line, (err) => {
    if (err) {
      console.error("Erreur écriture admin_actions.log :", err.message);
    }
  });
}

function cleanPlainText(value) {
  return sanitizeHtml(value || '', {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: "Trop de tentatives de connexion. Veuillez patienter 15 minutes avant de réessayer."
  }
});

const adminDeleteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: {
    error: "Limite atteinte : maximum 3 suppressions en 15 minutes."
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    let { email, password } = req.body;

    email = cleanPlainText(email).toLowerCase();
    password = typeof password === 'string' ? password.trim() : '';

    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Email invalide" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères" });
    }

    const checkQuery = `SELECT id FROM users WHERE email = ?`;

    db.get(checkQuery, [email], async (err, existingUser) => {
      if (err) {
        console.error("Erreur vérification email :", err.message);
        return res.status(500).json({ error: "Erreur serveur" });
      }

      if (existingUser) {
        return res.status(409).json({ error: "Cet email existe déjà" });
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const insertQuery = `
          INSERT INTO users (email, password, role, failed_attempts, bio)
          VALUES (?, ?, ?, ?, ?)
        `;

        db.run(insertQuery, [email, hashedPassword, 'user', 0, ''], function (insertErr) {
          if (insertErr) {
            console.error("Erreur insertion utilisateur :", insertErr.message);
            return res.status(500).json({ error: "Erreur lors de l'inscription" });
          }

          logSecurityEvent(`Inscription réussie pour ${email}`);

          return res.status(201).json({
            message: "Utilisateur créé avec succès",
            userId: this.lastID
          });
        });
      } catch (hashError) {
        console.error("Erreur bcrypt register :", hashError.message);
        return res.status(500).json({ error: "Erreur lors du hachage du mot de passe" });
      }
    });
  } catch (error) {
    console.error("Erreur register :", error.message);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  let { email, password } = req.body;

  email = cleanPlainText(email).toLowerCase();
  password = typeof password === 'string' ? password.trim() : '';

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Email invalide" });
  }

  const query = `SELECT * FROM users WHERE email = ?`;

  db.get(query, [email], async (err, user) => {
    if (err) {
      console.error("Erreur login SQL :", err.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    if (!user) {
      logSecurityEvent(`Tentative de connexion avec email inconnu : ${email}`);
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    if (user.failed_attempts >= 3) {
      logSecurityEvent(`Compte bloqué pour ${email}`);
      return res.status(403).json({ error: "Compte bloqué après plusieurs tentatives échouées" });
    }

    try {
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        db.run(
          `UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?`,
          [user.id],
          (updateErr) => {
            if (updateErr) {
              console.error("Erreur mise à jour failed_attempts :", updateErr.message);
            }
          }
        );

        logSecurityEvent(`Échec de connexion pour ${email}`);
        return res.status(401).json({ error: "Identifiants incorrects" });
      }

      db.run(
        `UPDATE users SET failed_attempts = 0 WHERE id = ?`,
        [user.id],
        (resetErr) => {
          if (resetErr) {
            console.error("Erreur reset failed_attempts :", resetErr.message);
          }
        }
      );

      const payload = {
        id: user.id,
        email: user.email,
        role: user.role
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '1h'
      });

      const safeUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        bio: user.bio || ''
      };

      logSecurityEvent(`Connexion réussie pour ${email}`);

      return res.json({
        user: safeUser,
        token
      });
    } catch (compareError) {
      console.error("Erreur bcrypt login :", compareError.message);
      return res.status(500).json({ error: "Erreur serveur" });
    }
  });
});

app.post('/api/notes', authMiddleware, (req, res) => {
  const cleanContent = cleanPlainText(req.body.content);

  if (!cleanContent) {
    return res.status(400).json({ error: "Le contenu de la note est requis" });
  }

  const insertQuery = `INSERT INTO notes (content, authorId) VALUES (?, ?)`;

  db.run(insertQuery, [cleanContent, req.user.id], function (err) {
    if (err) {
      console.error("Erreur ajout note :", err.message);
      return res.status(500).json({ error: "Erreur lors de l'ajout de la note" });
    }

    return res.status(201).json({
      message: "Note ajoutée avec succès",
      noteId: this.lastID
    });
  });
});

app.get('/api/notes', authMiddleware, (req, res) => {
  const query = `SELECT id, content, authorId FROM notes WHERE authorId = ? ORDER BY id DESC`;

  db.all(query, [req.user.id], (err, rows) => {
    if (err) {
      console.error("Erreur récupération notes :", err.message);
      return res.status(500).json({ error: "Erreur lors de la récupération des notes" });
    }

    return res.json(rows);
  });
});

app.delete('/api/notes/:id', authMiddleware, (req, res) => {
  const noteId = Number(req.params.id);

  if (!Number.isInteger(noteId) || noteId <= 0) {
    return res.status(400).json({ error: "Identifiant de note invalide" });
  }

  const deleteQuery = `DELETE FROM notes WHERE id = ? AND authorId = ?`;

  db.run(deleteQuery, [noteId, req.user.id], function (err) {
    if (err) {
      console.error("Erreur suppression note :", err.message);
      return res.status(500).json({ error: "Erreur lors de la suppression" });
    }

    if (this.changes === 0) {
      return res.status(403).json({ error: "Note introuvable ou accès interdit" });
    }

    return res.json({ message: "Note supprimée avec succès" });
  });
});

app.put(
  '/api/users/:id',
  authMiddleware,
  body('email')
    .trim()
    .isEmail()
    .withMessage("Email invalide"),
  body('bio')
    .optional({ values: 'undefined' })
    .isString()
    .withMessage("La bio doit être un texte"),
  (req, res) => {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "Identifiant utilisateur invalide" });
    }

    if (req.user.id !== userId) {
      logSecurityEvent(`Tentative de modification du profil d'un autre utilisateur par ${req.user.email}`);
      return res.status(403).json({ error: "Accès interdit : vous ne pouvez modifier que votre propre profil" });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array()[0].msg
      });
    }

    const cleanEmail = cleanPlainText(req.body.email).toLowerCase();
    const cleanBio = sanitizeHtml(req.body.bio || '', {
      allowedTags: ['b', 'i', 'em', 'strong', 'u', 'br', 'p'],
      allowedAttributes: {}
    }).trim();

    db.get(
      `SELECT id FROM users WHERE email = ? AND id != ?`,
      [cleanEmail, userId],
      (checkErr, existingUser) => {
        if (checkErr) {
          console.error("Erreur vérification email profil :", checkErr.message);
          return res.status(500).json({ error: "Erreur serveur" });
        }

        if (existingUser) {
          return res.status(409).json({ error: "Cet email est déjà utilisé par un autre utilisateur" });
        }

        db.run(
          `UPDATE users SET email = ?, bio = ? WHERE id = ?`,
          [cleanEmail, cleanBio, userId],
          function (updateErr) {
            if (updateErr) {
              console.error("Erreur mise à jour profil :", updateErr.message);
              return res.status(500).json({ error: "Erreur lors de la mise à jour du profil" });
            }

            return res.json({
              message: "Profil mis à jour avec succès",
              user: {
                id: userId,
                email: cleanEmail,
                bio: cleanBio,
                role: req.user.role
              }
            });
          }
        );
      }
    );
  }
);

app.get(
  '/api/admin/users',
  authMiddleware,
  isAdmin,
  (req, res) => {
    db.all(
      `SELECT id, email, role, bio FROM users ORDER BY id ASC`,
      [],
      (err, rows) => {
        if (err) {
          console.error("Erreur récupération utilisateurs admin :", err.message);
          return res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs" });
        }

        return res.json(rows);
      }
    );
  }
);

app.delete(
  '/api/admin/users/:id',
  authMiddleware,
  isAdmin,
  adminDeleteLimiter,
  (req, res) => {
    const targetUserId = Number(req.params.id);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ error: "Identifiant utilisateur invalide" });
    }

    if (targetUserId === req.user.id) {
      return res.status(403).json({ error: "Un administrateur ne peut pas se supprimer lui-même" });
    }

    db.get(
      `SELECT id, role FROM users WHERE id = ?`,
      [targetUserId],
      (findErr, targetUser) => {
        if (findErr) {
          console.error("Erreur recherche utilisateur à supprimer :", findErr.message);
          return res.status(500).json({ error: "Erreur serveur" });
        }

        if (!targetUser) {
          return res.status(404).json({ error: "Utilisateur introuvable" });
        }

        db.run(
          `DELETE FROM notes WHERE authorId = ?`,
          [targetUserId],
          function (deleteNotesErr) {
            if (deleteNotesErr) {
              console.error("Erreur suppression notes utilisateur :", deleteNotesErr.message);
              return res.status(500).json({ error: "Erreur lors de la suppression des notes associées" });
            }

            db.run(
              `DELETE FROM users WHERE id = ?`,
              [targetUserId],
              function (deleteUserErr) {
                if (deleteUserErr) {
                  console.error("Erreur suppression utilisateur :", deleteUserErr.message);
                  return res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur" });
                }

                if (this.changes === 0) {
                  return res.status(404).json({ error: "Utilisateur introuvable" });
                }

                logAdminAction(`L'admin ${req.user.id} a supprimé l'utilisateur ${targetUserId}`);

                return res.json({
                  message: "Utilisateur supprimé avec succès"
                });
              }
            );
          }
        );
      }
    );
  }
);

app.get(
  '/api/admin/logs',
  authMiddleware,
  isAdmin,
  (req, res) => {
    fs.readFile(adminActionsLogPath, 'utf8', (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          return res.json([]);
        }

        console.error("Erreur lecture admin_actions.log :", err.message);
        return res.status(500).json({ error: "Erreur lors de la lecture des logs admin" });
      }

      const lines = data
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      return res.json(lines);
    });
  }
);

app.use((req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur Back-end démarré sur http://localhost:${PORT}`);
});