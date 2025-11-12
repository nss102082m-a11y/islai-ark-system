export const BOAT_CAPACITY = {
  'カジ': 20,
  'ムイ': 26,
  'ティダ': 12
};

export const BOAT_NAMES = ['カジ', 'ムイ', 'ティダ'] as const;

export const INITIAL_ATTENDANTS = [
  'あいちゃん',
  'リンちゃん',
  'こたさん',
  '住住会計',
  'トーさん'
];

export const API_URL = 'https://script.google.com/macros/s/AKfycbyp3Q7cMbJURDnLJuVmwX1KFQ8ho7vcu6-lVGQyLj1akfiB32-7XsXP9Lvj491W564y/exec';

export const ROLE_PASSWORDS = {
  owner_executive: '0527',
  admin: '0118'
};

export const ROLE_LABELS: Record<string, string> = {
  owner_executive: 'オーナー/エグゼクティブ',
  admin: '管理者',
  captain: '船長',
  beach_staff: '浜スタッフ',
  reception: '受付',
  kiosk: '打刻端末'
};

export const DEFAULT_PERMISSIONS = {
  accountManagement: false,
  boardingManagement: 'none' as const,
  reservationManagement: 'none' as const,
  shiftManagement: 'none' as const,
  messages: false,
  timeClocking: false,
  weatherInfo: true,
  reports: false,
  showInShift: false,
  bulkUpload: false
};

export const ROLE_DEFAULT_PERMISSIONS: Record<string, typeof DEFAULT_PERMISSIONS> = {
  owner_executive: {
    accountManagement: true,
    boardingManagement: 'edit',
    reservationManagement: 'edit',
    shiftManagement: 'edit',
    messages: true,
    timeClocking: true,
    weatherInfo: true,
    reports: true,
    showInShift: false,
    bulkUpload: false
  },
  admin: {
    accountManagement: true,
    boardingManagement: 'edit',
    reservationManagement: 'edit',
    shiftManagement: 'edit',
    messages: true,
    timeClocking: true,
    weatherInfo: true,
    reports: true,
    showInShift: true,
    bulkUpload: false
  }
};
