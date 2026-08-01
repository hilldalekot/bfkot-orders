"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Order, OrderStatus } from "@/types";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs, getDoc, where } from "firebase/firestore";
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

const SRI_LANKAN_MAINS: string[] = [
  "Rice",
  "Coconut Roty",
  "Parata",
  "Chapathi",
  "Dhal Curry",
  "Mix Veg Curry",
  "Coconut Sambol",
  "Egg Curry"
];

export default function KitchenDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [occupancy, setOccupancy] = useState<Record<string, { occupied: boolean; guests: number; kids?: number; time?: string; type?: 'English' | 'Sri Lankan'; note?: string }>>({});
  const [extraMeals, setExtraMeals] = useState<{ drivers: number; staff: number }>({ drivers: 0, staff: 0 });
  const [filterTab, setFilterTab] = useState<'active' | 'completed'>('active');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [isOccupancyEditMode, setIsOccupancyEditMode] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "orders"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders: Order[] = [];
      const now = new Date();
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<Order, 'id'>;
        let bTime = new Date(data.breakfastTime);
        if (isNaN(bTime.getTime())) bTime = now;
        
        let createdTime = new Date(data.createdAt);
        if (isNaN(createdTime.getTime())) createdTime = new Date(bTime.getTime() - 12 * 60 * 60 * 1000); // 12h before breakfast
        
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
          fetchedOrders.push({ id: docSnap.id, ...data, status: data.status || "Pending", createdAt: data.createdAt || createdTime.toISOString() });
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

  const updateOccupancy = (room: string, field: 'occupied' | 'guests' | 'kids' | 'time' | 'type' | 'note', value: any) => {
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
    const slGroups: Record<string, Order[]> = {};
    let packedBananas = 0;
    let packedYoghurts = 0;
    let packedWaters = 0;
    let driverPackedCount = 0;

    ROOM_NUMBERS.forEach(room => {
      const roomOrders = orders.filter(o => o.roomNumber === room);
      const roomOcc = occupancy[room];

      if (roomOrders.length > 0) {
        // Driver packed breakfasts for this room
        const driverPacked = roomOrders[0].driverPackedBreakfasts || 0;
        driverPackedCount += driverPacked;
        packedBananas += driverPacked;
        packedYoghurts += driverPacked;
        packedWaters += driverPacked;
        
        // Explicit order
        roomOrders.forEach(order => {
          if (order.isPackedBreakfast) {
            if (order.packedSandwichChoice) {
              packedCounts[order.packedSandwichChoice] = (packedCounts[order.packedSandwichChoice] || 0) + 1;
            }
            if (order.packedIncludesBanana) packedBananas += 1;
            if (order.packedIncludesYoghurt) packedYoghurts += 1;
            if (order.packedIncludesWater) packedWaters += 1;
          } else {
            if (order.starters) {
              order.starters.forEach(s => {
                const starterName = (s === "Fruit Platter" && order.isKidFruitPlatter) ? "Fruit Platter (Kid's Portion)" : s;
                const qty = s === "Waffles with Treacle" ? 2 : 1;
                starterCounts[starterName] = (starterCounts[starterName] || 0) + qty;
              });
            }
            let hasSL = false;
            if (order.mains) {
              order.mains.forEach(m => {
                if (SRI_LANKAN_MAINS.includes(m)) {
                  hasSL = true;
                }
              });
            }
            if (order.sriLankanNotes) {
              hasSL = true;
            }
            if (hasSL) {
              const timeStr = order.breakfastTime ? new Date(order.breakfastTime).toLocaleString([], { timeStyle: 'short' }) : 'Time not specified';
              const key = `${room}|${timeStr}`;
              if (!slGroups[key]) slGroups[key] = [];
              slGroups[key].push(order);
            }
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

    return { starters: starterCounts, packed: packedCounts, slGroups, packedBananas, packedYoghurts, packedWaters, driverPacked: driverPackedCount };
  };

  const confirmAndShareWhatsApp = () => {
    setShowWhatsAppModal(false);
    const { starters, slGroups } = generateProductionSummary();
    
    let earliestTime = Infinity;
    let firstOrderString = "None";
    
    orders.forEach(o => {
      if (o.breakfastTime) {
        const timeMs = new Date(o.breakfastTime).getTime();
        if (!isNaN(timeMs) && timeMs < earliestTime) {
          earliestTime = timeMs;
          const timeFormatted = new Date(o.breakfastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const typeStr = o.isPackedBreakfast ? "Take Away" : "Dine-In";
          firstOrderString = `${timeFormatted} and Room ${o.roomNumber} and ${typeStr}`;
        }
      }
    });
    
    ROOM_NUMBERS.forEach(room => {
      const roomOrders = orders.filter(o => o.roomNumber === room);
      if (roomOrders.length === 0 && occupancy[room]?.occupied && occupancy[room]?.time) {
        const [h, m] = occupancy[room].time.split(':');
        const d = new Date();
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
        const timeMs = d.getTime();
        if (!isNaN(timeMs) && timeMs < earliestTime) {
          earliestTime = timeMs;
          const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          firstOrderString = `${timeFormatted} and Room ${room} and Dine-In`;
        }
      }
    });

    let text = `*Kitchen Production Summary*\nDate: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}\nFirst Order : ${firstOrderString}\n\n`;
    
    text += `*STARTERS (Dine-In)*\n`;
    const STARTER_ORDER = [
      "Fruit Platter",
      "Fruit Platter (Kid's Portion)",
      "Yoghurt",
      "Mixed Fruit Juice",
      "Buns",
      "Pastries",
      "Waffles with Treacle",
      "Cakes",
      "Cereal with Milk"
    ];
    const starterKeys = Object.keys(starters).sort((a, b) => {
      const indexA = STARTER_ORDER.indexOf(a);
      const indexB = STARTER_ORDER.indexOf(b);
      const weightA = indexA === -1 ? Infinity : indexA;
      const weightB = indexB === -1 ? Infinity : indexB;
      if (weightA === weightB) return a.localeCompare(b);
      return weightA - weightB;
    });
    if (starterKeys.length === 0) {
      text += `_No starters required._\n`;
    } else {
      starterKeys.forEach(k => {
        text += `• ${k}: ${starters[k]}\n`;
      });
    }

    const slGroupsKeys = Object.keys(slGroups).sort();
    if (slGroupsKeys.length > 0) {
      text += `\n*SRI LANKAN MAINS (Dine-In)*\n`;
      slGroupsKeys.forEach(key => {
        const [room, timeStr] = key.split('|');
        const groupOrders = slGroups[key].sort((a, b) => {
          return a.guestName.localeCompare(b.guestName, undefined, { numeric: true });
        });
        text += `Room ${room}, ${timeStr}\n`;
        let roomNote = "";
        groupOrders.forEach(o => {
          let items: string[] = [];
          if (o.mains) {
            o.mains.forEach(m => {
              if (SRI_LANKAN_MAINS.includes(m)) {
                items.push(m);
              }
            });
          }
          let itemsStr = items.join(', ');
          if (itemsStr) {
            text += `• ${o.guestName}: ${itemsStr}\n`;
          }
          if (o.sriLankanNotes) {
            roomNote = o.sriLankanNotes;
          }
        });
        if (roomNote) {
          text += `Note: ${roomNote}\n`;
        }
      });
    }
    
    const packedGroups = orders.reduce((acc, order) => {
      if (!order.isPackedBreakfast && !(order.driverPackedBreakfasts && order.driverPackedBreakfasts > 0)) {
        return acc;
      }
      const timeStr = order.breakfastTime ? new Date(order.breakfastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time not specified';
      const key = `${order.roomNumber}|${timeStr}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(order);
      return acc;
    }, {} as Record<string, Order[]>);

    const packedKeys = Object.keys(packedGroups).sort();
    if (packedKeys.length > 0) {
      text += `\n*PACKED BREAKFASTS*\n\n`;
      packedKeys.forEach(key => {
        const [room, timeStr] = key.split('|');
        const groupOrders = packedGroups[key].sort((a, b) => {
          return a.guestName.localeCompare(b.guestName, undefined, { numeric: true });
        });
        
        text += `*Room ${room}, ${timeStr}*\n`;
        
        let driverPacked = 0;
        let driverNotes: string[] = [];
        
        groupOrders.forEach(o => {
          if (o.isPackedBreakfast && o.packedSandwichChoice) {
            let extras = [];
            if (o.packedIncludesBanana) extras.push("Bananas: *1*");
            if (o.packedIncludesYoghurt) extras.push("Yoghurts: *1*");
            if (o.packedIncludesWater) extras.push("Water: *1*");
            const extrasStr = extras.length > 0 ? ` ${extras.join(' ')}` : "";
            const dietaryNote = o.dietaryNotes ? ` (Note: ${o.dietaryNotes})` : "";
            text += `• ${o.guestName}: ${o.packedSandwichChoice}: *1*${extrasStr}${dietaryNote}\n`;
          }
          if (o.driverPackedBreakfasts && o.driverPackedBreakfasts > 0) {
            driverPacked += o.driverPackedBreakfasts;
            if (o.driverBreakfastNotes) {
              driverNotes.push(o.driverBreakfastNotes);
            }
          }
        });
        
        if (driverPacked > 0) {
          const notesStr = driverNotes.length > 0 ? ` (Notes: ${driverNotes.join(', ')})` : ` (any sand)`;
          text += `\n• Driver sandwich: *${driverPacked}*${notesStr}\n`;
        }
        text += `\n`;
      });
    }
    
    text += `\n*EXTRA MEALS*\n`;
    text += `• Driver Meals: ${extraMeals.drivers}\n`;
    text += `• Staff Meals: ${extraMeals.staff}\n`;
    
    text += `\n*TIME SLOTS*\n`;
    
    type TimeSlotData = { timeMs: number, a: number, k: number, type: string, timeStr: string, rooms: Set<string> };
    const timeSlots: Record<string, TimeSlotData> = {};
    const roomsWithOrders = new Set<string>();

    orders.forEach(o => {
      const timeMs = o.breakfastTime ? new Date(o.breakfastTime).getTime() : 0;
      if (timeMs === 0) return;
      const timeStr = new Date(timeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const typeStr = (o.isPackedBreakfast || (o.driverPackedBreakfasts && o.driverPackedBreakfasts > 0)) ? 'Take Away' : 'Dine-In';
      const key = `${timeStr}|${typeStr}`;
      
      if (!timeSlots[key]) {
        timeSlots[key] = { timeMs, a: 0, k: 0, type: typeStr, timeStr, rooms: new Set() };
      }
      
      if (o.isKidFruitPlatter) {
        timeSlots[key].k += 1;
      } else {
        timeSlots[key].a += 1;
      }
      timeSlots[key].rooms.add(o.roomNumber);
      roomsWithOrders.add(o.roomNumber);
    });
    
    ROOM_NUMBERS.forEach(room => {
      if (!roomsWithOrders.has(room) && occupancy[room]?.occupied && occupancy[room]?.time) {
        const [h, m] = occupancy[room].time.split(':');
        const d = new Date();
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
        const timeMs = d.getTime();
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const typeStr = 'Dine-In';
        const key = `${timeStr}|${typeStr}`;
        if (!timeSlots[key]) {
          timeSlots[key] = { timeMs, a: 0, k: 0, type: typeStr, timeStr, rooms: new Set() };
        }
        
        timeSlots[key].a += (occupancy[room].guests || 2);
        timeSlots[key].k += (occupancy[room].kids || 0);
        timeSlots[key].rooms.add(room);
      }
    });
    
    const sortedSlots = Object.values(timeSlots).sort((a, b) => a.timeMs - b.timeMs);
    sortedSlots.forEach(slot => {
      const roomsStr = Array.from(slot.rooms).sort().join(', ');
      text += `${slot.timeStr} - A(${slot.a}) K(${slot.k}) Room ${roomsStr}  ${slot.type}\n`;
    });
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const updateStatus = async (id: string, newStatus: OrderStatus) => {
    try {
      await updateDoc(doc(db, "orders", id), { status: newStatus });
    } catch (err) {
      console.error("Failed to update order", err);
    }
  };

  const handleEditTime = async (roomNumber: string, roomOrders: Order[]) => {
    const staffName = localStorage.getItem("staffName");
    if (!staffName) {
      toast.error("You must be logged in to edit time.");
      return;
    }
    const enteredPin = window.prompt(`Enter PIN for ${staffName} to edit time:`);
    if (enteredPin === null) return;
    
    try {
      const staffDoc = await getDoc(doc(db, "staff", staffName.toLowerCase()));
      if (!staffDoc.exists() || staffDoc.data().pin !== enteredPin) {
        toast.error("Incorrect PIN");
        return;
      }
      
      const currentTime = roomOrders[0]?.breakfastTime 
        ? new Date(roomOrders[0].breakfastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
        : '07:30';
      
      const newTime = window.prompt("Enter new time (HH:MM in 24-hour format):", currentTime);
      if (newTime === null || newTime.trim() === '') return;
      
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(newTime)) {
        toast.error("Invalid time format. Please use HH:MM (24-hour).");
        return;
      }
      
      const datePart = roomOrders[0]?.breakfastTime 
        ? new Date(roomOrders[0].breakfastTime).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
        
      const newDateTimeISO = new Date(`${datePart}T${newTime}`).toISOString();
      
      const promises = roomOrders.map(order => 
        updateDoc(doc(db, "orders", order.id), { breakfastTime: newDateTimeISO })
      );
      
      await toast.promise(Promise.all(promises), {
        loading: 'Updating time...',
        success: 'Time updated successfully!',
        error: 'Failed to update time.'
      });
      
    } catch (err: any) {
      toast.error("An error occurred");
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
        if (order.packedSandwichChoice) text += `• ${order.packedSandwichChoice}\n`;
        let extras = [];
        if (order.packedIncludesBanana) extras.push("Banana (1)");
        if (order.packedIncludesYoghurt) extras.push("Yoghurt (1)");
        if (order.packedIncludesWater) extras.push("Bottle of Water (1)");
        if (extras.length > 0) {
          text += `• ${extras.join(', ')}\n`;
        }
        text += `\n`;
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
        }
        text += `\n`;
        
        const englishMains = order.mains ? order.mains.filter(m => !SRI_LANKAN_MAINS.includes(m)) : [];
        const slMains = order.mains ? order.mains.filter(m => SRI_LANKAN_MAINS.includes(m)) : [];
        
        const hasEnglishMains = englishMains.length > 0 || order.eggStyle;
        const hasSLMains = slMains.length > 0 || order.sriLankanNotes;
        
        if (hasEnglishMains) {
          text += `MAIN COURSE${hasSLMains ? ' (English)' : ''}\n`;
          englishMains.forEach(m => {
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
          if (order.eggStyle) {
            let eggText = order.eggStyle;
            if (order.eggStyle === "Fried Egg" && order.friedEggStyle) {
              eggText += ` (${order.friedEggStyle})`;
            }
            text += `Eggs: *${eggText}*\n`;
          }
          text += `\n`;
        }

        if (hasSLMains) {
          text += `MAIN COURSE (Sri Lankan)\n`;
          slMains.forEach(m => {
            text += `• ${m}\n`;
          });
          if (order.sriLankanNotes) {
            text += `Note: ${order.sriLankanNotes}\n`;
          }
          text += `\n`;
        }
        
        text += `BEVERAGE\n`;
        if (order.beverage) {
          text += `*${order.beverage} ${order.beverageIncludesMilk ? '(With Milk)' : '(Black / No Milk)'}*\n`;
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

  const sendMainsToWhatsApp = (roomNumber: string, roomOrders: Order[]) => {
    let text = `*Room ${roomNumber} - Mains & Beverages*\n`;
    
    const time = roomOrders[0]?.breakfastTime ? new Date(roomOrders[0].breakfastTime) : null;
    let timeFormatted = time ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time not specified';
    text += `Time: ${timeFormatted}\n\n`;

    const sortedOrders = [...roomOrders].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    sortedOrders.forEach((order) => {
      if (order.isPackedBreakfast) return;
      
      let hasAnyContent = false;
      let guestText = `*${order.guestName}*\n`;
      
      const englishMains = order.mains ? order.mains.filter(m => !SRI_LANKAN_MAINS.includes(m)) : [];
      const slMains = order.mains ? order.mains.filter(m => SRI_LANKAN_MAINS.includes(m)) : [];
      
      const hasEnglishMains = englishMains.length > 0 || order.eggStyle;
      const hasSLMains = slMains.length > 0 || order.sriLankanNotes;
      
      if (hasEnglishMains) {
        hasAnyContent = true;
        guestText += `MAIN COURSE${hasSLMains ? ' (English)' : ''}\n`;
        englishMains.forEach(m => {
          if (m === "Bread Toast") {
            let toastExtras = [];
            if (order.includesButter) toastExtras.push("Butter");
            if (order.includesJam) toastExtras.push("Jam");
            let extrasString = toastExtras.length > 0 ? `, ${toastExtras.join(', ')}` : "";
            guestText += `• Toast (${order.toastSlices || 4} slices${extrasString})\n`;
          } else {
            guestText += `• ${m}\n`;
          }
        });
        if (order.eggStyle) {
          let eggText = order.eggStyle;
          if (order.eggStyle === "Fried Egg" && order.friedEggStyle) {
            eggText += ` (${order.friedEggStyle})`;
          }
          guestText += `Eggs: *${eggText}*\n`;
          if (order.eggNotes) {
            guestText += `Note: ${order.eggNotes}\n`;
          }
        }
      }

      if (hasSLMains) {
        hasAnyContent = true;
        guestText += `MAIN COURSE (Sri Lankan)\n`;
        slMains.forEach(m => {
          guestText += `• ${m}\n`;
        });
        if (order.sriLankanNotes) {
          guestText += `Note: ${order.sriLankanNotes}\n`;
        }
      }
      
      if (order.beverage) {
        hasAnyContent = true;
        guestText += `BEVERAGE\n`;
        guestText += `*${order.beverage} ${order.beverageIncludesMilk ? '(With Milk)' : '(Black / No Milk)'}*\n`;
      }
      
      if (order.dietaryNotes) {
        hasAnyContent = true;
        guestText += `\n*Notes for ${order.guestName}*: ${order.dietaryNotes}\n`;
      }
      
      if (hasAnyContent) {
        text += guestText + `\n`;
      }
    });

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
        <header className="mb-8 flex justify-between items-end border-b border-[var(--stone-200)] pb-6">
          <div>
            <Link href="/" className="inline-flex items-center space-x-1 text-sm font-medium text-[var(--stone-500)] hover:text-[var(--stone-900)] transition-colors mb-4">
              <span>&larr; Home</span>
            </Link>
            <h1 className="text-3xl font-light text-[var(--stone-900)] tracking-wide">Kitchen Dashboard</h1>
            <p className="text-[var(--stone-800)] mt-2 font-light">Real-time order monitoring</p>
          </div>
          <div className="flex flex-col items-end space-y-4">
            <div className="text-sm font-medium text-[var(--stone-800)] flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span>Live updates active</span>
            </div>
          </div>
        </header>

        {/* Filters and Summary Toggle */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex space-x-2">
            <button 
              onClick={() => setFilterTab('active')}
              className={`px-5 py-2.5 text-sm font-medium rounded-full transition-colors ${filterTab === 'active' ? 'bg-[var(--accent-gold)] text-[var(--stone-900)] shadow-sm' : 'bg-white text-[var(--stone-500)] border border-[var(--stone-200)] hover:bg-[var(--stone-100)]'}`}
            >
              Active Orders
            </button>
            <button 
              onClick={() => setFilterTab('completed')}
              className={`px-5 py-2.5 text-sm font-medium rounded-full transition-colors ${filterTab === 'completed' ? 'bg-green-600 text-white shadow-sm' : 'bg-white text-[var(--stone-500)] border border-[var(--stone-200)] hover:bg-[var(--stone-100)]'}`}
            >
              Completed Orders
            </button>
          </div>
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
                <div className="flex justify-between items-center mb-4 border-b border-[var(--stone-200)] pb-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--stone-800)]">Room Occupancy</h3>
                  <button 
                    onClick={() => setIsOccupancyEditMode(!isOccupancyEditMode)}
                    className={`text-xs font-medium px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                      isOccupancyEditMode 
                        ? 'bg-green-600 text-white shadow-sm hover:bg-green-700' 
                        : 'bg-white border border-[var(--stone-300)] text-[var(--stone-600)] hover:bg-[var(--stone-100)]'
                    }`}
                  >
                    {isOccupancyEditMode ? (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Save & Lock
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Edit Occupancy
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ROOM_NUMBERS.map(room => {
                    const roomOrders = orders.filter(o => o.roomNumber === room);
                    const hasOrder = roomOrders.length > 0;
                    const times = Array.from(new Set(roomOrders.map(o => o.breakfastTime ? new Date(o.breakfastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')));
                    const timeString = times.filter(Boolean).join(', ');

                    return (
                    <div key={room} className="bg-white p-3 rounded-lg border border-[var(--stone-200)] flex flex-col space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={occupancy[room]?.occupied || false}
                            onChange={(e) => updateOccupancy(room, 'occupied', e.target.checked)}
                            disabled={!isOccupancyEditMode}
                            className={`w-4 h-4 text-[var(--accent-gold)] focus:ring-[var(--accent-gold)] rounded border-[var(--stone-300)] ${!isOccupancyEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                          />
                          <span className={`font-medium ${!isOccupancyEditMode ? 'text-[var(--stone-500)]' : 'text-[var(--stone-900)]'}`}>Room {room}</span>
                        </label>
                        {hasOrder ? (
                          <div className="flex items-center space-x-2">
                            {timeString && <span className="text-[11px] font-semibold text-[var(--accent-gold)]">{timeString}</span>}
                            <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">Ordered</span>
                          </div>
                        ) : (
                          occupancy[room]?.occupied && (
                            <div className="flex items-center space-x-2">
                              <input 
                                type="time" 
                                value={occupancy[room]?.time || ''} 
                                onChange={(e) => updateOccupancy(room, 'time', e.target.value)}
                                disabled={!isOccupancyEditMode}
                                className={`text-[10px] bg-[var(--stone-100)] border border-[var(--stone-200)] rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)] ${!isOccupancyEditMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                              />
                              <select 
                                value={occupancy[room]?.type || 'English'} 
                                onChange={(e) => updateOccupancy(room, 'type', e.target.value)}
                                disabled={!isOccupancyEditMode}
                                className={`text-[10px] bg-[var(--stone-100)] border border-[var(--stone-200)] rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)] ${!isOccupancyEditMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                <option value="English">English</option>
                                <option value="Sri Lankan">Sri Lankan</option>
                              </select>
                            </div>
                          )
                        )}
                      </div>
                      
                      {occupancy[room]?.occupied && (
                        <div className="space-y-2 mt-2 pt-2 border-t border-[var(--stone-100)]">
                          <div className="flex items-center justify-between pl-6">
                            <span className="text-xs text-[var(--stone-500)]">Guests:</span>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => updateOccupancy(room, 'guests', Math.max(1, (occupancy[room].guests || 2) - 1))}
                                disabled={!isOccupancyEditMode}
                                className={`w-6 h-6 rounded bg-[var(--stone-100)] text-[var(--stone-600)] flex items-center justify-center font-medium ${isOccupancyEditMode ? 'hover:bg-[var(--stone-200)]' : 'opacity-50 cursor-not-allowed'}`}
                              >-</button>
                              <span className="text-sm font-semibold w-4 text-center">{occupancy[room].guests || 2}</span>
                              <button 
                                onClick={() => updateOccupancy(room, 'guests', (occupancy[room].guests || 2) + 1)}
                                disabled={!isOccupancyEditMode}
                                className={`w-6 h-6 rounded bg-[var(--stone-100)] text-[var(--stone-600)] flex items-center justify-center font-medium ${isOccupancyEditMode ? 'hover:bg-[var(--stone-200)]' : 'opacity-50 cursor-not-allowed'}`}
                              >+</button>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pl-6">
                            <span className="text-xs text-[var(--stone-500)]">Kids (Fruit Platter):</span>
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => updateOccupancy(room, 'kids', Math.max(0, (occupancy[room].kids || 0) - 1))}
                                disabled={!isOccupancyEditMode}
                                className={`w-6 h-6 rounded bg-[var(--stone-100)] text-[var(--stone-600)] flex items-center justify-center font-medium ${isOccupancyEditMode ? 'hover:bg-[var(--stone-200)]' : 'opacity-50 cursor-not-allowed'}`}
                              >-</button>
                              <span className="text-sm font-semibold w-4 text-center">{occupancy[room].kids || 0}</span>
                              <button 
                                onClick={() => updateOccupancy(room, 'kids', (occupancy[room].kids || 0) + 1)}
                                disabled={!isOccupancyEditMode}
                                className={`w-6 h-6 rounded bg-[var(--stone-100)] text-[var(--stone-600)] flex items-center justify-center font-medium ${isOccupancyEditMode ? 'hover:bg-[var(--stone-200)]' : 'opacity-50 cursor-not-allowed'}`}
                              >+</button>
                            </div>
                          </div>
                          
                          <div className="pl-6 mt-1">
                            <input 
                              type="text" 
                              placeholder="Notes (e.g. no sugar)" 
                              value={occupancy[room]?.note || ''}
                              onChange={(e) => updateOccupancy(room, 'note', e.target.value)}
                              disabled={!isOccupancyEditMode}
                              className={`w-full text-[10px] bg-[var(--stone-50)] border border-[var(--stone-200)] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)] ${!isOccupancyEditMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}
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
                    onClick={() => setShowWhatsAppModal(true)}
                    className="text-xs text-[var(--accent-gold)] hover:text-[#c9a059] font-medium flex items-center space-x-1 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    <span>Share WhatsApp</span>
                  </button>
                </h3>
                
                <div className="bg-white rounded-xl shadow-sm border border-[var(--stone-200)] overflow-hidden">
                  {(() => {
                    const { starters, packed, slGroups, packedBananas, packedYoghurts, packedWaters, driverPacked } = generateProductionSummary();
                    const starterKeys = Object.keys(starters).sort();
                    const slGroupsKeys = Object.keys(slGroups).sort();
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

                        {/* Sri Lankan Mains */}
                        {slGroupsKeys.length > 0 && (
                          <>
                            <div className="p-4 bg-[var(--stone-900)] text-white mt-4 border-t border-[var(--stone-200)]">
                              <h4 className="font-medium text-sm tracking-widest uppercase text-[var(--accent-gold)]">Sri Lankan Mains (Dine-In)</h4>
                            </div>
                            <ul className="divide-y divide-[var(--stone-100)]">
                              {slGroupsKeys.map(key => {
                                const [room, timeStr] = key.split('|');
                                const groupOrders = slGroups[key];
                                return (
                                  <li key={key} className="px-6 py-4 flex flex-col justify-center hover:bg-[var(--stone-50)] transition-colors">
                                    <div className="font-medium text-sm text-[var(--stone-500)] mb-2 uppercase tracking-wide">
                                      Room {room} <span className="ml-2 font-normal lowercase tracking-normal">@ {timeStr}</span>
                                    </div>
                                    <ul className="space-y-1">
                                      {groupOrders.map((o, idx) => {
                                        let items: string[] = [];
                                        if (o.mains) {
                                          o.mains.forEach(m => {
                                            if (SRI_LANKAN_MAINS.includes(m)) {
                                              items.push(m);
                                            }
                                          });
                                        }
                                        let itemsStr = items.join(', ');
                                        if (o.sriLankanNotes) {
                                          itemsStr += itemsStr ? `, Note: ${o.sriLankanNotes}` : `Note: ${o.sriLankanNotes}`;
                                        }
                                        return (
                                          <li key={idx} className="text-sm text-[var(--stone-900)]">
                                            <span className="font-medium">{o.guestName}:</span> {itemsStr}
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </li>
                                );
                              })}
                            </ul>
                          </>
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
                                  <span className="font-semibold">Packed Extras</span> required.<br/>
                                  <span className="text-xs text-blue-800">Total: {packedBananas} Bananas, {packedYoghurts} Yoghurts, {packedWaters} Water Bottles</span>
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
        ) : (() => {
          const filteredOrders = orders.filter(order => filterTab === 'active' ? order.status !== 'Completed' : order.status === 'Completed');
          
          if (filteredOrders.length === 0) {
            return (
              <div className="text-center py-20 bg-white rounded-2xl border border-[var(--stone-200)] shadow-sm">
                <h3 className="text-xl text-[var(--stone-900)] font-light">No {filterTab === 'active' ? 'Active' : 'Completed'} Orders</h3>
                <p className="text-[var(--stone-800)] mt-2">
                  {filterTab === 'active' ? 'Waiting for new requests...' : 'No orders have been completed yet today.'}
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-12">
              {Object.entries(
                filteredOrders.reduce((acc, order) => {
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
                          <div className="flex items-center justify-end space-x-2">
                            <p className="text-xs text-[var(--stone-400)] uppercase tracking-wider">Requested Time</p>
                            <button 
                              onClick={() => handleEditTime(roomNumber, roomOrders)}
                              className="text-[var(--stone-400)] hover:text-[var(--accent-gold)] transition-colors"
                              title="Edit Time"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          </div>
                          <p className="text-lg font-medium text-[var(--accent-gold)] leading-tight mt-0.5">
                            {new Date(roomOrders[0].breakfastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[10px] text-[var(--stone-400)] font-medium">
                            {new Date(roomOrders[0].breakfastTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex flex-col space-y-2 items-end">
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => sendToWhatsApp(roomNumber, roomOrders)}
                            className="p-2 bg-green-900/30 hover:bg-green-900/50 text-green-300 rounded-lg transition-colors"
                            title="Share Full Order to WhatsApp"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                            </svg>
                          </button>

                          <button 
                            onClick={async () => {
                              const staffName = localStorage.getItem("staffName");
                              if (!staffName) {
                                toast.error("You must be logged in to delete orders.");
                                return;
                              }
                              const enteredPin = window.prompt(`Enter PIN for ${staffName} to delete orders:`);
                              if (enteredPin === null) return;
                              
                              try {
                                const staffDoc = await getDoc(doc(db, "staff", staffName.toLowerCase()));
                                if (staffDoc.exists() && staffDoc.data().pin === enteredPin) {
                                  if (confirm(`Are you sure you want to clear these orders for Room ${roomNumber}?`)) {
                                    const deletePromises = roomOrders.map(o => deleteDoc(doc(db, "orders", o.id)));
                                    toast.promise(Promise.all(deletePromises), {
                                      loading: 'Deleting orders...',
                                      success: 'Orders deleted successfully!',
                                      error: 'Failed to delete orders.'
                                    });
                                  }
                                } else {
                                  toast.error("Incorrect PIN.");
                                }
                              } catch (err) {
                                console.error("Error verifying PIN or deleting orders:", err);
                                toast.error("An error occurred. Please try again.");
                              }
                            }}
                            className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg transition-colors"
                            title="Delete Room Orders"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => sendMainsToWhatsApp(roomNumber, roomOrders)}
                          className="flex items-center space-x-1 px-2 py-1 bg-green-900/30 hover:bg-green-900/50 text-green-300 rounded-lg transition-colors border border-green-900/50"
                          title="Share Mains & Beverages Only"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                          </svg>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Mains</span>
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
                            {order.createdAt && !isNaN(new Date(order.createdAt).getTime()) 
                              ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                              : "Time N/A"}
                          </div>
                        </div>
                        
                        <div className="p-4 flex-1 space-y-4">
                          {order.isPackedBreakfast ? (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-2">Packed Breakfast</h4>
                              <p className="text-sm font-semibold text-blue-800 mb-1">{order.packedSandwichChoice}</p>
                              {(() => {
                                const extras = [];
                                if (order.packedIncludesBanana) extras.push("1x Banana");
                                if (order.packedIncludesYoghurt) extras.push("1x Yoghurt");
                                if (order.packedIncludesWater) extras.push("1x Water");
                                return extras.length > 0 ? (
                                  <p className="text-xs text-blue-700 mt-1">+ {extras.join(", ")}</p>
                                ) : null;
                              })()}
                              {order.dietaryNotes && (
                                <p className="text-xs text-red-600 font-bold mt-1">⚠️ {order.dietaryNotes}</p>
                              )}
                              {order.driverPackedBreakfasts ? (
                                <div className="mt-3 pt-3 border-t border-blue-200">
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-900 mb-1">Driver Meals</h4>
                                  <p className="text-sm font-semibold text-blue-800">{order.driverPackedBreakfasts}x Sandwich</p>
                                  {order.driverBreakfastNotes && (
                                    <p className="text-xs text-red-600 font-bold mt-1">⚠️ {order.driverBreakfastNotes}</p>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              {order.starters && order.starters.length > 0 && (
                                <div className="mb-3">
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-1">Starters</h4>
                                  <ul className="list-disc list-inside text-sm text-[var(--stone-900)] space-y-1">
                                    {order.starters.map(s => (
                                      <li key={s}>{s === "Fruit Platter" && order.isKidFruitPlatter ? "Fruit Platter (Kid's Portion)" : s}</li>
                                    ))}
                                  </ul>
                                  {order.starterNotes && (
                                    <p className="text-sm text-[var(--stone-900)] mt-2">
                                      Note: <span className="font-semibold">{order.starterNotes}</span>
                                    </p>
                                  )}
                                </div>
                              )}

                              {(() => {
                                const englishMains = order.mains ? order.mains.filter(m => !SRI_LANKAN_MAINS.includes(m)) : [];
                                const slMains = order.mains ? order.mains.filter(m => SRI_LANKAN_MAINS.includes(m)) : [];
                                
                                const hasEnglishMains = englishMains.length > 0 || order.eggStyle;
                                const hasSLMains = slMains.length > 0 || order.sriLankanNotes;
                                
                                return (
                                  <>
                                    {hasEnglishMains && (
                                      <div className="mb-3">
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-1">
                                          Main Course {hasSLMains ? <span className="text-[var(--stone-500)]">(English)</span> : ''}
                                        </h4>
                                        {englishMains.length > 0 && (
                                          <ul className="list-disc list-inside text-sm text-[var(--stone-900)] space-y-1 mb-2">
                                            {englishMains.map(m => (
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
                                        )}
                                        {order.eggStyle && (
                                          <div className="mt-2">
                                            <p className="text-sm text-[var(--stone-900)]">
                                              Eggs: <span className="font-semibold">{order.eggStyle}</span>
                                              {order.eggStyle === "Fried Egg" && order.friedEggStyle && (
                                                <span className="font-semibold"> ({order.friedEggStyle})</span>
                                              )}
                                            </p>
                                            {order.eggNotes && (
                                              <p className="text-sm text-[var(--stone-900)] mt-1">
                                                Note: <span className="font-semibold">{order.eggNotes}</span>
                                              </p>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {hasSLMains && (
                                      <div className="mb-3">
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-1">
                                          Main Course <span className="text-[var(--accent-gold)]">(Sri Lankan)</span>
                                        </h4>
                                        {slMains.length > 0 && (
                                          <ul className="list-disc list-inside text-sm text-[var(--stone-900)] space-y-1 mb-2">
                                            {slMains.map(m => (
                                              <li key={m}>{m}</li>
                                            ))}
                                          </ul>
                                        )}
                                        {order.sriLankanNotes && (
                                          <p className="text-sm text-[var(--stone-900)] mt-2">
                                            Note: <span className="font-semibold">{order.sriLankanNotes}</span>
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}

                              {order.beverage && (
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--stone-800)] mb-1">Beverage</h4>
                                  <p className="text-sm text-[var(--stone-900)] font-semibold">
                                    {order.beverage} {order.beverageIncludesMilk ? "(With Milk)" : "(Black / No Milk)"}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                          
                          {order.dietaryNotes && !order.isPackedBreakfast && (
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
          );
        })()}
      </div>

      {/* WhatsApp Confirmation Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-[var(--stone-900)] mb-2">Confirm Extra Meals</h3>
              <p className="text-sm text-[var(--stone-600)] mb-6">
                Please confirm the number of extra meals before sending the summary to the kitchen.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between bg-[var(--stone-50)] p-3 rounded-xl border border-[var(--stone-200)]">
                  <span className="font-medium text-[var(--stone-900)]">Driver Meals</span>
                  <div className="flex items-center space-x-3">
                    <button onClick={() => updateExtraMeals('drivers', Math.max(0, extraMeals.drivers - 1))} className="w-8 h-8 rounded-md bg-white border border-[var(--stone-200)] text-[var(--stone-600)] flex items-center justify-center font-medium shadow-sm hover:bg-[var(--stone-100)]">-</button>
                    <span className="text-base font-bold w-4 text-center text-[var(--stone-900)]">{extraMeals.drivers}</span>
                    <button onClick={() => updateExtraMeals('drivers', extraMeals.drivers + 1)} className="w-8 h-8 rounded-md bg-white border border-[var(--stone-200)] text-[var(--stone-600)] flex items-center justify-center font-medium shadow-sm hover:bg-[var(--stone-100)]">+</button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between bg-[var(--stone-50)] p-3 rounded-xl border border-[var(--stone-200)]">
                  <span className="font-medium text-[var(--stone-900)]">Staff Meals</span>
                  <div className="flex items-center space-x-3">
                    <button onClick={() => updateExtraMeals('staff', Math.max(0, extraMeals.staff - 1))} className="w-8 h-8 rounded-md bg-white border border-[var(--stone-200)] text-[var(--stone-600)] flex items-center justify-center font-medium shadow-sm hover:bg-[var(--stone-100)]">-</button>
                    <span className="text-base font-bold w-4 text-center text-[var(--stone-900)]">{extraMeals.staff}</span>
                    <button onClick={() => updateExtraMeals('staff', extraMeals.staff + 1)} className="w-8 h-8 rounded-md bg-white border border-[var(--stone-200)] text-[var(--stone-600)] flex items-center justify-center font-medium shadow-sm hover:bg-[var(--stone-100)]">+</button>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button 
                  onClick={() => setShowWhatsAppModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-[var(--stone-600)] bg-[var(--stone-100)] hover:bg-[var(--stone-200)] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmAndShareWhatsApp}
                  className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[var(--accent-gold)] hover:bg-[#c9a059] shadow-md transition-colors flex items-center justify-center"
                >
                  Confirm & Share
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
