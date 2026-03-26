const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '../security.log');

// Fonction de log sécurité
function logSecurityEvent(message) {
    const line = `[${new Date().toISOString()}] ${message}\n`;

    fs.appendFile(logFilePath, line, (err) => {
        if (err) {
            console.error("Erreur écriture security.log :", err.message);
        }
    });
}

// Middleware : vérification rôle admin
const isAdmin = (req, res, next) => {

    // Vérifie que req.user existe
    if (!req.user) {
        logSecurityEvent("Accès admin refusé : utilisateur non authentifié");
        return res.status(401).json({ error: "Utilisateur non authentifié" });
    }

    // Vérifie que le rôle existe
    if (!req.user.role) {
        logSecurityEvent(`Accès admin refusé : rôle manquant pour user ID ${req.user.id}`);
        return res.status(403).json({ error: "Accès refusé" });
    }

    // Vérifie le rôle admin
    if (req.user.role !== 'admin') {
        logSecurityEvent(
            `Accès admin refusé pour ${req.user.email} (ID: ${req.user.id}, rôle: ${req.user.role})`
        );
        return res.status(403).json({ error: "Accès refusé : admin seulement" });
    }

    next();
};

module.exports = isAdmin;