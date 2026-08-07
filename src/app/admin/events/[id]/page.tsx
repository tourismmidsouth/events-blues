import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditEventForm from "./EditEventForm";
import type { EventRecord } from "@/lib/events";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("*").eq("id", id).single();

  if (error || !data) {
    notFound();
  }

  return (
    <main className="page">
      <h1>Edit Event</h1>
      <p className="subtitle">Update details, then save your changes.</p>
      <div className="card">
        <EditEventForm event={data as EventRecord} />
      </div>
    </main>
  );
}
