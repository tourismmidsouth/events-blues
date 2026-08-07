import LoginForm from "./LoginForm";

export default function AdminLoginPage() {
  return (
    <main className="page" style={{ maxWidth: 420 }}>
      <h1>Admin Login</h1>
      <p className="subtitle">Sign in to manage event submissions.</p>
      <div className="card">
        <LoginForm />
      </div>
    </main>
  );
}
