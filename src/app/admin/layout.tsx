import LogoutButton from "./LogoutButton";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav
        style={{
          borderBottom: "1px solid var(--color-border)",
          padding: "0.9rem 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <strong>Blues Backroads Admin</strong>
        <LogoutButton />
      </nav>
      {children}
    </div>
  );
}
