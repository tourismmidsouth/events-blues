import SubmitEventForm from "./SubmitEventForm";

export default function SubmitEventPage() {
  return (
    <main className="page">
      <h1>Submit a Blues Backroads Event</h1>
      <p className="subtitle">
        Fill out the form below to submit an event for review. Approved events
        will appear in the public gallery.
      </p>
      <div className="card">
        <SubmitEventForm />
      </div>
    </main>
  );
}
