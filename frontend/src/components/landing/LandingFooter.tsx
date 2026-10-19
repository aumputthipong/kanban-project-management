export function LandingFooter() {
  return (
    <footer lang="en" className="bg-slate-900 text-slate-100 px-6 md:px-12 pt-16 pb-10">
      <div className="max-w-2xl mx-auto flex flex-col items-center text-center">
        <p className="text-2xl md:text-3xl font-bold tracking-tight">Turtask</p>

        <p className="mt-5 max-w-md text-sm text-slate-400 leading-relaxed">
          A real-time Kanban workspace for small teams — drag a card, assign a teammate, and watch the
          board sync instantly.
        </p>

        <div className="mt-8 w-12 h-px bg-slate-700" />

        <p className="mt-6 text-xs text-slate-400">© {new Date().getFullYear()} Turtask. All rights reserved.</p>
      </div>
    </footer>
  );
}
