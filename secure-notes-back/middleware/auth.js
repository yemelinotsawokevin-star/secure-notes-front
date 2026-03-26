const jwt = require('jsonwebtoken');

// Middleware : vérification du token JWT
const verifyToken = (req, res, next) => {

    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET manquant !");
        return res.status(500).json({ error: "Erreur serveur" });
    }

    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Accès refusé : token manquant ou invalide" });
    }

    const token = authHeader.split(' ')[1]?.trim();

    if (!token) {
        return res.status(401).json({ error: "Token manquant" });
    }

    try {
        const decodedUser = jwt.verify(token, process.env.JWT_SECRET);

        if (!decodedUser.id || !decodedUser.email || !decodedUser.role) {
            return res.status(403).json({ error: "Token invalide (contenu incorrect)" });
        }

        // 🔥 Freeze pour éviter modification côté code
        req.user = Object.freeze({
            id: decodedUser.id,
            email: decodedUser.email,
            role: decodedUser.role
        });

        next();

    } catch (err) {

        if (err.name === 'TokenExpiredError') {
            return res.status(403).json({ error: "Token expiré" });
        }

        if (err.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: "Token invalide" });
        }

        console.error("Erreur JWT :", err.message);
        return res.status(500).json({ error: "Erreur serveur" });
    }
};

module.exports = verifyToken;