import { GoogleLogin } from '@react-oauth/google';
import { BookOpen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDelayedFlag } from '../hooks/useDelayedFlag';
import { useState } from 'react';

export default function Login() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const slow = useDelayedFlag(signingIn);

  return (
    <div className="center-screen">
      <div className="card login-card">
        <div className="brand-mark">
          <BookOpen size={20} />
        </div>
        <h1>Double 4 Flat</h1>
        <p className="tagline">Your daily amal, tracked with your halaqah.</p>

        {signingIn ? (
          <div className="boot" style={{ gap: 10 }}>
            <div className="spinner" />
            <p className="boot-hint visible" aria-live="polite">
              {slow ? 'Waking up the server… this can take up to a minute the first time.' : 'Signing you in…'}
            </p>
          </div>
        ) : (
          <div className="google-btn-wrap">
            <GoogleLogin
              onSuccess={(credentialResponse) => {
                setError('');
                setSigningIn(true);
                loginWithGoogle(credentialResponse.credential).catch(() => {
                  setSigningIn(false);
                  setError('Sign-in failed. Please try again.');
                });
              }}
              onError={() => setError('Sign-in failed. Please try again.')}
            />
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 14 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
