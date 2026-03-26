require('dotenv').config();

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'securenotes.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Erreur lors de l'ouverture de la base :", err.message);
  } else {
    console.log("Connexion à la base SQLite réussie.");
  }
});

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`, (err) => {
    if (err) {
      console.error("Erreur activation clés étrangères :", err.message);
    }
  });

  db.run(
    `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      bio TEXT NOT NULL DEFAULT ''
    )
    `,
    (err) => {
      if (err) {
        console.error("Erreur création table users :", err.message);
      } else {
        console.log("Table users prête.");
        ensureUsersColumns(() => {
          createAdminUser();
        });
      }
    }
  );

  db.run(
    `
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      authorId INTEGER NOT NULL,
      FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
    )
    `,
    (err) => {
      if (err) {
        console.error("Erreur création table notes :", err.message);
      } else {
        console.log("Table notes prête.");
      }
    }
  );
});

function ensureUsersColumns(callback) {
  db.all(`PRAGMA table_info(users)`, [], (err, columns) => {
    if (err) {
      console.error("Erreur lecture structure users :", err.message);
      return;
    }

    const names = columns.map((col) => col.name);
    const tasks = [];

    if (!names.includes('role')) {
      tasks.push((next) => {
        db.run(
          `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`,
          (alterErr) => {
            if (alterErr) {
              console.error("Erreur ajout colonne role :", alterErr.message);
            } else {
              console.log("Colonne role ajoutée.");
            }
            next();
          }
        );
      });
    }

    if (!names.includes('failed_attempts')) {
      tasks.push((next) => {
        db.run(
          `ALTER TABLE users ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0`,
          (alterErr) => {
            if (alterErr) {
              console.error("Erreur ajout colonne failed_attempts :", alterErr.message);
            } else {
              console.log("Colonne failed_attempts ajoutée.");
            }
            next();
          }
        );
      });
    }

    if (!names.includes('bio')) {
      tasks.push((next) => {
        db.run(
          `ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''`,
          (alterErr) => {
            if (alterErr) {
              console.error("Erreur ajout colonne bio :", alterErr.message);
            } else {
              console.log("Colonne bio ajoutée.");
            }
            next();
          }
        );
      });
    }

    runTasksSequentially(tasks, callback);
  });
}

function runTasksSequentially(tasks, done) {
  let index = 0;

  function next() {
    if (index >= tasks.length) {
      if (done) done();
      return;
    }

    const task = tasks[index];
    index += 1;
    task(next);
  }

  next();
}

function createAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@test.com';
  const adminPlainPassword = process.env.ADMIN_PASSWORD || 'azerty';
  const adminRole = 'admin';

  db.get(
    `SELECT id FROM users WHERE email = ?`,
    [adminEmail],
    async (err, row) => {
      if (err) {
        console.error("Erreur vérification admin :", err.message);
        return;
      }

      if (row) {
        console.log("L'utilisateur admin existe déjà.");
        return;
      }

      try {
        const hashedPassword = await bcrypt.hash(adminPlainPassword, 10);

        db.run(
          `INSERT INTO users (email, password, role, failed_attempts, bio) VALUES (?, ?, ?, ?, ?)`,
          [adminEmail, hashedPassword, adminRole, 0, ''],
          (insertErr) => {
            if (insertErr) {
              console.error("Erreur insertion admin :", insertErr.message);
            } else {
              console.log("Utilisateur admin ajouté avec succès.");
            }
          }
        );
      } catch (hashErr) {
        console.error("Erreur hash bcrypt admin :", hashErr.message);
      }
    }
  );
}

module.exports = db;