"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/home", label: "Home" },
  { href: "/practice", label: "Practice" },
  { href: "/play", label: "Play" },
  { href: "/glossary", label: "Glossary" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const pathname = usePathname();

  const isActive = (href) => {
    if (!pathname) return false;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="nav">
      <div className="navInner">
        {items.map((it) => {
          const active = isActive(it.href);

          return (
            <Link
              key={it.href}
              href={it.href}
              className={"navItem " + (active ? "navItemActive" : "")}
              aria-current={active ? "page" : undefined}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}