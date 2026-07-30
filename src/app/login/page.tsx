"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Staff } from "@/types";

export default function LoginPage() {
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    // Fetch staff list
    fetch("/api/staff")
      .then(res => res.json())
      .then(data => {
        if (data.staff) setStaffMembers(data.staff);
      })
      .catch(err => console.error("Failed to load staff", err));

    // If already logged in, redirect to home
    const staff = localStorage.getItem("staffName");
    if (staff) {
      router.push("/");
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedStaff) {
      setError("Please select your name.");
      return;
    }

    const staff = staffMembers.find((s) => s.name === selectedStaff);
    if (!staff || staff.pin !== pin) {
      setError("Invalid PIN.");
      setPin("");
      return;
    }

    localStorage.setItem("staffName", staff.name);
    router.push("/");
  };

  const handleKeypadPress = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-[var(--stone-900)] flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-md bg-[var(--stone-800)] p-8 rounded-2xl shadow-2xl border border-[var(--stone-700)]">
        <div className="text-center mb-8">
          <h1 className="text-2xl tracking-widest text-[var(--accent-gold)] uppercase font-semibold mb-2">Hilldale Retreat</h1>
          <p className="text-[var(--stone-400)] text-sm">Staff Login Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[var(--stone-300)] mb-2 flex justify-between items-end">
              <span>Select Name</span>
              <a href="/admin" className="text-xs text-[var(--stone-500)] hover:text-[var(--accent-gold)] transition-colors">Admin Portal</a>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {staffMembers.length === 0 ? (
                <p className="text-xs text-[var(--stone-500)] col-span-3 text-center py-2">Loading staff...</p>
              ) : staffMembers.map((staff) => (
                <button
                  key={staff.name}
                  type="button"
                  onClick={() => {
                    setSelectedStaff(staff.name);
                    setError("");
                    setPin("");
                  }}
                  className={`py-3 rounded-lg border text-sm font-medium transition-colors ${
                    selectedStaff === staff.name
                      ? "bg-[var(--accent-gold)] border-[var(--accent-gold)] text-[var(--stone-900)]"
                      : "bg-[var(--stone-700)] border-[var(--stone-600)] text-[var(--stone-300)] hover:bg-[var(--stone-600)]"
                  }`}
                >
                  {staff.name}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <label className="block text-sm font-medium text-[var(--stone-300)] mb-2 text-center">Enter 4-Digit PIN</label>
            <div className="flex justify-center space-x-4 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className={`w-4 h-4 rounded-full transition-colors ${
                    pin.length > i ? "bg-[var(--accent-gold)]" : "bg-[var(--stone-600)]"
                  }`} 
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypadPress(num.toString())}
                  className="w-16 h-16 rounded-full bg-[var(--stone-700)] hover:bg-[var(--stone-600)] text-xl font-medium mx-auto flex items-center justify-center transition-colors active:scale-95"
                >
                  {num}
                </button>
              ))}
              <div className="col-start-2">
                <button
                  type="button"
                  onClick={() => handleKeypadPress("0")}
                  className="w-16 h-16 rounded-full bg-[var(--stone-700)] hover:bg-[var(--stone-600)] text-xl font-medium mx-auto flex items-center justify-center transition-colors active:scale-95"
                >
                  0
                </button>
              </div>
              <div className="col-start-3 flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-16 h-16 rounded-full text-[var(--stone-400)] hover:text-white mx-auto flex items-center justify-center transition-colors active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center font-medium mt-4">{error}</p>}

          <button
            type="submit"
            disabled={pin.length < 4 || !selectedStaff}
            className="w-full mt-8 bg-[var(--accent-gold)] hover:bg-[#c9a059] disabled:bg-[var(--stone-700)] disabled:text-[var(--stone-500)] text-[var(--stone-900)] font-semibold py-4 rounded-xl tracking-wider transition-colors uppercase text-sm"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}
