import Link from "next/link";
import LogoIcon from "../ui/LogoIcon";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const links = [
    { label: "System Status", href: "/status" },
    { label: "API Documentation", href: "/docs" },
    { label: "Contact Support", href: "/support" },
  ];

  return (

    <footer className="w-full bg-(--color-bg) border-t border-[#e5e7eb] dark:border-slate-800 px-6 py-8">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/">
          <LogoIcon />
        </Link>

        <div className="flex gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors dark:text-white dark:hover:text-slate-300"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <p className="text-sm text-slate-500 text-text-muted">
          &copy; {currentYear} NAJDA Team. All rights reserved.
        </p>
      </div>
    </footer>
  );
}