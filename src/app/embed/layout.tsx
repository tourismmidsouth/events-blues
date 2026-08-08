// Every /embed/* page is meant to sit inside someone else's page (an
// iframe on Squarespace), so it should never paint its own background —
// otherwise it shows up as a visibly different-colored rectangle rather
// than blending into the surrounding page. This overrides the app-wide
// body background (set in globals.css) for this route segment only.
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`body { background: transparent !important; }`}</style>
      {children}
    </>
  );
}
