import { NextRequest, NextResponse } from "next/server";
import { Staff } from "@/types";

// In-memory store for staff members
// Initialized with some defaults
let staffMembers: Staff[] = [
  { name: "John", pin: "1111" },
  { name: "Sarah", pin: "2222" },
  { name: "Mike", pin: "3333" },
];

export async function GET() {
  return NextResponse.json({ staff: staffMembers });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.name || !body.pin) {
      return NextResponse.json({ error: "Missing name or pin" }, { status: 400 });
    }

    if (staffMembers.some(s => s.name.toLowerCase() === body.name.toLowerCase())) {
      return NextResponse.json({ error: "Staff member with this name already exists" }, { status: 400 });
    }

    const newStaff: Staff = {
      name: body.name,
      pin: body.pin
    };

    staffMembers.push(newStaff);

    return NextResponse.json({ success: true, staff: newStaff }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (!body.originalName || !body.name || !body.pin) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const index = staffMembers.findIndex(s => s.name === body.originalName);
    
    if (index === -1) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    // Check if new name already exists (and isn't the same person)
    if (body.name !== body.originalName && staffMembers.some(s => s.name.toLowerCase() === body.name.toLowerCase())) {
      return NextResponse.json({ error: "Staff member with new name already exists" }, { status: 400 });
    }

    staffMembers[index] = { name: body.name, pin: body.pin };

    return NextResponse.json({ success: true, staff: staffMembers[index] });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name');
    
    if (!name) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    staffMembers = staffMembers.filter(s => s.name !== name);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
