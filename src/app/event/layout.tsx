export default function EventLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`body { background: #ffffff !important; }`}</style>
      {children}
    </>
  );
}
