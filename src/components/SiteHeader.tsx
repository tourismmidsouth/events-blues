import Link from "next/link";

export default function SiteHeader() {
  return (
    <nav
      style={{
        borderBottom: "1px solid var(--color-border)",
        padding: "0.6rem 1.25rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.75rem",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.squarespace-cdn.com/content/v1/6a4e488ced46b83c3154160c/5d3dbd4d-6ae6-4e6c-8f19-eca33b9226f9/blues-backroads-logo.png"
          alt="Blues Backroads"
          style={{ height: 36, width: "auto" }}
        />
      </Link>
      <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
        <Link href="/">Home</Link>
        <Link href="/submit-event">Submit an Event</Link>
        <a href="https://bluesbackroads.com/events">All Events</a>
      </div>
    </nav>
  );
}
