import { NextRequest, NextResponse } from "next/server";
import { Order } from "@/types";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";

const COLLECTION_NAME = "orders";

export async function GET() {
  try {
    const q = query(collection(db, COLLECTION_NAME));
    const querySnapshot = await getDocs(q);
    
    const orders: Order[] = [];
    const now = new Date();
    
    const deletePromises: Promise<void>[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as Omit<Order, 'id'>;
      const orderId = docSnap.id;
      
      const bTime = new Date(data.breakfastTime);
      const createdTime = new Date(data.createdAt);
      
      // Cutoff based on breakfast date: 14:00 on the day of breakfast
      const cutoffBreakfast = new Date(bTime);
      cutoffBreakfast.setHours(14, 0, 0, 0);

      // Cutoff based on creation date: 14:00 on the day of creation, 
      // OR 14:00 the next day if created after 14:00.
      const cutoffCreated = new Date(createdTime);
      if (createdTime.getHours() >= 14) {
        cutoffCreated.setDate(cutoffCreated.getDate() + 1);
      }
      cutoffCreated.setHours(14, 0, 0, 0);
      
      const actualCutoff = cutoffBreakfast > cutoffCreated ? cutoffBreakfast : cutoffCreated;
      
      if (now > actualCutoff) {
        // Order expired, delete it from Firestore
        deletePromises.push(deleteDoc(doc(db, COLLECTION_NAME, orderId)));
      } else {
        orders.push({ id: orderId, ...data });
      }
    });

    await Promise.all(deletePromises);

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.roomNumber || !body.guestName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const orderData: Omit<Order, 'id'> = {
      roomNumber: body.roomNumber,
      guestName: body.guestName,
      starters: body.starters || [],
      mains: body.mains || [],
      toastSlices: body.toastSlices,
      includesButter: body.includesButter,
      includesJam: body.includesJam,
      isKidFruitPlatter: body.isKidFruitPlatter,
      eggStyle: body.eggStyle,
      friedEggStyle: body.friedEggStyle,
      beverage: body.beverage,
      beverageIncludesMilk: body.beverageIncludesMilk,
      orderType: body.orderType,
      isPackedBreakfast: body.isPackedBreakfast,
      packedSandwichChoice: body.packedSandwichChoice,
      driverPackedBreakfasts: body.driverPackedBreakfasts,
      driverBreakfastNotes: body.driverBreakfastNotes,
      dietaryNotes: body.dietaryNotes,
      breakfastTime: body.breakfastTime || new Date().toISOString(),
      staffName: body.staffName,
      status: "Pending",
      createdAt: new Date().toISOString(),
    };

    // Remove undefined fields for Firestore
    Object.keys(orderData).forEach(key => {
      if ((orderData as any)[key] === undefined) {
        delete (orderData as any)[key];
      }
    });

    const docRef = await addDoc(collection(db, COLLECTION_NAME), orderData);

    return NextResponse.json({ success: true, order: { id: docRef.id, ...orderData } }, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.id || !body.status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    const docRef = doc(db, COLLECTION_NAME, body.id);
    await updateDoc(docRef, { status: body.status });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomNumber = searchParams.get('roomNumber');
    
    if (!roomNumber) {
      return NextResponse.json({ error: "Missing roomNumber" }, { status: 400 });
    }

    const q = query(collection(db, COLLECTION_NAME), where("roomNumber", "==", roomNumber));
    const querySnapshot = await getDocs(q);
    
    const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, COLLECTION_NAME, docSnap.id)));
    await Promise.all(deletePromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting room orders:", error);
    return NextResponse.json({ error: "Failed to delete orders" }, { status: 500 });
  }
}
