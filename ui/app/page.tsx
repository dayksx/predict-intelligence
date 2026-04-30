import { AgentRegistrationForm } from "@/components/AgentRegistrationForm";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col px-4 py-16 sm:px-8">
        <AgentRegistrationForm />
      </main>
    </div>
  );
}
