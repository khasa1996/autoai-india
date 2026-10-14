"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X, UserRound } from "lucide-react";
const links = [
  ["Explore cars", "/explore"],
  ["Digital showroom", "/showroom"],
  ["Car advisor", "/advisor"],
  ["Compare", "/compare"],
  ["My garage", "/garage"],
];
export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="AutoAI India home">
          AUTOAI<span>INDIA</span>
        </Link>
        <nav aria-label="Main navigation" className="desktop-nav">
          {links.map(([title, url]) => (
            <Link
              key={url}
              href={url}
              aria-current={path === url ? "page" : undefined}
            >
              {title}
            </Link>
          ))}
        </nav>
        <Link className="account-link" href="/account">
          <UserRound size={17} />
          <span>My account</span>
        </Link>
        <button
          className="menu-toggle icon-button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      {open && (
        <nav
          id="mobile-nav"
          className="mobile-nav"
          aria-label="Mobile navigation"
        >
          {[
            ...links,
            ["Plan your budget", "/finance"],
            ["Track a booking", "/tracking"],
            ["Dealer portal", "/dealer"],
            ["Support", "/support"],
          ].map(([title, url]) => (
            <Link href={url} key={url}>
              {title}
              <ArrowUpRight size={18} />
            </Link>
          ))}
        </nav>
      )}
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="footer-top">
          <Link href="/" className="wordmark">
            AUTOAI<span>INDIA</span>
          </Link>
          <p>A clearer road to your next car.</p>
          <Link href="/support">
            Let’s talk <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="footer-links">
          <div>
            <span>Discover</span>
            <Link href="/explore">Explore cars</Link>
            <Link href="/manufacturers">Manufacturers</Link>
            <Link href="/showroom">Digital showroom</Link>
            <Link href="/news">Automotive news</Link>
          </div>
          <div>
            <span>Your journey</span>
            <Link href="/advisor">Car advisor</Link>
            <Link href="/finance">EMI & ownership</Link>
            <Link href="/exchange">Exchange your car</Link>
            <Link href="/tracking">Track a booking</Link>
          </div>
          <div>
            <span>For partners</span>
            <Link href="/dealer">Dealer portal</Link>
            <Link href="/admin">Administration</Link>
            <Link href="/studio">Asset studio</Link>
            <Link href="/about">About AutoAI India</Link>
            <Link href="/terms">Terms & asset policy</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            Independent by design. AutoAI India facilitates discovery and
            booking requests; authorized dealerships remain responsible for
            vehicle sales. Showcase media and 3D assets are original, unbranded
            concepts unless a record identifies a reviewed third-party source
            and permitted use.
          </p>
          <span>© {new Date().getFullYear()} AutoAI India</span>
        </div>
      </footer>
    </>
  );
}
