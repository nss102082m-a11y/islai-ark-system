export type UserRole = 'owner_executive' | 'admin' | 'captain' | 'beach_staff' | 'reception' | 'kiosk';

export interface UserPermissions {
  accountManagement: boolean;
  boardingManagement: 'edit' | 'view' | 'none';
  reservationManagement: 'edit' | 'view' | 'none';
  shiftManagement?: 'edit' | 'view' | 'none';
  messages: boolean;
  timeClocking: boolean;
  weatherInfo: boolean;
  reports: boolean;
  showInShift: boolean;
  bulkUpload?: boolean;
}

export interface User {
  uid: string;
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  employmentType: string;
  phone: string;
  joinDate: string;
  permissions?: UserPermissions;
  category?: string;
  knowledgeAccessLevel?: number;
  canDeleteKnowledge?: boolean;
  canEditKnowledge?: boolean;
}

export interface TripEntry {
  adult: number;
  child: number;
  infant: number;
  attendant: string;
  revenue: number;
  commission: number;
  profit: number;
  japaneseOk: boolean;
}

export interface Trip {
  time: string;
  entries: TripEntry[];
  capacityMode: 'A' | 'B';
  totalPassengers: number;
  revenue: number;
}

export interface AttendantPeriod {
  start: string;
  end: string;
  rate: number;
}

export interface AttendantPricing {
  attendant: string;
  periods: AttendantPeriod[];
  defaultRate: number;
}

export interface BoardingData {
  date: string;
  boats: {
    [boatName: string]: {
      trips: Trip[];
    };
  };
}

export type ShiftType = '〇' | '午前' | '午後' | '休';

export interface CruiseShipInfo {
  id: string;
  date: string;
  arrivalTime: string;
  departureTime: string;
  shipName: string;
  passengerCapacity: number;
  departurePort: string;
  previousPort: string;
}

export interface HelperStaff {
  id: string;
  name: string;
  category: string;
  schedule: {
    [day: string]: ShiftType;
  };
}

export interface Shift {
  month: string;
  schedule: {
    [userId: string]: {
      [day: string]: ShiftType;
    };
  };
  helpers?: HelperStaff[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface Message {
  id: string;
  conversationId: string;
  participants: string[];
  type: 'regular' | 'clock_request' | 'vacation_request';
  content: string;
  sender: string;
  timestamp: string;
  approved?: boolean;
  requestData?: any;
}

export interface TimeClockEntry {
  userId: string;
  timestamp: string;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  carCommute?: boolean;
}

export interface Reservation {
  id: string;
  name: string;
  time: string;
  date: string;
  adults: number;
  children: number;
  infants: number;
  status: 'pending' | 'confirmed' | 'checked_in';
  boat?: string;
}

export interface InitialTimes {
  kaji: string;
  mui: string;
  tida: string;
}

export interface SalesChannelPricing {
  adult: number;
  child: number;
  infant: number;
}

export interface SalesChannelPeriod {
  id: string;
  start: string;
  end: string;
  pricing: SalesChannelPricing;
}

export interface SalesChannel {
  id: string;
  name: string;
  category: string;
  pricing: SalesChannelPricing;
  commission?: {
    adult: number;
    child: number;
    infant: number;
  };
  periods: SalesChannelPeriod[];
}
