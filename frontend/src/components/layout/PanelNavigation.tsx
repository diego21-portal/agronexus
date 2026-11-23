import { useEffect, useId, useState } from "react";
import { NavLink, useLocation } from "react-router";

interface PanelNavigationProps {
  label: string;
  links: { to: string; label: string; end?: boolean }[];
}

export function PanelNavigation({ label, links }: PanelNavigationProps) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <aside className="h-fit min-w-0 rounded-2xl border border-agro-line bg-white p-2 xl:sticky xl:top-32">
      <button
        type="button"
        aria-controls={id}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left font-semibold text-agro-forest hover:bg-agro-mist xl:hidden"
      >
        {label} <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <nav id={id} aria-label={label} className={`space-y-1 ${open ? "block" : "hidden"} xl:block`}>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold ${isActive
              ? "bg-agro-mist text-agro-forest underline underline-offset-4"
              : "text-agro-muted hover:bg-agro-paper hover:text-agro-forest"}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
