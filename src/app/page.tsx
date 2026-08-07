import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <h1>Blues Backroads Events</h1>
      <p className="subtitle">Submit an event or manage submissions.</p>
      <div className="card" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Link href="/submit-event">
          <button className="primary">Submit an Event</button>
        </Link>
        <Link href="/admin/login">
          <button className="secondary">Admin Login</button>
        </Link>
        <Link href="/embed/events/gallery">
          <button className="secondary">View Public Gallery</button>
        </Link>
      </div>
    </main>
  );
}
