import LoginForm from "./LoginForm";

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { auth_error?: string };
}) {
  const authError = searchParams.auth_error;

  return (
    <main className="page" style={{ maxWidth: 420 }}>
      <h1>Admin Login</h1>
      <p className="subtitle">Sign in to manage event submissions.</p>
      {authError && <p className="error-text">Sign-in link failed: {authError}</p>}
      <div className="card">
        <LoginForm />
      </div>
    </main>
  );
}
