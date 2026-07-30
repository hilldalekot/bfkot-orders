"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Order, OrderStatus } from "@/types";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs, where } from "firebase/firestore";
const ROOM_NUMBERS = ["101", "102", "103", "201", "202", "301", "302"];
const DEFAULT_STARTERS: Record<string, number> = {
  "Buns": 1,
  "Cakes": 1,
  "Fruit Platter": 1,
  "Mixed Fruit Juice": 1,
  "Pastries": 1,
  "Waffles with Treacle": 2,
  "Yoghurt": 1,
};

export default function KitchenDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [occupancy, setOccupancy] = useState<Record<string, { occupied: boolean; guests: number; kids?: number }>>({});
  const [extraMeals, setExtraMeals] = useState<{ drivers: number; staff: number }>({ drivers: 0, staff: 0 });

  useEffect(() => {
    const q = query(collection(db, "orders"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      const now = new Date();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<Order, 'id'>;
        const bTime = new Date(data.breakfastTime);
        const createdTime = new Date(data.createdAt);
        
        const cutoffBreakfast = new Date(bTime);
        cutoffBreakfast.setHours(14, 0, 0, 0);

        const cutoffCreated = new Date(createdTime);
        if (createdTime.getHours() >= 14) {
          cutoffCreated.setDate(cutoffCreated.getDate() + 1);
        }
        cutoffCreated.setHours(14, 0, 0, 0);
        
        const actualCutoff = cutoffBreakfast > cutoffCreated ? cutoffBreakfast : cutoffCreated;
        
        if (now > actualCutoff) {
          // Delete expired order
          deleteDoc(doc(db, "orders", docSnap.id)).catch(console.error);
        } else {
          fetchedOrders.push({ id: docSnap.id, ...data });
        }
      });
      setOrders(fetchedOrders);
      setLoading(false);
    }, (error) => {
      console.error("Failed to fetch orders", error);
      setLoading(false);
    });
    
    // Load occupancy
    const stored = localStorage.getItem("kitchenOccupancy");
    if (stored) {
      try {
        setOccupancy(JSON.parse(stored));
      } catch (e) {}
    } else {
      const defaultOcc = ROOM_NUMBERS.reduce((acc, rm) => {
        acc[rm] = { occupied: false, guests: 2, kids: 0 };
        return acc;
      }, {} as Record<string, { occupied: boolean; guests: number; kids?: number }>);
      setOccupancy(defaultOcc);
    }
    
    // Load extra meals
    const storedMeals = localStorage.getItem("kitchenExtraMeals");
    if (storedMeals) {
      try {
        setExtraMeals(JSON.parse(storedMeals));
      } catch (e) {}
    }
    
    return () => unsubscribe();
  }, []);

  const updateOccupancy = (room: string, field: 'occupied' | 'guests' | 'kids', value: any) => {
    setOccupancy(prev => {
      const next = { ...prev, [room]: { ...prev[room], [field]: value } };
      localStorage.setItem("kitchenOccupancy", JSON.stringify(next));
      return next;
    });
  };

  const updateExtraMeals = (field: 'drivers' | 'staff', value: number) => {
    setExtraMeals(prev => {
      const next = { ...prev, [field]: value };
      localStorage.setItem("kitchenExtraMeals", JSON.stringify(next));
      return next;
    });
  };

  const generateProductionSummary = () => {
    const starterCounts: Record<string, number> = {};
    const packedCounts: Record<string, number> = {};
    let packedExtrasCount = 0;
    let driverPackedCount = 0;

    ROOM_NUMBERS.forEach(room => {
      const roomOrders = orders.filter(o => o.roomNumber === room);
      const roomOcc = occupancy[room];

      if (roomOrders.length > 0) {
        // Driver packed breakfasts for this room
        const driverPacked = roomOrders[0].driverPackedBreakfasts || 0;
        driverPackedCount += driverPacked;
        packedExtrasCount += driverPacked; // They also need extras
        
        // Explicit order
        roomOrders.forEach(order => {
          if (order.isPackedBreakfast && order.packedSandwichChoice) {
            packedCounts[order.packedSandwichChoice] = (packedCounts[order.packedSandwichChoice] || 0) + 1;
            packedExtrasCount += 1;
          } else if (order.starters) {
            order.starters.forEach(s => {
              const starterName = (s === "Fruit Platter" && order.isKidFruitPlatter) ? "Fruit Platter (Kid's Portion)" : s;
              const qty = s === "Waffles with Treacle" ? 2 : 1;
              starterCounts[starterName] = (starterCounts[starterName] || 0) + qty;
            });
          }
        });
      } else if (roomOcc?.occupied) {
        // No order, but occupied -> Default Starters
        const guests = roomOcc.guests || 2;
        const kids = roomOcc.kids || 0;
        Object.entries(DEFAULT_STARTERS).forEach(([starter, qtyPerGuest]) => {
          starterCounts[starter] = (starterCounts[starter] || 0) + (guests * qtyPerGuest);
        });
        
        if (kids > 0) {
          const kidStarter = "Fruit Platter (Kid's Portion)";
          starterCounts[kidStarter] = (starterCounts[kidStarter] || 0) + kids;
        }
      }
    });

    return { starters: starterCounts, packed: packedCounts, extras: packedExtrasCount, driverPacked: driverPackedCount };
  };

  const shareSummaryWhatsApp = () => {
    const { starters, packed, extras, driverPacked } = generateProductionSummary();
    let text = `*Kitchen Production Summary*\n_Date: ${new Date().toLocaleDateString()}_\n\n`;
    
    text += `*STARTERS (Dine-In)*\n`;
    const starterKeys = Object.keys(starters).sort();
    if (starterKeys.length === 0) {
      text += `_No starters required._\n`;
    } else {
      starterKeys.forEach(k => {
        text += `• ${k}: *${starters[k]}*\n`;
      });
    }
    
    const packedKeys = Object.keys(packed).sort();
    if (packedKeys.length > 0 || driverPacked > 0) {
      text += `\n*PACKED BREAKFASTS*\n`;
      
      // Group packed breakfasts by Room + Time
      const packedGroups = orders.reduce((acc, order) => {
        if (!order.isPackedBreakfast && !(order.driverPackedBreakfasts && order.driverPackedBreakfasts > 0)) {
          return acc;
        }
        const timeStr = order.breakfastTime ? new Date(order.breakfastTime).toLocaleString([], { timeStyle: 'short' }) : 'Time not specified';
        const key = `${order.roomNumber}|${timeStr}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(order);
        return acc;
      }, {} as Record<string, Order[]>);

      Object.keys(packedGroups).sort().forEach(key => {
        const [room, timeStr] = key.split('|');
        const groupOrders = packedGroups[key];
        
        text += `\n*Room ${room}, ${timeStr}*\n`;
        
        const roomPackedCounts: Record<string, number> = {};
        let driverPacked = 0;
        let driverNotes = "";
        
        groupOrders.forEach(o => {
          if (o.isPackedBreakfast && o.packedSandwichChoice) {
            roomPackedCounts[o.packedSandwichChoice] = (roomPackedCounts[o.packedSandwichChoice] || 0) + 1;
          }
          if (o.driverPackedBreakfasts && o.driverPackedBreakfasts > 0) {
            driverPacked = o.driverPackedBreakfasts;
            if (o.driverBreakfastNotes) driverNotes = o.driverBreakfastNotes;
          }
        });
        
        Object.keys(roomPackedCounts).sort().forEach(k => {
          text += `• ${k}: *${roomPackedCounts[k]}*\n`;
        });
        
        if (driverPacked > 0) {
          text += `• Driver sandwich: *${driverPacked}*`;
          if (driverNotes) {
            text += ` (${driverNotes})`;
          }
          text += `\n`;
        }
      });

      text += `\n*Grab-and-Go Bags Needed: ${extras}*\n`;
      text += `_(Each bag: 1 Banana, 1 Yoghurt, 1 Water)_\n`;
    }
    
    if (extraMeals.drivers > 0 || extraMeals.staff > 0) {
      text += `\n*EXTRA MEALS*\n`;
      if (extraMeals.drivers > 0) text += `• Driver Meals: *${extraMeals.drivers}*\n`;
      if (extraMeals.staff > 0) text += `• Staff Meals: *${extraMeals.staff}*\n`;
    }
    
    text += `\n_Includes actual orders + default menu for occupied rooms without orders._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const updateStatus = async (id: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(doc(db, "orders", id), { status: newStatus });
    } catch (err) {
      console.error("Failed to update order", err);
    }
  };

  const statusColors: Record<OrderStatus, string> = {
    Pending: "bg-amber-100 text-amber-800 border-amber-200",
    Preparing: "bg-blue-100 text-blue-800 border-blue-200",
    Completed: "bg-green-100 text-green-800 border-green-200",
  };

  const sendToWhatsApp = (roomNumber: string, roomOrders: Order[]) => {
    if (!roomOrders || roomOrders.length === 0) return;
    
    const timeFormatted = roomOrders[0].breakfastTime 
      ? new Date(roomOrders[0].breakfastTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : "Not specified";
      
    let text = `*Breakfast Order Update*\n`;
    text += `Room: ${roomNumber}\n`;
    text += `Time: ${timeFormatted}\n\n`;

    const sortedOrders = [...roomOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    sortedOrders.forEach((order) => {
      text += `*${order.guestName}*\n\n`;
      
      if (order.isPackedBreakfast) {
        text += `[PACKED BREAKFAST]\n`;
        text += `• ${order.packedSandwichChoice}\n`;
        text += `• Banana (1), Yoghurt (1), Bottle of Water (1)\n\n`;
      } else {
        text += `STARTERS\n`;
        if (order.starters && order.starters.length > 0) {
          order.starters.forEach(s => {
            if (s === "Fruit Platter" && order.isKidFruitPlatter) {
              text += `• Fruit Platter (Kid's Portion)\n`;
            } else {
              text += `• ${s}\n`;
            }
          });
        } else {
          text += `_None selected_\n`;
        }
        text += `\n`;
        
        text += `MAIN COURSE\n`;
        if (order.mains && order.mains.length > 0) {
          order.mains.forEach(m => {
            if (m === "Bread Toast") {
              let toastExtras = [];
              if (order.includesButter) toastExtras.push("Butter");
              if (order.includesJam) toastExtras.push("Jam");
              let extrasString = toastExtras.length > 0 ? `, ${toastExtras.join(', ')}` : "";
              text += `• Toast (${order.toastSlices || 4} slices${extrasString})\n`;
            } else {
              text += `• ${m}\n`;
            }
          });
        } else {
          text += `_No mains selected_\n`;
        }
        if (order.eggStyle) {
          let eggText = order.eggStyle;
          if (order.eggStyle === "Fried Egg" && order.friedEggStyle) {
            eggText += ` (${order.friedEggStyle})`;
          }
          text += `Eggs: *${eggText}*\n`;
        } else {
          text += `_No eggs selected_\n`;
        }
        text += `\n`;
        
        text += `BEVERAGE\n`;
        if (order.beverage) {
          text += `*${order.beverage} ${order.beverageIncludesMilk ? '(With Milk)' : '(Black / No Milk)'}*\n`;
        } else {
          text += `_No beverage selected_\n`;
        }
      }
      
      if (order.dietaryNotes) {
        text += `\n*Notes*: ${order.dietaryNotes}\n`;
      }
      text += `\n`;
    });
    
    if (roomOrders[0]?.driverPackedBreakfasts && roomOrders[0].driverPackedBreakfasts > 0) {
      text += `[DRIVER PACKED BREAKFASTS]\n`;
      text += `• Quantity: ${roomOrders[0].driverPackedBreakfasts}\n`;
      if (roomOrders[0].driverBreakfastNotes) {
        text += `• Notes: ${roomOrders[0].driverBreakfastNotes}\n`;
      }
      text += `\n`;
    }
    
    // We assume all orders for a room were placed by the same staff member at roughly the same time
    if (roomOrders[0]?.staffName) {
      const takenTime = roomOrders[0].createdAt 
        ? new Date(roomOrders[0].createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      
      text += `-------------------\n`;
      text += `_Order Taken By: ${roomOrders[0].staffName}_\n`;
      text += `_Taken At: ${takenTime}_\n`;
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[var(--stone-50)] p-6 sm:p-10">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex justify-between items-end border-b border-[var(--stone-200)] pb-6">
          <div>
            <Link href="/" className="inline-flex items-center space-x-1 text-sm font-medium text-[var(--stone-500)] hover:text-[var(--stone-900)] transition-colors mb-4">
              <span>&larr; Home</span>
            </Link>
            <h1 className="text-3xl font-light text-[var(--stone-900)] tracking-wide">Kitchen Dashboard</h1>
            <p className="text-[var(--stone-800)] mt-2 font-light">Real-time order monitoring</p>
          </div>
          <div className="text-sm font-medium text-[var(--stone-800)] flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span>Live updates active</span>
          </div>
        </header>

        {/* Production Summary Toggle */}
        <div className="mb-8 flex justify-end">
          <button 
            onClick={() => setShowSummary(!showSummary)}
            className="px-6 py-3 bg-[var(--stone-900)] hover:bg-[var(--stone-800)] text-white text-sm font-semibold uppercase tracking-wider rounded-xl transition-colors shadow-lg flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--accent-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{showSummary ? "Hide Production Summary" : "Show Production Summary"}</span>
          </button>
        </div>

        {showSummary && (
          <div className="mb-12 bg-white rounded-2xl shadow-xl border border-[var(--stone-200)] overflow-hidden">
            <div className="bg-[var(--stone-900)] p-6 text-white border-b border-[var(--accent-gold)]">
              <h2 className="text-2xl font-medium tracking-wide">Starter Production Summary</h2>
              <p className="text-[var(--stone-400)] text-sm mt-1">Calculates explicit orders + default breakfast menu for occupied rooms without orders.</p>
            </div>
            
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-10 bg-[var(--stone-50)]">
              {/* Room Occupancy Matrix */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-4 border-b border-[var(--stone-200)] pb-2">Room Occupancy</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROOM_NUMBERS.map(room => (
                    <div key={room} className="bg-white p-3 rounded-lg border border-[var(--stone-200)] flex flex-col space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={occupancy[room]?.occupied || false}
                            onChange={(e) => updateOccupancy(room, 'occupied', e.target.checked)}
                            className="w-4 h-4 text-[var(--accent-gold)] focus:ring-[var(--accent-gold)] rounded border-[var(--stone-300)]"
                          />
                          <span className="font-medium text-[var(--stone-900)]">Room {room}</span>
                        </label>
                        {orders.some(o => o.roomNumber === room) && (
                          <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">Ordered</span>
                        )}
                      </div>
                      
                      {occupancy[room]?.occupied && (
                        <div className="space-y-2 mt-2 pt-2 border-t border-[var(--stone-100)]">
                          <div className="flex items-center justify-between pl-6">
                            <span className="text-xs text-[var(--stone-500)]">Guests:</span>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => updateOccupancy(room, 'guests', Math.max(1, (occupancy[room].guests || 2) - 1))}
                                className="w-6 h-6 rounded bg-[var(--stone-100)] text-[var(--stone-600)] hover:bg-[var(--stone-200)] flex items-center justify-center font-medium"
                              >-</button>
                              <span className="text-sm font-medium w-4 text-center">{occupancy[room].guests || 2}</span>
                              <button 
                                onClick={() => updateOccupancy(room, 'guests', (occupancy[room].guests || 2) + 1)}
                                className="w-6 h-6 rounded bg-[var(--stone-100)] text-[var(--stone-600)] hover:bg-[var(--stone-200)] flex items-center justify-center font-medium"
                              >+</button>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pl-6">
                            <span className="text-xs text-[var(--stone-500)]">Kids:</span>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => updateOccupancy(room, 'kids', Math.max(0, (occupancy[room].kids || 0) - 1))}
                                className="w-6 h-6 rounded bg-[var(--stone-100)] text-[var(--stone-600)] hover:bg-[var(--stone-200)] flex items-center justify-center font-medium"
                              >-</button>
                              <span className="text-sm font-medium w-4 text-center">{occupancy[room].kids || 0}</span>
                              <button 
                                onClick={() => updateOccupancy(room, 'kids', (occupancy[room].kids || 0) + 1)}
                                className="w-6 h-6 rounded bg-[var(--stone-100)] text-[var(--stone-600)] hover:bg-[var(--stone-200)] flex items-center justify-center font-medium"
                              >+</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Extra Meals */}
                <div className="mt-8">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-4 border-b border-[var(--stone-200)] pb-2">Extra Meals</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white p-4 rounded-lg border border-[var(--stone-200)] flex items-center justify-between">
                      <span className="font-medium text-[var(--stone-900)]">Driver Meals</span>
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => updateExtraMeals('drivers', Math.max(0, extraMeals.drivers - 1))}
                          className="w-8 h-8 rounded-md bg-[var(--stone-100)] text-[var(--stone-600)] hover:bg-[var(--stone-200)] flex items-center justify-center font-medium"
                        >-</button>
                        <span className="text-base font-medium w-4 text-center">{extraMeals.drivers}</span>
                        <button 
                          onClick={() => updateExtraMeals('drivers', extraMeals.drivers + 1)}
                          className="w-8 h-8 rounded-md bg-[var(--stone-100)] text-[var(--stone-600)] hover:bg-[var(--stone-200)] flex items-center justify-center font-medium"
                        >+</button>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg border border-[var(--stone-200)] flex items-center justify-between">
                      <span className="font-medium text-[var(--stone-900)]">Staff Meals</span>
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => updateExtraMeals('staff', Math.max(0, extraMeals.staff - 1))}
                          className="w-8 h-8 rounded-md bg-[var(--stone-100)] text-[var(--stone-600)] hover:bg-[var(--stone-200)] flex items-center justify-center font-medium"
                        >-</button>
                        <span className="text-base font-medium w-4 text-center">{extraMeals.staff}</span>
                        <button 
                          onClick={() => updateExtraMeals('staff', extraMeals.staff + 1)}
                          className="w-8 h-8 rounded-md bg-[var(--stone-100)] text-[var(--stone-600)] hover:bg-[var(--stone-200)] flex items-center justify-center font-medium"
                        >+</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Aggregated Totals */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-4 border-b border-[var(--stone-200)] pb-2 flex justify-between items-end">
                  <span>Starters to Prepare</span>
                  <button 
                    onClick={shareSummaryWhatsApp}
                    className="text-xs text-[var(--accent-gold)] hover:text-[#c9a059] font-medium flex items-center space-x-1 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    <span>Share WhatsApp</span>
                  </button>
                </h3>
                
                <div className="bg-white rounded-xl shadow-sm border border-[var(--stone-200)] overflow-hidden">
                  {(() => {
                    const { starters, packed, extras, driverPacked } = generateProductionSummary();
                    const starterKeys = Object.keys(starters).sort();
                    const packedKeys = Object.keys(packed).sort();
                    
                    return (
                      <div className="divide-y divide-[var(--stone-100)]">
                        {/* Dine In Starters */}
                        <div className="p-4 bg-[var(--stone-900)] text-white">
                          <h4 className="font-medium text-sm tracking-widest uppercase text-[var(--accent-gold)]">Starters (Dine-In)</h4>
                        </div>
                        {starterKeys.length === 0 ? (
                           <div className="p-4 text-center text-[var(--stone-500)] text-sm italic">No starters to prepare.</div>
                        ) : (
                          <ul className="divide-y divide-[var(--stone-100)]">
                            {starterKeys.map(k => (
                              <li key={k} className="px-6 py-4 flex justify-between items-center hover:bg-[var(--stone-50)] transition-colors">
                                <span className="font-medium text-[var(--stone-900)]">{k}</span>
                                <span className="bg-[var(--accent-gold)] text-[var(--stone-900)] text-sm font-bold w-10 h-10 rounded-full flex items-center justify-center">
                                  {starters[k]}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Packed Breakfasts */}
                        {(packedKeys.length > 0 || driverPacked > 0) && (
                          <>
                            <div className="p-4 bg-[var(--stone-900)] text-white mt-4">
                              <h4 className="font-medium text-sm tracking-widest uppercase text-[var(--accent-gold)]">Packed Breakfasts</h4>
                            </div>
                            <ul className="divide-y divide-[var(--stone-100)]">
                              {packedKeys.map(k => (
                                <li key={k} className="px-6 py-4 flex justify-between items-center hover:bg-[var(--stone-50)] transition-colors">
                                  <span className="font-medium text-[var(--stone-900)]">{k}</span>
                                  <span className="bg-[var(--accent-gold)] text-[var(--stone-900)] text-sm font-bold w-10 h-10 rounded-full flex items-center justify-center">
                                    {packed[k]}
                                  </span>
                                </li>
                              ))}
                              {driverPacked > 0 && (
                                <li className="px-6 py-4 flex justify-between items-center hover:bg-[var(--stone-50)] transition-colors">
                                  <span className="font-medium text-[var(--stone-900)]">Driver Packed Sandwiches</span>
                                  <span className="bg-[var(--accent-gold)] text-[var(--stone-900)] text-sm font-bold w-10 h-10 rounded-full flex items-center justify-center">
                                    {driverPacked}
                                  </span>
                                </li>
                              )}
                              <li className="px-6 py-4 bg-blue-50 border-t border-blue-100">
                                <div className="text-sm text-blue-900">
                                  <span className="font-semibold">{extras} Grab-and-Go Bags</span> required.<br/>
                                  <span className="text-xs text-blue-800">Total: {extras} Bananas, {extras} Yoghurts, {extras} Water Bottles</span>
                                </div>
                              </li>
                            </ul>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-[var(--stone-800)]">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-[var(--stone-200)] shadow-sm">
            <h3 className="text-xl text-[var(--stone-900)] font-light">No Active Orders</h3>
            <p className="text-[var(--stone-800)] mt-2">Waiting for new requests...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(
              orders.reduce((acc, order) => {
                const isPacked = order.isPackedBreakfast ? 'packed' : 'dine-in';
                const timeStr = order.breakfastTime || 'notime';
                const groupKey = `${order.roomNumber}|${timeStr}|${isPacked}`;
                if (!acc[groupKey]) acc[groupKey] = [];
                acc[groupKey].push(order);
                return acc;
              }, {} as Record<string, Order[]>)
            ).sort((a, b) => {
              const ordersA = a[1];
              const ordersB = b[1];
              
              // 1. Sort by Dine-In vs Packed Breakfast
              const isPackedA = ordersA[0]?.isPackedBreakfast ? 1 : 0;
              const isPackedB = ordersB[0]?.isPackedBreakfast ? 1 : 0;
              if (isPackedA !== isPackedB) {
                return isPackedA - isPackedB;
              }
              
              // 2. Sort by Requested Time
              const timeA = ordersA[0]?.breakfastTime ? new Date(ordersA[0].breakfastTime).getTime() : 0;
              const timeB = ordersB[0]?.breakfastTime ? new Date(ordersB[0].breakfastTime).getTime() : 0;
              if (timeA !== timeB) {
                return timeA - timeB;
              }
              
              // 3. Fallback to room number
              return ordersA[0].roomNumber.localeCompare(ordersB[0].roomNumber);
            }).map(([groupKey, roomOrders]) => {
              const roomNumber = roomOrders[0].roomNumber;
              return (
                <div key={groupKey} className="bg-white rounded-2xl shadow-sm border border-[var(--stone-200)] overflow-hidden">
                  <div className="bg-[var(--stone-900)] p-4 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center relative gap-4 sm:gap-0">
                    <div>
                      <h2 className="text-2xl font-medium tracking-wide">
                        Room {roomNumber} 
                        {roomOrders[0].isPackedBreakfast && <span className="ml-3 text-sm bg-blue-900/50 text-blue-200 px-3 py-1 rounded-full uppercase tracking-widest font-bold">Packed</span>}
                      </h2>
                      <p className="text-[var(--stone-300)] text-sm mt-1">{roomOrders.length} {roomOrders.length === 1 ? 'Guest' : 'Guests'}</p>
                      {roomOrders[0]?.staffName && (
                        <p className="text-xs text-[var(--accent-gold)] mt-1 opacity-90">Taken by: {roomOrders[0].staffName}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-6 w-full sm:w-auto justify-between sm:justify-end">
                      {roomOrders[0]?.breakfastTime && (
                        <div className="text-right">
                          <p className="text-xs text-[var(--stone-400)] uppercase tracking-wider">Requested Time</p>
                          <p className="text-lg font-medium text-[var(--accent-gold)]">
                            {new Date(roomOrders[0].breakfastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => sendToWhatsApp(roomNumber, roomOrders)}
                          className="p-2 bg-green-900/30 hover:bg-green-900/50 text-green-300 rounded-lg transition-colors"
                          title="Share to WhatsApp"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                          </svg>
                        </button>

                        <button 
                          onClick={async () => {
                            if (confirm(`Are you sure you want to clear these orders for Room ${roomNumber}?`)) {
                              const deletePromises = roomOrders.map(o => deleteDoc(doc(db, "orders", o.id)));
                              await Promise.all(deletePromises);
                            }
                          }}
                          className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg transition-colors"
                          title="Clear Room Orders"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-[var(--stone-50)]">
                    {roomOrders.sort((a, b) => {
                      const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                      if (Math.abs(timeDiff) > 1000) return timeDiff; // Only sort by time if diff is > 1s (different orders)
                      return a.guestName.localeCompare(b.guestName, undefined, { numeric: true });
                    }).map(order => (
                      <div key={order.id} className="bg-white rounded-xl shadow-sm border border-[var(--stone-200)] flex flex-col">
                        <div className="p-4 border-b border-[var(--stone-100)] flex justify-between items-center">
                          <p className="font-medium text-[var(--stone-900)]">{order.guestName}</p>
                          <div className="text-xs text-[var(--stone-500)]">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        
                        <div className="p-4 flex-1 space-y-4">
                          {order.isPackedBreakfast ? (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-2">Packed Breakfast</h4>
                              <p className="text-sm font-semibold text-blue-800 mb-1">{order.packedSandwichChoice}</p>
                              <p className="text-xs text-blue-700">+ 1x Banana, 1x Yoghurt, 1x Water</p>
                            </div>
                          ) : (
                            <>
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-1">Starters</h4>
                                {order.starters.length > 0 ? (
                                  <ul className="list-disc list-inside text-sm text-[var(--stone-900)] space-y-1">
                                    {order.starters.map(s => (
                                      <li key={s}>{s === "Fruit Platter" && order.isKidFruitPlatter ? "Fruit Platter (Kid's Portion)" : s}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-[var(--stone-800)] italic">None selected</p>
                                )}
                              </div>

                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-1">Main Course</h4>
                                {order.mains && order.mains.length > 0 ? (
                                  <ul className="list-disc list-inside text-sm text-[var(--stone-900)] space-y-1 mb-2">
                                    {order.mains.map(m => (
                                      <li key={m}>
                                        {m} 
                                        {m === "Bread Toast" && (
                                          <span className="text-[var(--stone-600)] ml-1">
                                            ({order.toastSlices} slices{order.includesButter ? ', Butter' : ''}{order.includesJam ? ', Jam' : ''})
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-[var(--stone-800)] italic mb-2">No mains selected</p>
                                )}
                                {order.eggStyle ? (
                                  <p className="text-sm text-[var(--stone-900)] mt-2">
                                    Eggs: <span className="font-semibold">{order.eggStyle}</span>
                                    {order.eggStyle === "Fried Egg" && order.friedEggStyle && (
                                      <span className="font-semibold"> ({order.friedEggStyle})</span>
                                    )}
                                  </p>
                                ) : (
                                  <p className="text-sm text-[var(--stone-800)] italic mt-2">No eggs selected</p>
                                )}
                              </div>

                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-1">Beverage</h4>
                                {order.beverage ? (
                                  <p className="text-sm text-[var(--stone-900)] font-semibold">
                                    {order.beverage} {order.beverageIncludesMilk ? "(With Milk)" : "(Black / No Milk)"}
                                  </p>
                                ) : (
                                  <p className="text-sm text-[var(--stone-800)] italic">No beverage selected</p>
                                )}
                              </div>
                            </>
                          )}
                          
                          {order.dietaryNotes && (
                            <div className="bg-red-50 p-3 rounded-lg border border-red-100 mt-2">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-red-800 mb-1 flex items-center">
                                <span className="mr-1">⚠️</span> Dietary Notes
                              </h4>
                              <p className="text-sm text-red-900">{order.dietaryNotes}</p>
                            </div>
                          )}
                        </div>

                        <div className="p-3 bg-[var(--stone-50)] border-t border-[var(--stone-100)] flex items-center justify-between rounded-b-xl">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColors[order.status]}`}>
                            {order.status}
                          </span>
                          
                          <select
                            value={order.status}
                            onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                            className="text-xs bg-white border border-[var(--stone-200)] rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)]"
                          >
                            <option value="Pending">Pending</option>
                            <option value="Preparing">Preparing</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
