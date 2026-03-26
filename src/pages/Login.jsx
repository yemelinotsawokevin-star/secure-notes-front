import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        const cleanEmail = email.trim().toLowerCase();
        const cleanPassword = password.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!cleanEmail || !cleanPassword) {
            setErrorMessage("Veuillez remplir tous les champs.");
            return;
        }

        if (!emailRegex.test(cleanEmail)) {
            setErrorMessage("Veuillez entrer une adresse email valide.");
            return;
        }

        if (cleanPassword.length < 6) {
            setErrorMessage("Le mot de passe doit contenir au moins 6 caractères.");
            return;
        }

        try {
            setLoading(true);

            const response = await axios.post(`${API_URL}/api/auth/login`, {
                email: cleanEmail,
                password: cleanPassword
            });

            localStorage.setItem('user', JSON.stringify(response.data.user));
            localStorage.setItem('token', response.data.token);

            navigate('/dashboard');
        } catch (error) {
            console.error("Erreur de connexion :", error);

            setErrorMessage(
                error.response?.data?.error || "Une erreur est survenue lors de la connexion."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2 className="login-title">Connexion</h2>

                <form onSubmit={handleLogin}>
                    <div className="login-group">
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="Entrez votre email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="login-group">
                        <label>Mot de passe</label>
                        <input
                            type="password"
                            placeholder="Entrez votre mot de passe"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {errorMessage && (
                        <p className="login-error">{errorMessage}</p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="login-button"
                    >
                        {loading ? 'Connexion...' : 'Se connecter'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;