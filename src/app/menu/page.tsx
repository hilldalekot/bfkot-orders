"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StarterType, EggStyle, BeverageType, MainCourseType, FriedEggStyle, PackedSandwichType } from "@/types";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DebouncedInput from "@/components/DebouncedInput";
import DebouncedTextarea from "@/components/DebouncedTextarea";
const PACKED_SANDWICHES: PackedSandwichType[] = [
  "Vegetable Sandwich",
  "Egg Sandwich",
  "Cheese & Tomato Sandwich",
  "Chicken Sandwich",
  "Bacon & Cheese Sandwich"
];

const STARTERS: StarterType[] = [
  "Mixed Fruit Juice",
  "Fruit Platter",
  "Cereal with Milk",
  "Yoghurt",
  "Waffles with Treacle",
  "Cakes",
  "Buns",
  "Pastries",
];

const EGG_STYLES: EggStyle[] = [
  "Omelet",
  "Cheese Omelet",
  "Sri Lankan Omelet",
  "Scrambled Eggs",
  "Fried Egg",
  "Boiled Eggs",
];

const BEVERAGES: BeverageType[] = ["Ceylon Tea", "Coffee"];

const MAINS: MainCourseType[] = [
  "Chicken Sausages",
  "Bacon",
  "Chicken Salami",
  "Baked Beans",
  "Bread Toast"
];

const SRI_LANKAN_MAINS: MainCourseType[] = [
  "Rice",
  "Coconut Roty",
  "Parata",
  "Chapathi",
  "Dhal Curry",
  "Mix Veg Curry",
  "Coconut Sambol",
  "Egg Curry"
];

const FRIED_EGG_STYLES: FriedEggStyle[] = [
  "Sunny-Side Up",
  "Over Easy",
  "Over Medium",
  "Over Hard"
];

const ROOMS = ["101", "102", "103", "201", "202", "301", "302", "Walk-In"];

type GuestOrderDraft = {
  guestName: string;
  selectedStarters: StarterType[];
  starterNotes: string;
  selectedMains: MainCourseType[];
  toastSlices: number;
  includesButter: boolean;
  includesJam: boolean;
  isKidFruitPlatter: boolean;
  includesSriLankanMeals: boolean;
  sriLankanNotes: string;
  includesEggs: boolean;
  eggStyle: EggStyle;
  friedEggStyle: FriedEggStyle;
  eggNotes: string;
  includesBeverage: boolean;
  beverage: BeverageType;
  beverageIncludesMilk: boolean;
  beverageNotes: string;
  isPackedBreakfast: boolean;
  packedSandwichChoice: PackedSandwichType | null;
  packedIncludesBanana: boolean;
  packedIncludesYoghurt: boolean;
  packedIncludesWater: boolean;
  dietaryNotes: string;
};

const defaultGuestOrder = (index: number): GuestOrderDraft => ({
  guestName: `Guest ${index + 1}`,
  selectedStarters: [],
  starterNotes: "",
  selectedMains: [],
  toastSlices: 4,
  includesButter: true,
  includesJam: true,
  isKidFruitPlatter: false,
  includesSriLankanMeals: false,
  sriLankanNotes: "",
  includesEggs: false,
  eggStyle: "Omelet",
  friedEggStyle: "Sunny-Side Up",
  eggNotes: "",
  includesBeverage: false,
  beverage: "Ceylon Tea",
  beverageIncludesMilk: false,
  beverageNotes: "",
  isPackedBreakfast: false,
  packedSandwichChoice: null,
  packedIncludesBanana: true,
  packedIncludesYoghurt: true,
  packedIncludesWater: true,
  dietaryNotes: "",
});

