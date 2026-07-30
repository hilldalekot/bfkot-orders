"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Staff } from "@/types";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, deleteDoc, getDocs, query, orderBy, getDoc } from "firebase/firestore";

const DEFAULT_MASTER_PIN = "9999";
export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterPin, setMasterPin] = useState("");
  const [staffMembers, setStaffMembers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Form states
  const [editingStaff, setEditingStaff] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  
  // Master PIN change states
  const [newMasterPin, setNewMasterPin] = useState("");
  const [isChangingMasterPin, setIsChangingMasterPin] = useState(false);
  const [masterPinSuccess, setMasterPinSuccess] = useState("");

  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      fetchStaff();
    }
  }, [isAuthenticated]);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "staff"), orderBy("name"));
      const querySnapshot = await getDocs(q);
      const fetchedStaff: Staff[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedStaff.push({ name: docSnap.data().name, pin: docSnap.data().pin });
      });
      setStaffMembers(fetchedStaff);
    } catch (err) {
      setError("Failed to fetch staff");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const docSnap = await getDoc(doc(db, "settings", "admin"));
      let currentMasterPin = DEFAULT_MASTER_PIN;
      
      if (docSnap.exists() && docSnap.data().masterPin) {
        currentMasterPin = docSnap.data().masterPin;
      }
      
      if (masterPin === currentMasterPin) {
        setIsAuthenticated(true);
        setError("");
      } else {
        setError("Invalid Master PIN");
        setMasterPin("");
      }
    } catch (err) {
      setError("Failed to verify PIN. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeMasterPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMasterPinSuccess("");

    if (newMasterPin.length !== 4 || isNaN(Number(newMasterPin))) {
      setError("Master PIN must be exactly 4 digits");
      return;
    }

    try {
      setIsChangingMasterPin(true);
      await setDoc(doc(db, "settings", "admin"), { masterPin: newMasterPin }, { merge: true });
      setMasterPinSuccess("Master PIN successfully updated!");
      setNewMasterPin("");
    } catch (err: any) {
      setError(err.message || "Failed to update Master PIN");
    } finally {
      setIsChangingMasterPin(false);
    }
  };

  const resetForm = () => {
    setEditingStaff(null);
    setNameInput("");
    setPinInput("");
    setError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!nameInput || !pinInput) {
      setError("Name and PIN are required");
      return;
    }

    if (pinInput.length !== 4 || isNaN(Number(pinInput))) {
      setError("PIN must be exactly 4 digits");
      return;
    }

    try {
      if (editingStaff && editingStaff !== nameInput) {
        // If name changed, check if new name already exists
        const newDocSnap = await getDoc(doc(db, "staff", nameInput.toLowerCase()));
        if (newDocSnap.exists()) {
          throw new Error("Staff member with this name already exists");
        }
        // Delete old doc
        await deleteDoc(doc(db, "staff", editingStaff.toLowerCase()));
      } else if (!editingStaff) {
        // If new staff, check if exists
        const docSnap = await getDoc(doc(db, "staff", nameInput.toLowerCase()));
        if (docSnap.exists()) {
          throw new Error("Staff member with this name already exists");
        }
      }

      // Save or update doc using lowercased name as ID
      await setDoc(doc(db, "staff", nameInput.toLowerCase()), {
        name: nameInput,
        pin: pinInput
      });

      await fetchStaff();
      resetForm();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      await deleteDoc(doc(db, "staff", name.toLowerCase()));
      await fetchStaff();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--stone-900)] flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-full max-w-sm bg-[var(--stone-800)] p-8 rounded-2xl shadow-2xl border border-[var(--stone-700)]">
          <div className="text-center mb-6">
            <h1 className="text-xl tracking-widest text-red-400 uppercase font-semibold mb-2">Admin Portal</h1>
            <p className="text-[var(--stone-400)] text-sm">Enter Master PIN to access</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-6">
            <input 
              type="password" 
              inputMode="numeric"
              maxLength={4}
              value={masterPin}
              onChange={(e) => setMasterPin(e.target.value)}
              className="w-full bg-[var(--stone-700)] border border-[var(--stone-600)] rounded-lg px-4 py-3 text-center text-2xl tracking-[1em] text-white focus:outline-none focus:border-[var(--accent-gold)]"
              placeholder="••••"
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className={`w-full font-semibold py-3 rounded-lg transition-colors uppercase text-sm tracking-wider ${
                loading ? 'bg-[var(--stone-600)] text-[var(--stone-400)] cursor-not-allowed' : 'bg-[var(--accent-gold)] text-[var(--stone-900)] hover:bg-[#c9a059]'
              }`}
            >
              {loading ? 'Verifying...' : 'Unlock'}
            </button>
            <div className="text-center pt-2">
              <Link href="/login" className="text-xs text-[var(--stone-500)] hover:text-white transition-colors">&larr; Back to Login</Link>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--stone-50)] p-6 sm:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 flex justify-between items-end border-b border-[var(--stone-200)] pb-6">
          <div>
            <Link href="/login" className="inline-flex items-center space-x-1 text-sm font-medium text-[var(--stone-500)] hover:text-[var(--stone-900)] transition-colors mb-4">
              <span>&larr; Back to Login</span>
            </Link>
            <h1 className="text-3xl font-light text-[var(--stone-900)] tracking-wide">Staff Management</h1>
            <p className="text-[var(--stone-800)] mt-2 font-light">Add, edit, or remove staff members</p>
          </div>
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
          >
            Lock Admin
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-[var(--stone-200)]">
              <h2 className="text-lg font-medium text-[var(--stone-900)] mb-4 uppercase tracking-wider text-sm">
                {editingStaff ? "Edit Staff" : "Add New Staff"}
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--stone-500)] uppercase tracking-wider mb-1">Name</label>
                  <input 
                    type="text" 
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full bg-[var(--stone-50)] border border-[var(--stone-200)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)]"
                    placeholder="e.g. David"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--stone-500)] uppercase tracking-wider mb-1">4-Digit PIN</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[var(--stone-50)] border border-[var(--stone-200)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)] tracking-widest font-mono"
                    placeholder="1234"
                  />
                </div>
                
                {error && <p className="text-red-500 text-xs font-medium">{error}</p>}
                
                <div className="flex space-x-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-[var(--stone-900)] text-white text-xs font-semibold uppercase tracking-wider py-2 rounded-lg hover:bg-[var(--stone-800)] transition-colors"
                  >
                    Save
                  </button>
                  {editingStaff && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 bg-[var(--stone-200)] text-[var(--stone-800)] text-xs font-semibold uppercase tracking-wider py-2 rounded-lg hover:bg-[var(--stone-300)] transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--stone-200)] overflow-hidden">
              <div className="bg-[var(--stone-50)] px-6 py-4 border-b border-[var(--stone-200)]">
                <h2 className="text-sm font-medium text-[var(--stone-900)] uppercase tracking-wider">Current Staff</h2>
              </div>
              
              {loading ? (
                <div className="p-6 text-center text-sm text-[var(--stone-500)]">Loading...</div>
              ) : staffMembers.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--stone-500)]">No staff members found.</div>
              ) : (
                <ul className="divide-y divide-[var(--stone-100)]">
                  {staffMembers.map(staff => (
                    <li key={staff.name} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--stone-50)] transition-colors">
                      <div>
                        <p className="font-medium text-[var(--stone-900)]">{staff.name}</p>
                        <p className="text-xs text-[var(--stone-500)] font-mono tracking-widest mt-1">PIN: ****</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => {
                            setEditingStaff(staff.name);
                            setNameInput(staff.name);
                            setPinInput(staff.pin);
                            setError("");
                          }}
                          className="px-3 py-1 bg-[var(--stone-100)] hover:bg-[var(--stone-200)] text-[var(--stone-700)] text-xs font-medium rounded-md transition-colors"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(staff.name)}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-md transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
