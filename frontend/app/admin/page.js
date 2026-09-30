'use client';

import { useState, useEffect } from 'react';
import { isAuthenticated, getStoredUser, fetchCurrentUser } from '../../services/authService';
import AdminLoginForm from '../../components/AdminLoginForm';
import AdminDashboard from '../../components/AdminDashboard';

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // Al montar: verificar si ya hay una sesión persistida válida
  useEffect(() => {
    const verifySession = async () => {
      if (isAuthenticated()) {
        // Intentar verificar contra el backend (valida que el token no haya expirado)
        const currentUser = await fetchCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
        // Si fetchCurrentUser devuelve null, ya limpió el storage → muestra login
      }
      setChecking(false);
    };

    verifySession();
  }, []);

  if (checking) {
    return (
      <div className="admin-checking">
        <div className="admin-spinner admin-spinner--lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <AdminLoginForm
        onLoginSuccess={(userData) => setUser(userData)}
      />
    );
  }

  return (
    <AdminDashboard
      user={user}
      onLogout={() => setUser(null)}
    />
  );
}
