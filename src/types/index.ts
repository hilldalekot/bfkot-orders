export type StarterType = 
  | "Mixed Fruit Juice"
  | "Fruit Platter"
  | "Cereal with Milk"
  | "Yoghurt"
  | "Waffles with Treacle"
  | "Cakes"
  | "Buns"
  | "Pastries";

export type MainCourseType = 
  | "Chicken Sausages"
  | "Bacon"
  | "Chicken Salami"
  | "Baked Beans"
  | "Bread Toast"
  | "Rice"
  | "Coconut Roty"
  | "Parata"
  | "Chapathi"
  | "Dhal Curry"
  | "Mix Veg Curry"
  | "Coconut Sambol"
  | "Egg Curry";

export type EggStyle = 
  | "Omelet"
  | "Cheese Omelet"
  | "Sri Lankan Omelet"
  | "Scrambled Eggs"
  | "Fried Egg"
  | "Boiled Eggs";

export type FriedEggStyle = 
  | "Sunny-Side Up"
  | "Over Easy"
  | "Over Medium"
  | "Over Hard";

export type BeverageType = "Ceylon Tea" | "Coffee";

export type PackedSandwichType = 
  | "Vegetable Sandwich"
  | "Egg Sandwich"
  | "Cheese & Tomato Sandwich"
  | "Chicken Sandwich"
  | "Bacon & Cheese Sandwich";

export type OrderStatus = "Pending" | "Preparing" | "Completed";

export interface Order {
  id: string;
  roomNumber: string;
  guestName: string;
  orderType?: 'dine-in' | 'packed';
  isPackedBreakfast?: boolean;
  packedSandwichChoice?: PackedSandwichType;
  driverPackedBreakfasts?: number;
  driverBreakfastNotes?: string;
  packedIncludesBanana?: boolean;
  packedIncludesYoghurt?: boolean;
  packedIncludesWater?: boolean;
  starters: StarterType[];
  starterNotes?: string;
  mains: MainCourseType[];
  toastSlices?: number;
  includesButter?: boolean;
  includesJam?: boolean;
  isKidFruitPlatter?: boolean;
  eggStyle?: EggStyle;
  friedEggStyle?: FriedEggStyle;
  beverage?: BeverageType;
  beverageIncludesMilk?: boolean;
  beverageNotes?: string;
  dietaryNotes?: string;
  sriLankanNotes?: string;
  eggNotes?: string;
  breakfastTime: string;
  status: OrderStatus;
  createdAt: string;
  staffName?: string;
  editedBy?: string;
  editedAt?: string;
}

export interface Staff {
  name: string;
  pin: string;
  role?: "F&B Staff" | "Kitchen Staff";
}
