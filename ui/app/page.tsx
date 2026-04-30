import { AgentRegistrationForm } from "@/components/AgentRegistrationForm";

export default function Home() {
  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-1 flex-col items-center justify-center bg-slate-50 px-4 py-12 font-sans dark:bg-slate-950 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(15,23,42,0.04),transparent)] dark:bg-[radial-gradient(ellipse_80%_55%_at_50%_-10%,rgba(148,163,184,0.06),transparent)]"
        aria-hidden
      />
      <main className="relative w-full max-w-4xl flex-1 sm:flex-none sm:justify-center">
        <AgentRegistrationForm />
      </main>
    </div>
  );
}
