import React from 'react';

const LoginPage: React.FC = () => {
  const handleLogin = () => {
    // Use relative URL since frontend and backend are on same domain via Apache
    window.location.href = '/rssreader/auth/google';
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1>RSS Reader</h1>
        <p>Sign in to manage your RSS feeds and stay updated</p>
        <button onClick={handleLogin} className="login-button">
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
