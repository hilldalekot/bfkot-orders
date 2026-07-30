"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [staffName, setStaffName] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const staff = localStorage.getItem("staffName");
    if (!staff) {
      router.push("/login");
    } else {
      setStaffName(staff);
    }
  }, [router]);

  if (!staffName) return null; // Or a loading spinner

  const handleLogout = () => {
    localStorage.removeItem("staffName");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--stone-50)] flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-6 right-6 flex items-center space-x-4">
        <span className="text-sm font-medium text-[var(--stone-800)]">Logged in as: {staffName}</span>
        <button 
          onClick={handleLogout}
          className="text-sm text-[var(--accent-gold)] hover:text-[var(--stone-900)] transition-colors font-semibold"
        >
          Logout
        </button>
      </div>
      
      <div className="text-center mb-12">
        <h1 className="text-4xl font-light text-[var(--stone-900)] tracking-wide mb-4">Hilldale Retreat</h1>
        <p className="text-[var(--stone-800)] font-light">Breakfast Ordering System</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
        <Link href="/menu" className="block group">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-[var(--stone-200)] hover:border-[var(--accent-gold)] transition-colors h-full flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[var(--stone-100)] rounded-full flex items-center justify-center mb-6 group-hover:bg-[var(--accent-gold)] group-hover:text-white transition-colors">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-[var(--stone-900)] mb-2">Guest Menu</h2>
            <p className="text-sm text-[var(--stone-800)]">Scan QR or visit to place an order</p>
          </div>
        </Link>

        <Link href="/kitchen" className="block group">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-[var(--stone-200)] hover:border-[var(--accent-gold)] transition-colors h-full flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[var(--stone-100)] rounded-full flex items-center justify-center mb-6 group-hover:bg-[var(--accent-gold)] group-hover:text-white transition-colors">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-[var(--stone-900)] mb-2">Kitchen Dashboard</h2>
            <p className="text-sm text-[var(--stone-800)]">View and manage incoming orders</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