export default function GuestMenuPage() {
  const [step, setStep] = useState(1);

  // Step 1 State
  const [roomNumber, setRoomNumber] = useState("");
  const [walkInIdentifier, setWalkInIdentifier] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [orderType, setOrderType] = useState<'dine-in' | 'packed'>('dine-in');
  const [breakfastDate, setBreakfastDate] = useState("");
  const [breakfastTime, setBreakfastTime] = useState("07:30");

  // Driver extras
  const [driverPackedBreakfasts, setDriverPackedBreakfasts] = useState<number>(0);
  const [driverBreakfastNotes, setDriverBreakfastNotes] = useState<string>('');

  // Step 2 State
  const [guestOrders, setGuestOrders] = useState<GuestOrderDraft[]>([]);
  const [currentGuestIndex, setCurrentGuestIndex] = useState(0);

  // Global State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [waLinkUrl, setWaLinkUrl] = useState("");
  const [staffName, setStaffName] = useState<string>("");
  const [editMode, setEditMode] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    const hours = now.getHours();
    
    // Helper to get local date string YYYY-MM-DD
    const getLocalDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Auto-roll rule: If past 12:00 (Noon), set to tomorrow at 07:30
    if (hours >= 12) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      setBreakfastDate(getLocalDateString(tomorrow));
      setBreakfastTime("07:30");
    } else if (hours >= 6 && hours < 12) {
      // Between 06:00 and 12:00, use current time
      setBreakfastDate(getLocalDateString(now));
      const mins = String(now.getMinutes()).padStart(2, '0');
      setBreakfastTime(`${String(hours).padStart(2, '0')}:${mins}`);
    } else {
      // Before 06:00, default to today at 07:30
      setBreakfastDate(getLocalDateString(now));
      setBreakfastTime("07:30");
    }

    const staff = localStorage.getItem("staffName");
    const role = localStorage.getItem("staffRole");
    if (role === "Kitchen Staff") {
      router.push("/kitchen");
      return;
    }
    
    if (staff) {
      setStaffName(staff);
    }

    const loadEditOrder = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const editId = urlParams.get('editOrderId');
      if (editId) {
        try {
          const docRef = doc(db, "orders", editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setEditMode(true);
            setEditOrderId(editId);
            
            // Set room/walkin
            if (data.roomNumber.startsWith("Walk-In")) {
              setRoomNumber("Walk-In");
              setWalkInIdentifier(data.roomNumber.replace("Walk-In (", "").replace(")", ""));
            } else {
              setRoomNumber(data.roomNumber);
            }
            
            // Time and date
            if (data.breakfastTime) {
              const dt = new Date(data.breakfastTime);
              setBreakfastDate(getLocalDateString(dt));
              setBreakfastTime(`${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`);
            }

            setOrderType(data.orderType || 'dine-in');
            setDriverPackedBreakfasts(data.driverPackedBreakfasts || 0);
            setDriverBreakfastNotes(data.driverBreakfastNotes || '');
            setGuestCount(1); // Editing single guest

            // Reconstruct GuestOrderDraft
            const go: GuestOrderDraft = {
              guestName: data.guestName || "Guest",
              isPackedBreakfast: data.isPackedBreakfast || false,
              selectedStarters: data.starters || [],
              starterNotes: data.starterNotes || "",
              selectedMains: data.mains || [],
              toastSlices: data.toastSlices !== undefined ? data.toastSlices : 4,
              includesButter: data.includesButter !== undefined ? data.includesButter : true,
              includesJam: data.includesJam !== undefined ? data.includesJam : true,
              isKidFruitPlatter: data.isKidFruitPlatter || false,
              includesSriLankanMeals: (data.mains || []).some((m: any) => SRI_LANKAN_MAINS.includes(m)),
              sriLankanNotes: data.sriLankanNotes || "",
              includesEggs: !!data.eggStyle,
              eggStyle: data.eggStyle || "Omelet",
              friedEggStyle: data.friedEggStyle || "Sunny-Side Up",
              eggNotes: data.eggNotes || "",
              includesBeverage: !!data.beverage,
              beverage: data.beverage || "Ceylon Tea",
              beverageIncludesMilk: data.beverageIncludesMilk || false,
              beverageNotes: data.beverageNotes || "",
              packedSandwichChoice: data.packedSandwichChoice || null,
              packedIncludesBanana: data.packedIncludesBanana !== undefined ? data.packedIncludesBanana : true,
              packedIncludesYoghurt: data.packedIncludesYoghurt !== undefined ? data.packedIncludesYoghurt : true,
              packedIncludesWater: data.packedIncludesWater !== undefined ? data.packedIncludesWater : true,
              dietaryNotes: data.dietaryNotes || "",
            };

            setGuestOrders([go]);
            setStep(2); // Jump straight to guest details
          }
        } catch (err) {
          console.error("Failed to load order:", err);
          toast.error("Failed to load order for editing");
        }
      }
    };
    
    loadEditOrder();
  }, [router]);

  const resetForm = () => {
    setStep(1);
    setRoomNumber("");
    setWalkInIdentifier("");
    setGuestCount(2);
    setOrderType('dine-in');
    setGuestOrders([]);
    setDriverPackedBreakfasts(0);
    setDriverBreakfastNotes('');
  };

  const startOrdering = () => {
    if (!roomNumber) {
      setError("Please select a room number.");
      return;
    }
    if (roomNumber === "Walk-In" && !walkInIdentifier.trim()) {
      setError("Please provide a name or table number for the Walk-In.");
      return;
    }
    if (!breakfastDate || !breakfastTime) {
      setError("Please specify a breakfast date and time.");
      return;
    }
    setError("");
    if (orderType === 'dine-in') {
      setDriverPackedBreakfasts(0);
      setDriverBreakfastNotes('');
    }
    
    setGuestOrders(Array.from({ length: guestCount }, (_, i) => ({
      ...defaultGuestOrder(i),
      isPackedBreakfast: orderType === 'packed'
    })));
    setCurrentGuestIndex(0);
    setStep(2);
  };

  const updateCurrentGuest = (updates: Partial<GuestOrderDraft>) => {
    const updated = [...guestOrders];
    updated[currentGuestIndex] = { ...updated[currentGuestIndex], ...updates };
    setGuestOrders(updated);
  };

  const toggleStarter = (starter: StarterType) => {
    const current = guestOrders[currentGuestIndex].selectedStarters;
    updateCurrentGuest({
      selectedStarters: current.includes(starter) ? current.filter(s => s !== starter) : [...current, starter]
    });
  };

  const toggleMain = (main: MainCourseType) => {
    const current = guestOrders[currentGuestIndex].selectedMains;
    updateCurrentGuest({
      selectedMains: current.includes(main) ? current.filter(m => m !== main) : [...current, main]
    });
  };

  const nextGuest = () => {
    if (!guestOrders[currentGuestIndex].guestName.trim()) {
      setError("Please provide a name for this guest.");
      return;
    }
    setError("");
    if (currentGuestIndex < guestCount - 1) {
      setCurrentGuestIndex(prev => prev + 1);
      window.scrollTo(0, 0);
    } else {
      setStep(3);
      window.scrollTo(0, 0);
    }
  };

  const prevGuest = () => {
    if (currentGuestIndex > 0) {
      setCurrentGuestIndex(prev => prev - 1);
      window.scrollTo(0, 0);
    } else {
      setStep(1);
    }
  };

  const formatOrderForWhatsApp = () => {
    const finalRoomNumber = roomNumber === "Walk-In" ? `Walk-In (${walkInIdentifier})` : roomNumber;
    const combinedTime = `${breakfastDate}T${breakfastTime}`;
    const timeFormatted = new Date(combinedTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    let text = `*New Breakfast Order*\n`;
    text += `Room: ${finalRoomNumber}\n`;
    text += `Time: ${timeFormatted}\n`;
    text += `Guests: ${guestCount}\n\n`;

    guestOrders.forEach((order, idx) => {
      text += `*${order.guestName}*\n\n`;
      
      if (order.isPackedBreakfast) {
        text += `[PACKED BREAKFAST]\n`;
        if (order.packedSandwichChoice) text += `• ${order.packedSandwichChoice}\n`;
        const extras = [];
        if (order.packedIncludesBanana) extras.push("Banana (1)");
        if (order.packedIncludesYoghurt) extras.push("Yoghurt (1)");
        if (order.packedIncludesWater) extras.push("Bottle of Water (1)");
        if (extras.length > 0) {
          text += `• ${extras.join(', ')}\n`;
        }
        text += `\n`;
      } else {
        if (order.selectedStarters.length > 0) {
          text += `STARTERS\n`;
          order.selectedStarters.forEach(s => {
            text += `• ${s === "Fruit Platter" && order.isKidFruitPlatter ? "Fruit Platter (Kid's Portion)" : s}\n`;
          });
          text += `\n`;
        }
        
        const englishMains = order.selectedMains.filter(m => !SRI_LANKAN_MAINS.includes(m));
        const slMains = order.selectedMains.filter(m => SRI_LANKAN_MAINS.includes(m));
        
        const hasEnglishMains = englishMains.length > 0 || (order.includesEggs && order.eggStyle);
        const hasSLMains = slMains.length > 0 || (order.includesSriLankanMeals && order.sriLankanNotes);

        if (hasEnglishMains) {
          text += `MAIN COURSE${hasSLMains ? ' (English)' : ''}\n`;
          englishMains.forEach(m => {
            if (m === "Bread Toast") {
              const toastExtras = [];
              if (order.includesButter) toastExtras.push("Butter");
              if (order.includesJam) toastExtras.push("Jam");
              const extrasString = toastExtras.length > 0 ? `, ${toastExtras.join(', ')}` : "";
              text += `• Toast (${order.toastSlices} slices${extrasString})\n`;
            } else {
              text += `• ${m}\n`;
            }
          });
          if (order.includesEggs && order.eggStyle) {
            let eggText = order.eggStyle;
            if (order.eggStyle === "Fried Egg" && order.friedEggStyle) {
              eggText += ` (${order.friedEggStyle})`;
            }
            if (order.eggNotes) {
              eggText += ` - ${order.eggNotes}`;
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
          if (order.includesSriLankanMeals && order.sriLankanNotes) {
            text += `Note: ${order.sriLankanNotes}\n`;
          }
          text += `\n`;
        }
        
        if ((order.includesBeverage && order.beverage) || order.beverageNotes) {
          text += `BEVERAGE\n`;
          if (order.includesBeverage && order.beverage) {
            text += `*${order.beverage} ${order.beverageIncludesMilk ? '(With Milk)' : '(Black / No Milk)'}*\n`;
          }
          if (order.beverageNotes) {
            text += `Note: ${order.beverageNotes}\n`;
          }
          text += `\n`;
        }
      }
      
      if (order.dietaryNotes) {
        text += `\n*Notes*: ${order.dietaryNotes}\n`;
      }
      text += `\n`;
    });
    
    if (driverPackedBreakfasts > 0) {
      text += `[DRIVER PACKED BREAKFASTS]\n`;
      text += `• Quantity: ${driverPackedBreakfasts}\n`;
      if (driverBreakfastNotes) {
        text += `• Notes: ${driverBreakfastNotes}\n`;
      }
      text += `\n`;
    }
    
    if (staffName) {
      const takenTime = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      text += `-------------------\n`;
      text += `_Order Taken By: ${staffName}_\n`;
      text += `_Taken At: ${takenTime}_\n`;
    }

    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const submitOrder = async () => {
    setIsSubmitting(true);
    setError("");
    const finalRoomNumber = roomNumber === "Walk-In" ? `Walk-In (${walkInIdentifier})` : roomNumber;

    try {
      const payload = guestOrders.map(go => ({
        roomNumber: finalRoomNumber,
        guestName: go.guestName,
        orderType,
        driverPackedBreakfasts,
        driverBreakfastNotes,
        isPackedBreakfast: go.isPackedBreakfast,
        packedSandwichChoice: go.isPackedBreakfast ? go.packedSandwichChoice : undefined,
        packedIncludesBanana: go.isPackedBreakfast ? go.packedIncludesBanana : undefined,
        packedIncludesYoghurt: go.isPackedBreakfast ? go.packedIncludesYoghurt : undefined,
        packedIncludesWater: go.isPackedBreakfast ? go.packedIncludesWater : undefined,
        starters: go.isPackedBreakfast ? [] : go.selectedStarters,
        starterNotes: go.isPackedBreakfast ? undefined : go.starterNotes,
        mains: go.isPackedBreakfast ? [] : go.selectedMains,
        toastSlices: go.isPackedBreakfast ? undefined : go.toastSlices,
        includesButter: go.isPackedBreakfast ? undefined : go.includesButter,
        includesJam: go.isPackedBreakfast ? undefined : go.includesJam,
        isKidFruitPlatter: go.isPackedBreakfast ? undefined : go.isKidFruitPlatter,
        eggStyle: (!go.isPackedBreakfast && go.includesEggs) ? go.eggStyle : undefined,
        friedEggStyle: (!go.isPackedBreakfast && go.includesEggs && go.eggStyle === "Fried Egg") ? go.friedEggStyle : undefined,
        beverage: (!go.isPackedBreakfast && go.includesBeverage) ? go.beverage : undefined,
        beverageIncludesMilk: (!go.isPackedBreakfast && go.includesBeverage) ? go.beverageIncludesMilk : undefined,
        beverageNotes: !go.isPackedBreakfast ? go.beverageNotes : undefined,
        sriLankanNotes: (!go.isPackedBreakfast && go.includesSriLankanMeals) ? go.sriLankanNotes : undefined,
        eggNotes: (!go.isPackedBreakfast && go.includesEggs) ? go.eggNotes : undefined,
        dietaryNotes: go.dietaryNotes,
        breakfastTime: new Date(`${breakfastDate || new Date().toISOString().split('T')[0]}T${breakfastTime || "07:30"}`).toISOString(),
        staffName: staffName || "Unknown Staff",
        status: "Pending",
        createdAt: new Date().toISOString(),
      }));

      if (editMode && editOrderId) {
        // Update single order
        const orderPayload = payload[0];
        Object.keys(orderPayload).forEach(key => {
          if ((orderPayload as any)[key] === undefined) {
            delete (orderPayload as any)[key];
          }
        });
        // We shouldn't overwrite createdAt on edit
        delete (orderPayload as any).createdAt;
        
        (orderPayload as any).editedBy = staffName || "Unknown Staff";
        (orderPayload as any).editedAt = new Date().toISOString();
        
        await toast.promise(updateDoc(doc(db, "orders", editOrderId), orderPayload), {
          loading: 'Updating order...',
          success: 'Order updated successfully!',
          error: 'Failed to update order.'
        });
        
        // Redirect back to kitchen
        router.push('/kitchen');
        return;
      } else {
        const promises = payload.map(orderPayload => {
          Object.keys(orderPayload).forEach(key => {
            if ((orderPayload as any)[key] === undefined) {
              delete (orderPayload as any)[key];
            }
          });
          return addDoc(collection(db, "orders"), orderPayload);
        });
        
        await toast.promise(Promise.all(promises), {
          loading: 'Sending order to kitchen...',
          success: 'Order submitted successfully!',
          error: 'Failed to submit order.'
        });
      }

      setIsSuccess(true);
      
      const waLink = formatOrderForWhatsApp();
      setWaLinkUrl(waLink);
      resetForm();

    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--stone-50)] text-center">
        <div className="bg-white p-10 rounded-2xl shadow-xl max-w-md w-full border border-[var(--stone-200)]">
          <div className="mb-6 mx-auto w-16 h-16 bg-[var(--accent-gold)] text-white rounded-full flex items-center justify-center text-3xl shadow-md">
            ✓
          </div>
          <h1 className="text-3xl font-light mb-4 text-[var(--stone-900)]">Order Sent!</h1>
          <p className="text-[var(--stone-800)] mb-8 text-lg font-light leading-relaxed">
            Your order details for Room {roomNumber === "Walk-In" ? `Walk-In (${walkInIdentifier})` : roomNumber} have been saved directly to the Kitchen Dashboard.
          </p>
          <div className="flex flex-col space-y-3">
            <a 
              href={waLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center px-8 py-3 bg-green-600 text-white rounded-xl font-medium tracking-wide shadow-md hover:bg-green-700 transition-all"
            >
              Open WhatsApp Message
            </a>
            <button 
              onClick={() => {
                setIsSuccess(false);
                setStep(1);
              }}
              className="w-full px-8 py-3 bg-[var(--stone-900)] text-white rounded-xl font-medium tracking-wide shadow-md hover:bg-[var(--stone-800)] transition-all"
            >
              Submit Another Order
            </button>
            <Link href="/" className="w-full px-8 py-3 bg-white text-[var(--stone-900)] border border-[var(--stone-200)] rounded-xl font-medium tracking-wide shadow-sm hover:bg-[var(--stone-50)] transition-all flex items-center justify-center">
              Back to Home Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--stone-50)] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-[var(--stone-100)]">
        
        <div className="p-8 sm:p-12 relative pt-12 sm:pt-16">
          {step === 1 && (
            <Link href="/" className="absolute top-6 left-8 sm:left-12 text-[var(--stone-500)] hover:text-[var(--stone-900)] transition-colors text-sm font-medium flex items-center space-x-1">
              <span>&larr; Home</span>
            </Link>
          )}

          <div className="flex justify-center space-x-2 absolute top-8 right-8 sm:right-12">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 w-8 sm:w-12 rounded-full ${step >= s ? 'bg-[var(--accent-gold)]' : 'bg-[var(--stone-200)]'}`} />
            ))}
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200 mb-8 mt-4">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-light text-[var(--stone-900)]">Order Details</h2>
                <p className="text-[var(--stone-600)] mt-2">Let&apos;s set up your breakfast request.</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[var(--stone-800)] mb-2">Room Number</label>
                  <div className="relative">
                    <select 
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full appearance-none bg-white border border-[var(--stone-200)] rounded-xl py-3 px-4 text-[var(--stone-900)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)] focus:border-transparent cursor-pointer shadow-sm"
                    >
                      <option value="" disabled>Select a Room</option>
                      {ROOMS.map(room => (
                        <option key={room} value={room}>{room}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[var(--stone-800)]">
                      ▼
                    </div>
                  </div>
                </div>

                {roomNumber === "Walk-In" && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-[var(--stone-800)] mb-2">Walk-In Name / Table No.</label>
                    <input 
                      type="text"
                      value={walkInIdentifier}
                      onChange={(e) => setWalkInIdentifier(e.target.value)}
                      placeholder="e.g. John Doe or Table 4"
                      className="w-full bg-white border border-[var(--stone-200)] rounded-xl py-3 px-4 text-[var(--stone-900)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)] focus:border-transparent shadow-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--stone-800)] mb-2">Number of Guests</label>
                    <div className="flex items-center space-x-4 bg-white border border-[var(--stone-200)] rounded-xl p-2 w-max h-[58px]">
                      <button 
                        type="button"
                        onClick={() => setGuestCount(prev => Math.max(1, prev - 1))}
                        className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--stone-50)] text-[var(--stone-800)] hover:bg-[var(--stone-100)] transition-colors"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-medium text-[var(--stone-900)]">{guestCount}</span>
                      <button 
                        type="button"
                        onClick={() => setGuestCount(prev => Math.min(20, prev + 1))}
                        className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--stone-50)] text-[var(--stone-800)] hover:bg-[var(--stone-100)] transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--stone-800)] mb-2">Order Type</label>
                    <div className="flex bg-[var(--stone-100)] rounded-xl p-1 h-[58px]">
                      <button
                        onClick={() => setOrderType('dine-in')}
                        className={`flex-1 text-sm font-medium rounded-lg transition-colors ${orderType === 'dine-in' ? 'bg-white shadow-sm text-[var(--stone-900)]' : 'text-[var(--stone-500)] hover:text-[var(--stone-700)]'}`}
                      >
                        Dine-In
                      </button>
                      <button
                        onClick={() => setOrderType('packed')}
                        className={`flex-1 text-sm font-medium rounded-lg transition-colors ${orderType === 'packed' ? 'bg-white shadow-sm text-[var(--stone-900)]' : 'text-[var(--stone-500)] hover:text-[var(--stone-700)]'}`}
                      >
                        Packed Breakfast
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--stone-800)] mb-2">Breakfast Date</label>
                    <input 
                      type="date" 
                      value={breakfastDate}
                      onChange={(e) => setBreakfastDate(e.target.value)}
                      className="w-full bg-white border border-[var(--stone-200)] rounded-xl py-3 px-4 text-[var(--stone-900)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)] focus:border-transparent shadow-sm cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--stone-800)] mb-2">Breakfast Time</label>
                    <input 
                      type="time" 
                      value={breakfastTime}
                      onChange={(e) => setBreakfastTime(e.target.value)}
                      className="w-full bg-white border border-[var(--stone-200)] rounded-xl py-3 px-4 text-[var(--stone-900)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)] focus:border-transparent shadow-sm cursor-pointer"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-[var(--stone-500)] mt-2 italic px-1">
                  Orders placed after 12:00 PM automatically default to 7:30 AM tomorrow.
                </p>
              </div>

              <button 
                onClick={startOrdering}
                className="w-full py-4 mt-8 rounded-xl bg-[var(--stone-900)] text-white font-medium tracking-widest uppercase transition-all shadow-md hover:bg-[var(--stone-800)] hover:shadow-lg"
              >
                Continue to Menu
              </button>
            </div>
          )}

          {step === 2 && guestOrders[currentGuestIndex] && (() => {
            const currentGuest = guestOrders[currentGuestIndex];
            return (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4">
                <div className="flex justify-between items-center border-b border-[var(--stone-200)] pb-4">
                  <div>
                    <h2 className="text-2xl font-light text-[var(--stone-900)]">Guest {currentGuestIndex + 1} of {guestCount}</h2>
                    <p className="text-2xl font-light text-[var(--stone-600)] mt-1">Room {roomNumber}</p>
                  </div>
                  <button onClick={prevGuest} className="text-sm font-medium text-[var(--stone-500)] hover:text-[var(--stone-900)] transition-colors self-start mt-1">
                    &larr; Back
                  </button>
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="block text-sm font-medium text-[var(--stone-800)] mb-2">Guest Name</label>
                    <DebouncedInput 
                      type="text" 
                      value={currentGuest.guestName}
                      onDebouncedChange={(val) => updateCurrentGuest({ guestName: val })}
                      className="w-full border-b border-[var(--stone-200)] pb-2 focus:border-[var(--accent-gold)] focus:outline-none bg-transparent transition-colors text-lg"
                      placeholder={`Guest ${currentGuestIndex + 1}`}
                    />
                  </div>

                  {!currentGuest.isPackedBreakfast ? (
                    <>
                      <section className="space-y-4">
                    <div className="flex justify-between items-end">
                      <h3 className="text-sm font-semibold text-[var(--stone-900)] uppercase tracking-widest">Starters</h3>
                      <button
                        onClick={() => {
                          const allSelected = currentGuest.selectedStarters.length === STARTERS.length;
                          updateCurrentGuest({ selectedStarters: allSelected ? [] : [...STARTERS] });
                        }}
                        className="text-xs text-[var(--accent-gold)] hover:text-[var(--stone-900)] transition-colors font-medium"
                      >
                        {currentGuest.selectedStarters.length === STARTERS.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-3">
                      {STARTERS.map((starter) => (
                        <div key={starter} className="flex flex-col">
                          <label onClick={() => toggleStarter(starter)} className="flex items-center space-x-3 cursor-pointer group">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${currentGuest.selectedStarters.includes(starter) ? 'bg-[var(--accent-gold)] border-[var(--accent-gold)]' : 'border-[var(--stone-200)] group-hover:border-[var(--accent-gold)]'}`}>
                              {currentGuest.selectedStarters.includes(starter) && <span className="text-white text-xs">✓</span>}
                            </div>
                            <span className="text-[var(--stone-900)] text-sm">{starter}</span>
                          </label>

                          {starter === "Fruit Platter" && currentGuest.selectedStarters.includes("Fruit Platter") && (
                            <div className="mt-2 pl-8 border-l-2 border-[var(--stone-100)] ml-2 animate-in fade-in slide-in-from-top-2">
                              <label className="flex items-center space-x-3 cursor-pointer group">
                                <div onClick={() => updateCurrentGuest({ isKidFruitPlatter: !currentGuest.isKidFruitPlatter })} className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${currentGuest.isKidFruitPlatter ? 'bg-[var(--accent-gold)] border-[var(--accent-gold)]' : 'border-[var(--stone-200)] group-hover:border-[var(--accent-gold)]'}`}>
                                  {currentGuest.isKidFruitPlatter && <span className="text-white text-[10px]">✓</span>}
                                </div>
                                <span className="text-[var(--stone-800)] text-sm" onClick={() => updateCurrentGuest({ isKidFruitPlatter: !currentGuest.isKidFruitPlatter })}>Kid&apos;s Portion</span>
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4">
                      <DebouncedInput 
                        type="text"
                        value={currentGuest.starterNotes}
                        onDebouncedChange={(val) => updateCurrentGuest({ starterNotes: val })}
                        className="w-full bg-white border border-[var(--stone-200)] rounded-xl py-3 px-4 text-sm text-[var(--stone-900)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)] focus:border-transparent transition-all shadow-sm"
                        placeholder="Any notes for starters? (e.g. No sugar, extra fruit)"
                      />
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex justify-between items-end">
                      <h3 className="text-sm font-semibold text-[var(--stone-900)] uppercase tracking-widest">Main Course</h3>
                      <button
                        onClick={() => {
                          const allSelected = currentGuest.selectedMains.length === MAINS.length;
                          updateCurrentGuest({ selectedMains: allSelected ? [] : [...MAINS] });
                        }}
                        className="text-xs text-[var(--accent-gold)] hover:text-[var(--stone-900)] transition-colors font-medium"
                      >
                        {currentGuest.selectedMains.length === MAINS.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      {MAINS.map((main) => (
                        <label key={main} onClick={() => toggleMain(main)} className="flex items-center space-x-3 cursor-pointer group">
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${currentGuest.selectedMains.includes(main) ? 'bg-[var(--accent-gold)] border-[var(--accent-gold)]' : 'border-[var(--stone-200)] group-hover:border-[var(--accent-gold)]'}`}>
                            {currentGuest.selectedMains.includes(main) && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className="text-[var(--stone-900)] text-sm">{main}</span>
                        </label>
                      ))}
                    </div>

                    {currentGuest.selectedMains.includes("Bread Toast") && (
                      <div className="bg-[var(--stone-50)] p-4 rounded-xl border border-[var(--stone-200)] mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-[var(--stone-800)]">Slices</label>
                          <div className="flex items-center space-x-3 bg-white rounded-lg p-1 border border-[var(--stone-100)]">
                            <button 
                              type="button"
                              onClick={() => updateCurrentGuest({ toastSlices: Math.max(1, currentGuest.toastSlices - 1) })}
                              className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--stone-600)] shadow-sm hover:text-[var(--stone-900)]"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-medium text-[var(--stone-900)]">{currentGuest.toastSlices}</span>
                            <button 
                              type="button"
                              onClick={() => updateCurrentGuest({ toastSlices: Math.min(10, currentGuest.toastSlices + 1) })}
                              className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--stone-600)] shadow-sm hover:text-[var(--stone-900)]"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex space-x-6 border-t border-[var(--stone-200)] pt-3">
                          <label className="flex items-center space-x-2 cursor-pointer group">
                            <div onClick={() => updateCurrentGuest({ includesButter: !currentGuest.includesButter })} className={`w-4 h-4 rounded border flex items-center justify-center ${currentGuest.includesButter ? 'bg-[var(--accent-gold)] border-[var(--accent-gold)]' : 'border-[var(--stone-300)]'}`}>
                              {currentGuest.includesButter && <span className="text-white text-[10px]">✓</span>}
                            </div>
                            <span className="text-sm text-[var(--stone-900)]" onClick={() => updateCurrentGuest({ includesButter: !currentGuest.includesButter })}>Butter</span>
                          </label>
                          
                          <label className="flex items-center space-x-2 cursor-pointer group">
                            <div onClick={() => updateCurrentGuest({ includesJam: !currentGuest.includesJam })} className={`w-4 h-4 rounded border flex items-center justify-center ${currentGuest.includesJam ? 'bg-[var(--accent-gold)] border-[var(--accent-gold)]' : 'border-[var(--stone-300)]'}`}>
                              {currentGuest.includesJam && <span className="text-white text-[10px]">✓</span>}
                            </div>
                            <span className="text-sm text-[var(--stone-900)]" onClick={() => updateCurrentGuest({ includesJam: !currentGuest.includesJam })}>Jam</span>
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-[var(--stone-100)]">
                      <label className="flex items-center space-x-3 cursor-pointer group mb-3">
                        <div onClick={() => updateCurrentGuest({ includesEggs: !currentGuest.includesEggs })} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${currentGuest.includesEggs ? 'bg-[var(--accent-gold)] border-[var(--accent-gold)]' : 'border-[var(--stone-200)]'}`}>
                          {currentGuest.includesEggs && <span className="text-white text-xs">✓</span>}
                        </div>
                        <span className="text-sm font-medium text-[var(--stone-800)]" onClick={() => updateCurrentGuest({ includesEggs: !currentGuest.includesEggs })}>Eggs</span>
                      </label>

                      {currentGuest.includesEggs && (
                        <div className="pl-8 border-l-2 border-[var(--stone-100)] ml-2 mb-4">
                          <select 
                            value={currentGuest.eggStyle}
                            onChange={(e) => updateCurrentGuest({ eggStyle: e.target.value as EggStyle })}
                            className="w-full appearance-none bg-white border border-[var(--stone-200)] rounded-xl py-2 px-4 text-sm text-[var(--stone-900)] mb-3 cursor-pointer"
                          >
                            {EGG_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                          </select>

                          {currentGuest.eggStyle === "Fried Egg" && (
                            <select 
                              value={currentGuest.friedEggStyle}
                              onChange={(e) => updateCurrentGuest({ friedEggStyle: e.target.value as FriedEggStyle })}
                              className="w-full appearance-none bg-[var(--stone-50)] border border-[var(--stone-200)] rounded-xl py-2 px-4 text-sm text-[var(--stone-900)] cursor-pointer mb-3"
                            >
                              {FRIED_EGG_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                            </select>
                          )}
                          <DebouncedInput 
                            type="text"
                            placeholder="Any notes for eggs? (e.g. Well done, soft boiled)"
                            value={currentGuest.eggNotes}
                            onDebouncedChange={(val) => updateCurrentGuest({ eggNotes: val })}
                            className="w-full bg-[var(--stone-50)] border border-[var(--stone-200)] rounded-xl py-2 px-4 text-sm text-[var(--stone-900)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)]"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-[var(--stone-100)]">
                      <label className="flex items-center space-x-3 cursor-pointer group mb-3">
                        <div onClick={() => updateCurrentGuest({ includesSriLankanMeals: !currentGuest.includesSriLankanMeals })} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${currentGuest.includesSriLankanMeals ? 'bg-[var(--accent-gold)] border-[var(--accent-gold)]' : 'border-[var(--stone-200)]'}`}>
                          {currentGuest.includesSriLankanMeals && <span className="text-white text-xs">✓</span>}
                        </div>
                        <span className="text-sm font-medium text-[var(--stone-800)]" onClick={() => updateCurrentGuest({ includesSriLankanMeals: !currentGuest.includesSriLankanMeals })}>Sri Lankan Meals <span className="text-[var(--stone-500)] font-normal text-xs ml-1">(Only Pre Order 8 hours)</span></span>
                      </label>

                      {currentGuest.includesSriLankanMeals && (
                        <div className="pl-8 border-l-2 border-[var(--stone-100)] ml-2 mb-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            {SRI_LANKAN_MAINS.map((main) => (
                              <label key={main} onClick={() => toggleMain(main)} className="flex items-center space-x-3 cursor-pointer group">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${currentGuest.selectedMains.includes(main) ? 'bg-[var(--accent-gold)] border-[var(--accent-gold)]' : 'border-[var(--stone-200)] group-hover:border-[var(--accent-gold)]'}`}>
                                  {currentGuest.selectedMains.includes(main) && <span className="text-white text-xs">✓</span>}
                                </div>
                                <span className="text-[var(--stone-900)] text-sm">{main}</span>
                              </label>
                            ))}
                          </div>
                          <DebouncedInput 
                            type="text"
                            placeholder="Any notes for Sri Lankan meals?"
                            value={currentGuest.sriLankanNotes}
                            onDebouncedChange={(val) => updateCurrentGuest({ sriLankanNotes: val })}
                            className="w-full bg-[var(--stone-50)] border border-[var(--stone-200)] rounded-xl py-2 px-4 text-sm text-[var(--stone-900)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)]"
                          />
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold text-[var(--stone-900)] uppercase tracking-widest">Beverage</h3>
                    <div>
                      <label className="flex items-center space-x-3 cursor-pointer group mb-3">
                        <div onClick={() => updateCurrentGuest({ includesBeverage: !currentGuest.includesBeverage })} className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${currentGuest.includesBeverage ? 'bg-[var(--accent-gold)] border-[var(--accent-gold)]' : 'border-[var(--stone-200)]'}`}>
                          {currentGuest.includesBeverage && <span className="text-white text-xs">✓</span>}
                        </div>
                        <span className="text-sm font-medium text-[var(--stone-800)]" onClick={() => updateCurrentGuest({ includesBeverage: !currentGuest.includesBeverage })}>Include Beverage</span>
                      </label>

                      {currentGuest.includesBeverage && (
                        <div className="pl-8 border-l-2 border-[var(--stone-100)] ml-2">
                          <select 
                            value={currentGuest.beverage}
                            onChange={(e) => updateCurrentGuest({ beverage: e.target.value as BeverageType })}
                            className="w-full appearance-none bg-white border border-[var(--stone-200)] rounded-xl py-2 px-4 text-sm text-[var(--stone-900)] mb-3 cursor-pointer"
                          >
                            {BEVERAGES.map(bev => <option key={bev} value={bev}>{bev}</option>)}
                          </select>
                          
                          <label className="flex items-center space-x-3 cursor-pointer group mb-3">
                            <div onClick={() => updateCurrentGuest({ beverageIncludesMilk: !currentGuest.beverageIncludesMilk })} className={`w-4 h-4 rounded border flex items-center justify-center ${currentGuest.beverageIncludesMilk ? 'bg-[var(--accent-gold)] border-[var(--accent-gold)]' : 'border-[var(--stone-300)]'}`}>
                              {currentGuest.beverageIncludesMilk && <span className="text-white text-[10px]">✓</span>}
                            </div>
                            <span className="text-sm text-[var(--stone-900)]" onClick={() => updateCurrentGuest({ beverageIncludesMilk: !currentGuest.beverageIncludesMilk })}>With Milk</span>
                          </label>
                        </div>
                      )}
                      
                      <div className="mt-3">
                        <DebouncedInput 
                          type="text"
                          placeholder="Any notes for beverages?"
                          value={currentGuest.beverageNotes}
                          onDebouncedChange={(val) => updateCurrentGuest({ beverageNotes: val })}
                          className="w-full bg-[var(--stone-50)] border border-[var(--stone-200)] rounded-xl py-2 px-4 text-sm text-[var(--stone-900)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)]"
                        />
                      </div>
                    </div>
                  </section>
                  </>
                  ) : (
                    <section className="space-y-6 animate-in fade-in slide-in-from-right-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--stone-900)] uppercase tracking-widest mb-3">Extras (Included by Default)</h3>
                        <div className="space-y-3">
                          <label className="flex items-center space-x-3 cursor-pointer group">
                            <input 
                              type="checkbox"
                              checked={currentGuest.packedIncludesBanana}
                              onChange={(e) => updateCurrentGuest({ packedIncludesBanana: e.target.checked })}
                              className="w-5 h-5 rounded border-[var(--stone-300)] text-[var(--accent-gold)] focus:ring-[var(--accent-gold)]"
                            />
                            <span className="text-[var(--stone-900)] text-sm">Banana (1)</span>
                          </label>
                          <label className="flex items-center space-x-3 cursor-pointer group">
                            <input 
                              type="checkbox"
                              checked={currentGuest.packedIncludesYoghurt}
                              onChange={(e) => updateCurrentGuest({ packedIncludesYoghurt: e.target.checked })}
                              className="w-5 h-5 rounded border-[var(--stone-300)] text-[var(--accent-gold)] focus:ring-[var(--accent-gold)]"
                            />
                            <span className="text-[var(--stone-900)] text-sm">Yoghurt (1)</span>
                          </label>
                          <label className="flex items-center space-x-3 cursor-pointer group">
                            <input 
                              type="checkbox"
                              checked={currentGuest.packedIncludesWater}
                              onChange={(e) => updateCurrentGuest({ packedIncludesWater: e.target.checked })}
                              className="w-5 h-5 rounded border-[var(--stone-300)] text-[var(--accent-gold)] focus:ring-[var(--accent-gold)]"
                            />
                            <span className="text-[var(--stone-900)] text-sm">Bottle of Water (1)</span>
                          </label>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--stone-900)] uppercase tracking-widest mb-4">Choose 1 Sandwich</h3>
                        <div className="space-y-3">
                          {PACKED_SANDWICHES.map(sandwich => (
                            <label key={sandwich} onClick={() => updateCurrentGuest({ packedSandwichChoice: sandwich })} className="flex items-center space-x-3 cursor-pointer group">
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${currentGuest.packedSandwichChoice === sandwich ? 'border-[var(--accent-gold)]' : 'border-[var(--stone-300)]'}`}>
                                {currentGuest.packedSandwichChoice === sandwich && <div className="w-3 h-3 rounded-full bg-[var(--accent-gold)]"></div>}
                              </div>
                              <span className="text-[var(--stone-900)] text-sm">{sandwich}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  <section>
                    <h3 className="text-sm font-semibold text-[var(--stone-900)] uppercase tracking-widest mb-2">Dietary Notes</h3>
                    <DebouncedTextarea 
                      value={currentGuest.dietaryNotes}
                      onDebouncedChange={(val) => updateCurrentGuest({ dietaryNotes: val })}
                      rows={2}
                      className="w-full bg-white border border-[var(--stone-200)] rounded-xl py-3 px-4 text-[var(--stone-900)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-gold)] resize-none"
                      placeholder="Any allergies or special requests?"
                    />
                  </section>
                </div>

                <button 
                  onClick={nextGuest}
                  className="w-full py-4 mt-8 rounded-xl bg-[var(--stone-900)] text-white font-medium tracking-widest uppercase transition-all shadow-md hover:bg-[var(--stone-800)] hover:shadow-lg"
                >
                  {currentGuestIndex < guestCount - 1 ? 'Next Guest' : 'Review Order'}
                </button>
              </div>
            );
          })()}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="flex justify-between items-center border-b border-[var(--stone-200)] pb-4">
                <div>
                  <h2 className="text-2xl font-light text-[var(--stone-900)]">Order Summary</h2>
                  <div className="flex items-center flex-wrap gap-2 mt-2">
                    <span className="text-[var(--stone-600)] text-sm">Room {roomNumber} •</span>
                    <input 
                      type="date"
                      value={breakfastDate}
                      onChange={(e) => setBreakfastDate(e.target.value)}
                      className="bg-[var(--stone-50)] border border-[var(--stone-200)] rounded-lg py-1 px-2 text-[var(--stone-700)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)] cursor-pointer"
                    />
                    <input 
                      type="time"
                      value={breakfastTime}
                      onChange={(e) => setBreakfastTime(e.target.value)}
                      className="bg-[var(--stone-50)] border border-[var(--stone-200)] rounded-lg py-1 px-2 text-[var(--stone-700)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)] cursor-pointer"
                    />
                  </div>
                </div>
                <button onClick={() => setStep(2)} className="text-sm font-medium text-[var(--stone-500)] hover:text-[var(--stone-900)] transition-colors">
                  &larr; Edit
                </button>
              </div>

              <div className="space-y-6">
                {guestOrders.map((order, idx) => (
                  <div key={idx} className="bg-[var(--stone-50)] rounded-2xl p-5 border border-[var(--stone-100)] relative group">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-[var(--stone-900)] text-lg">{order.guestName}</h3>
                      <button 
                        onClick={() => {
                          setCurrentGuestIndex(idx);
                          setStep(2);
                        }}
                        className="text-sm text-[var(--accent-gold)] hover:text-[var(--stone-900)] font-medium transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center space-x-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span>Edit</span>
                      </button>
                    </div>
                    
                    <div className="text-sm space-y-2 text-[var(--stone-700)]">
                      {order.isPackedBreakfast ? (
                        <>
                          <p><span className="font-medium text-[var(--stone-900)]">Type:</span> Packed Breakfast</p>
                          <p><span className="font-medium text-[var(--stone-900)]">Sandwich:</span> {order.packedSandwichChoice || 'None'}</p>
                          {(() => {
                            const extras = [];
                            if (order.packedIncludesBanana) extras.push("Banana");
                            if (order.packedIncludesYoghurt) extras.push("Yoghurt");
                            if (order.packedIncludesWater) extras.push("Water");
                            return extras.length > 0 ? (
                              <p className="text-xs text-[var(--stone-500)]">+ {extras.join(', ')}</p>
                            ) : null;
                          })()}
                        </>
                      ) : (
                        <>
                          {order.selectedStarters.length > 0 && (
                            <p><span className="font-medium text-[var(--stone-900)]">Starters:</span> {order.selectedStarters.map(s => s === "Fruit Platter" && order.isKidFruitPlatter ? "Fruit Platter (Kid's Portion)" : s).join(', ')}</p>
                          )}
                          {order.starterNotes && (
                            <p><span className="font-medium text-[var(--stone-900)]">Starters Note:</span> {order.starterNotes}</p>
                          )}
                          
                          {order.selectedMains.length > 0 && (
                            <p><span className="font-medium text-[var(--stone-900)]">Mains:</span> {order.selectedMains.map(m => m === 'Bread Toast' ? `Toast (${order.toastSlices} slices)` : m).join(', ')}</p>
                          )}
                          
                          {order.sriLankanNotes && (
                            <p className="text-amber-800 mt-1 mb-2 bg-amber-50 p-2 rounded"><span className="font-medium">SL Meals Note:</span> {order.sriLankanNotes}</p>
                          )}
                          
                          {order.includesEggs && (
                            <p><span className="font-medium text-[var(--stone-900)]">Eggs:</span> {order.eggStyle} {order.eggStyle === "Fried Egg" && `(${order.friedEggStyle})`} {order.eggNotes && <span className="text-sm italic text-[var(--stone-500)]">- {order.eggNotes}</span>}</p>
                          )}
                          
                          {(order.includesBeverage || order.beverageNotes) && (
                            <>
                              {order.includesBeverage && (
                                <p><span className="font-medium text-[var(--stone-900)]">Beverage:</span> {order.beverage} {order.beverageIncludesMilk ? '(With Milk)' : '(Black)'}</p>
                              )}
                              {order.beverageNotes && (
                                <p><span className="font-medium text-[var(--stone-900)]">Beverage Note:</span> {order.beverageNotes}</p>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {order.dietaryNotes && (
                        <p className="text-red-700 mt-2 bg-red-50 p-2 rounded"><span className="font-medium">Dietary Note:</span> {order.dietaryNotes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {orderType === 'packed' && (
                <div className="bg-white rounded-xl shadow-sm border border-[var(--stone-200)] p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-[var(--stone-900)] border-b border-[var(--stone-100)] pb-3">Driver Packed Breakfasts</h3>
                  <p className="text-sm text-[var(--stone-500)]">Add any packed breakfasts needed for drivers (1 Sandwich + Grab-and-Go Bag each).</p>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-4 bg-[var(--stone-50)] border border-[var(--stone-200)] rounded-xl p-2 w-max">
                      <button 
                        type="button"
                        onClick={() => setDriverPackedBreakfasts(prev => Math.max(0, prev - 1))}
                        className="w-10 h-10 rounded-lg flex items-center justify-center bg-white text-[var(--stone-800)] hover:bg-[var(--stone-100)] transition-colors shadow-sm"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-medium text-[var(--stone-900)]">{driverPackedBreakfasts}</span>
                      <button 
                        type="button"
                        onClick={() => setDriverPackedBreakfasts(prev => prev + 1)}
                        className="w-10 h-10 rounded-lg flex items-center justify-center bg-white text-[var(--stone-800)] hover:bg-[var(--stone-100)] transition-colors shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {driverPackedBreakfasts > 0 && (
                    <DebouncedTextarea
                      value={driverBreakfastNotes}
                      onDebouncedChange={(val) => setDriverBreakfastNotes(val)}
                      placeholder="Notes (e.g. 1 Chicken, 1 Cheese)"
                      className="w-full bg-[var(--stone-50)] border border-[var(--stone-200)] rounded-xl py-2 px-3 text-sm text-[var(--stone-900)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-gold)]"
                      rows={2}
                    />
                  )}
                </div>
              )}

              <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-sm text-green-800">
                Submitting will send this order to the kitchen and open WhatsApp so you can notify the staff group.
              </div>

              <button 
                onClick={submitOrder}
                disabled={isSubmitting}
                className={`w-full flex items-center justify-center py-4 mt-8 rounded-xl text-white font-medium tracking-widest uppercase transition-all shadow-md ${
                  isSubmitting ? 'bg-[#a8a29e] cursor-not-allowed' : (editMode ? 'bg-[var(--accent-gold)] hover:bg-[#c9a059] text-[var(--stone-900)]' : 'bg-green-600 hover:bg-green-700 hover:shadow-lg')
                }`}
              >
                {isSubmitting ? 'Processing...' : (editMode ? 'Update Order' : 'Confirm & Send to WhatsApp')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
