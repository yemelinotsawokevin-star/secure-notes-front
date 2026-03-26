import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Dashboard() {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [email, setEmail] = useState('');
    const [bio, setBio] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loadingNotes, setLoadingNotes] = useState(true);
    const [submittingNote, setSubmittingNote] = useState(false);
    const [updatingProfile, setUpdatingProfile] = useState(false);

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

    const fetchNotes = async () => {
        try {
            setLoadingNotes(true);
            setErrorMessage('');

            const res = await axios.get(`${API_URL}/api/notes`, authHeaders);
            setNotes(res.data);
        } catch (err) {
            setErrorMessage(
                err.response?.data?.error || "Erreur lors du chargement des notes."
            );
        } finally {
            setLoadingNotes(false);
        }
    };

    useEffect(() => {
        if (!token) {
            navigate('/login');
            return;
        }

        setEmail(user.email || '');
        setBio(user.bio || '');
        fetchNotes();
    }, [token, navigate]);

    const handleAddNote = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        const cleanNote = newNote.trim();

        if (!cleanNote) {
            setErrorMessage("La note ne peut pas être vide.");
            return;
        }

        try {
            setSubmittingNote(true);

            await axios.post(
                `${API_URL}/api/notes`,
                { content: cleanNote },
                authHeaders
            );

            setNewNote('');
            setSuccessMessage("Note ajoutée avec succès.");
            fetchNotes();
        } catch (err) {
            setErrorMessage(
                err.response?.data?.error || "Erreur lors de l'ajout de la note."
            );
        } finally {
            setSubmittingNote(false);
        }
    };

    const handleDelete = async (noteId) => {
        setErrorMessage('');
        setSuccessMessage('');

        try {
            await axios.delete(`${API_URL}/api/notes/${noteId}`, authHeaders);
            setSuccessMessage("Note supprimée avec succès.");
            fetchNotes();
        } catch (err) {
            setErrorMessage(
                err.response?.data?.error || "Erreur lors de la suppression."
            );
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        const cleanEmail = email.trim().toLowerCase();
        const cleanBio = bio;

        if (!cleanEmail) {
            setErrorMessage("L'email est requis.");
            return;
        }

        try {
            setUpdatingProfile(true);

            const res = await axios.put(
                `${API_URL}/api/users/${user.id}`,
                {
                    email: cleanEmail,
                    bio: cleanBio
                },
                authHeaders
            );

            const updatedUser = {
                ...user,
                ...res.data.user
            };

            localStorage.setItem('user', JSON.stringify(updatedUser));
            setEmail(updatedUser.email || '');
            setBio(updatedUser.bio || '');
            setSuccessMessage('Profil mis à jour avec succès.');
        } catch (err) {
            setErrorMessage(
                err.response?.data?.error || "Erreur lors de la mise à jour du profil."
            );
        } finally {
            setUpdatingProfile(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div style={{ maxWidth: '800px', margin: '30px auto', padding: '20px' }}>
            <button onClick={handleLogout} style={{ marginBottom: '15px' }}>
                Déconnexion
            </button>

            {user.role === 'admin' && (
                <div style={{ marginBottom: '15px' }}>
                    <Link to="/admin">
                        <button>Panneau d'administration</button>
                    </Link>
                </div>
            )}

            <h2>Tableau de bord de {email || 'Utilisateur'}</h2>

            {errorMessage && (
                <p style={{ color: 'red', marginTop: '10px' }}>{errorMessage}</p>
            )}

            {successMessage && (
                <p style={{ color: 'green', marginTop: '10px' }}>{successMessage}</p>
            )}

            <form onSubmit={handleProfileUpdate} style={{ marginBottom: '20px' }}>
                <h3>Mon profil</h3>

                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Mon email"
                    style={{
                        width: '100%',
                        padding: '10px',
                        marginBottom: '10px',
                        boxSizing: 'border-box'
                    }}
                    required
                />

                <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Ma bio"
                    rows="4"
                    style={{
                        width: '100%',
                        padding: '10px',
                        boxSizing: 'border-box'
                    }}
                />

                <br />
                <button
                    type="submit"
                    disabled={updatingProfile}
                    style={{ marginTop: '10px' }}
                >
                    {updatingProfile ? 'Mise à jour...' : 'Mettre à jour mon profil'}
                </button>
            </form>

            <form onSubmit={handleAddNote} style={{ marginBottom: '20px' }}>
                <h3>Ajouter une note</h3>
                <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Écrire une nouvelle note"
                    rows="4"
                    style={{
                        width: '100%',
                        padding: '10px',
                        boxSizing: 'border-box'
                    }}
                    required
                />
                <br />
                <button
                    type="submit"
                    disabled={submittingNote}
                    style={{ marginTop: '10px' }}
                >
                    {submittingNote ? 'Ajout...' : 'Ajouter la note'}
                </button>
            </form>

            <div>
                <h3>Mes notes</h3>

                {loadingNotes ? (
                    <p>Chargement des notes...</p>
                ) : notes.length === 0 ? (
                    <p>Aucune note pour le moment.</p>
                ) : (
                    notes.map((note) => (
                        <div
                            key={note.id}
                            style={{
                                border: '1px solid #ccc',
                                borderRadius: '8px',
                                margin: '10px 0',
                                padding: '12px'
                            }}
                        >
                            <p>{note.content}</p>
                            <button
                                onClick={() => handleDelete(note.id)}
                                style={{ color: 'red', marginTop: '10px' }}
                            >
                                Supprimer
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default Dashboard;