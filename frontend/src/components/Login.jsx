import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { useState } from 'react';

export default function Login() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');

  return (
    <div className="center-screen">
      <div className="card login-card">
        <div className="brand-mark">M</div>
        <h1>Mutabaah</h1>
        <p className="tagline">Your daily amal, tracked with your halaqah.</p>

        <div className="google-btn-wrap">
          <GoogleLogin
            onSuccess={(credentialResponse) => {
              setError('');
              loginWithGoogle(credentialResponse.credential).catch(() =>
                setError('Sign-in failed. Please try again.')
              );
            }}
            onError={() => setError('Sign-in failed. Please try again.')}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 14 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
