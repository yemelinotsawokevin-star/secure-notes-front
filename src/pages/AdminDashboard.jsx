import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function AdminDashboard() {
    const [users, setUsers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [showLogs, setShowLogs] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const navigate = useNavigate();
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    let user = {};
    try {
        user = JSON.parse(localStorage.getItem('user')) || {};
    } catch {
        user = {};
    }

    const token = localStorage.getItem('token');

    const authHeaders = {
        headers: {
            Authorization: `Bearer ${token}`
        }
    };

    const fetchUsers = async () => {
        try {
            setLoadingUsers(true);
            setErrorMessage('');

            const res = await axios.get(`${API_URL}/api/admin/users`, authHeaders);
            setUsers(res.data);
        } catch (err) {
            setErrorMessage(
                err.response?.data?.error || "Erreur lors du chargement des utilisateurs."
            );
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleBanUser = async (userId) => {
        setErrorMessage('');
        setSuccessMessage('');

        const confirmed = window.confirm("Voulez-vous vraiment bannir cet utilisateur ?");
        if (!confirmed) return;

        try {
            await axios.delete(`${API_URL}/api/admin/users/${userId}`, authHeaders);
            setSuccessMessage("Utilisateur supprimé avec succès.");
            fetchUsers();
        } catch (err) {
            setErrorMessage(
                err.response?.data?.error || "Erreur lors de la suppression de l'utilisateur."
            );
        }
    };

    const handleShowLogs = async () => {
        setErrorMessage('');
        setSuccessMessage('');

        try {
            setLoadingLogs(true);

            const res = await axios.get(`${API_URL}/api/admin/logs`, authHeaders);
            setLogs(res.data);
            setShowLogs(true);
        } catch (err) {
            setErrorMessage(
                err.response?.data?.error || "Erreur lors du chargement de l'historique."
            );
        } finally {
            setLoadingLogs(false);
        }
    };

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        if (user.role !== 'admin') {
            navigate('/dashboard');
            return;
        }

        fetchUsers();
    }, [token, navigate]);

    return (
        <div style={{ maxWidth: '950px', margin: '30px auto', padding: '20px' }}>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link to="/dashboard">
                    <button>Retour au tableau de bord</button>
                </Link>

                <button onClick={handleShowLogs} disabled={loadingLogs}>
                    {loadingLogs ? "Chargement de l'historique..." : "Voir l'historique"}
                </button>
            </div>

            <h2>Panneau d'administration</h2>

            {errorMessage && (
                <p style={{ color: 'red', marginTop: '10px' }}>{errorMessage}</p>
            )}

            {successMessage && (
                <p style={{ color: 'green', marginTop: '10px' }}>{successMessage}</p>
            )}

            <h3>Liste des utilisateurs</h3>

            {loadingUsers ? (
                <p>Chargement des utilisateurs...</p>
            ) : users.length === 0 ? (
                <p>Aucun utilisateur trouvé.</p>
            ) : (
                users.map((u) => (
                    <div
                        key={u.id}
                        style={{
                            border: '1px solid #ccc',
                            borderRadius: '8px',
                            margin: '12px 0',
                            padding: '14px',
                            backgroundColor: '#fff'
                        }}
                    >
                        <p><strong>ID :</strong> {u.id}</p>
                        <p><strong>Email :</strong> {u.email}</p>
                        <p><strong>Rôle :</strong> {u.role}</p>
                        <p><strong>Bio :</strong> {u.bio || 'Aucune bio'}</p>

                        <button
                            onClick={() => handleBanUser(u.id)}
                            style={{
                                marginTop: '10px',
                                backgroundColor: '#d93025',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 14px',
                                borderRadius: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            Bannir
                        </button>
                    </div>
                ))
            )}

            {showLogs && (
                <div
                    style={{
                        marginTop: '30px',
                        padding: '16px',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        backgroundColor: '#fafafa'
                    }}
                >
                    <h3>Historique des actions admin</h3>

                    {logs.length === 0 ? (
                        <p>Aucune action enregistrée pour le moment.</p>
                    ) : (
                        logs.map((line, index) => (
                            <p key={index} style={{ marginBottom: '8px' }}>
                                {line}
                            </p>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;