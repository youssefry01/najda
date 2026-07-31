"use client";

import { useState, useRef, useEffect } from "react";
//import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import { useLogout } from "@/hooks/useLogout";
import AuthDropdown from "./AuthDropdown";
import LogoHorizontal from "../ui/LogoHorizontal";

export default function Header() {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const dropdownWrapperRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();
  const logout = useLogout();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownWrapperRef.current &&
        !dropdownWrapperRef.current.contains(e.target as Node)
      ) {
        setDropdownVisible(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setDropdownVisible(false);
    await logout();
  }

  return (
    <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#171717] sticky top-0 z-50">
      <div className="flex justify-between items-center px-4 md:px-8 py-2 max-w-7xl mx-auto h-16">
        <div className="flex items-center gap-6">
        <Link href="/">
          <LogoHorizontal />
        </Link>

          <nav className="hidden md:flex items-center gap-5">
            {/* role-specific nav links go here once routes exist */}
          </nav>
        </div>

        <div className="flex items-center gap-3">

          {user ? (
            <div className="relative" ref={dropdownWrapperRef}>
              <div className="flex h-10 overflow-hidden rounded-xl border border-slate-300/80 bg-slate-50 shadow-sm transition-all hover:shadow-md">
                <span className="flex items-center px-4 text-sm font-semibold text-slate-700 select-none transition-colors hover:bg-slate-100">{user.firstName} {user.lastName || user.email}</span>
                <button
                  type="button"
                  onClick={() => setDropdownVisible((prev) => !prev)}
                  className="flex items-center justify-center border-l border-slate-300/70 px-3 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      dropdownVisible ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>
              {dropdownVisible && <AuthDropdown user={user} logout={handleLogout} />}
            </div>
          ) : (
            <div className="relative" ref={dropdownWrapperRef}>
              <div className="flex h-10 overflow-hidden rounded-xl border border-slate-300/80 bg-slate-50 shadow-sm transition-all hover:shadow-md">
                <Link
                  href="/login"
                  className="flex items-center px-4 text-sm font-semibold text-slate-700 select-none transition-colors hover:bg-slate-100"
                >
                  Login
                </Link>

                <button
                  type="button"
                  onClick={() => setDropdownVisible((prev) => !prev)}
                  className="flex items-center justify-center border-l border-slate-300/70 px-3 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      dropdownVisible ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>
              {dropdownVisible && <AuthDropdown user={null} logout={handleLogout} />}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}