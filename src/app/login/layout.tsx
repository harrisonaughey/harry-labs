export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#0a0a0f" }}
    >
      {children}
    </div>
  );
}
