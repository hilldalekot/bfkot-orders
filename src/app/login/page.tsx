"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Staff } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
export default function LoginPage() {
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    // Fetch staff list from Firestore
    const loadStaff = async () => {
      try {
        const q = query(collection(db, "staff"), orderBy("name"));
        const querySnapshot = await getDocs(q);
        const fetchedStaff: Staff[] = [];
        querySnapshot.forEach((doc) => {
          fetchedStaff.push({ name: doc.data().name, pin: doc.data().pin });
        });
        
        // Fallback to defaults if empty, just in case
        if (fetchedStaff.length === 0) {
          fetchedStaff.push({ name: "John", pin: "1111" }, { name: "Sarah", pin: "2222" }, { name: "Mike", pin: "3333" });
        }
        setStaffMembers(fetchedStaff);
      } catch (err) {
        console.error("Failed to load staff", err);
      }
    };
    loadStaff();

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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-slate-800 font-sans">
      <div className="w-full max-w-md bg-white p-6 sm:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
        
        {/* Admin Portal Link */}
        <a href="/admin" className="absolute top-5 right-5 text-xs text-sky-600 hover:text-sky-700 font-medium transition-colors z-20">
          Admin Portal &rarr;
        </a>

        {/* Subtle decorative background blur */}
        <div className="absolute top-[-50px] left-[-50px] w-32 h-32 bg-amber-100 rounded-full mix-blend-multiply filter blur-2xl opacity-70"></div>
        <div className="absolute bottom-[-50px] right-[-50px] w-32 h-32 bg-sky-100 rounded-full mix-blend-multiply filter blur-2xl opacity-70"></div>

        <div className="text-center mb-6 relative z-10 pt-2">
          <img 
            src="/logo.png" 
            alt="Hilldale Retreat Logo" 
            className="h-24 w-auto mx-auto mb-2 object-contain"
          />
          <h2 className="text-base text-[var(--accent-gold)] font-medium mb-3 tracking-widest uppercase">Breakfast KOT</h2>
          
          <h1 className="text-xl tracking-tight text-slate-900 font-semibold mb-1">Welcome Back</h1>
          <p className="text-slate-500 text-xs">Please select your name and enter your PIN</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3 flex justify-between items-end">
              <span>Select Name</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {staffMembers.length === 0 ? (
                <p className="text-xs text-slate-400 col-span-full text-center py-4">Loading staff...</p>
              ) : staffMembers.map((staff) => (
                <button
                  key={staff.name}
                  type="button"
                  onClick={() => {
                    setSelectedStaff(staff.name);
                    setError("");
                    setPin("");
                  }}
                  className={`py-3 px-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    selectedStaff === staff.name
                      ? "bg-slate-900 text-white shadow-md transform scale-[1.02]"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {staff.name}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-1">
            <div className="flex justify-center space-x-5 mb-4">
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i} 
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    pin.length > i ? "bg-slate-900 scale-110" : "bg-slate-200"
                  }`} 
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-y-2 gap-x-6 max-w-[220px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypadPress(num.toString())}
                  className="w-12 h-12 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xl font-medium mx-auto flex items-center justify-center transition-colors active:bg-slate-200"
                >
                  {num}
                </button>
              ))}
              <div className="col-start-2">
                <button
                  type="button"
                  onClick={() => handleKeypadPress("0")}
                  className="w-12 h-12 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xl font-medium mx-auto flex items-center justify-center transition-colors active:bg-slate-200"
                >
                  0
                </button>
              </div>
              <div className="col-start-3 flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-12 h-12 rounded-full text-slate-400 hover:text-slate-600 mx-auto flex items-center justify-center transition-colors active:bg-slate-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.375-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.211-.211.498-.33.796-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.796-.33z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="h-5 flex items-center justify-center mt-2">
            {error && <p className="text-red-500 text-xs font-medium animate-pulse">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={pin.length < 4 || !selectedStaff}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-medium py-3 rounded-xl tracking-wide transition-all shadow-md disabled:shadow-none mt-2 text-sm"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
