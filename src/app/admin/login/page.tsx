import LoginForm from "./LoginForm";
import AuthErrorHelp from "./AuthErrorHelp";

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
      {authError && (
        <div className="card">
          <p className="error-text">
            Your sign-in link didn&apos;t work. This can happen if it expired
            or was opened somewhere other than where it was requested.
          </p>
          <AuthErrorHelp authError={authError} />
        </div>
      )}
      <div className="card">
        <LoginForm />
      </div>
    </main>
  );
}
