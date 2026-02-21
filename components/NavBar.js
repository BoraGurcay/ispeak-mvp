"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/home", label: "Home" },
  { href: "/practice", label: "Practice" },
  { href: "/glossary", label: "Glossary" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <div className="nav">
      <div className="navInner">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={"navItem " + (active ? "navItemActive" : "")}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
