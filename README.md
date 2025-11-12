# ISLAI ARK - Glass Boat Business Management System

A production-ready business management system for glass boat operations in Ishigaki Island, Japan. Built with React, TypeScript, Firebase, and Tailwind CSS.

## Features

### Phase 1 - Core Operations

1. **Authentication & Authorization**
   - Email/password login with Firebase Auth
   - Role-based access control (Owner, Admin, Captain, Beach Staff, Reception)
   - Secondary password for Owner/Admin roles
   - Password reset functionality

2. **Dashboard**
   - Today's reservations overview
   - Monthly revenue tracking
   - Active staff count
   - Recent reservations list
   - Daily task checklist

3. **Boarding Management** (Critical Feature)
   - Date navigation
   - 3 boat tabs (カジ 20名, ムイ 26名, ティダ 12名)
   - Trip entries with passenger counts and revenue
   - Attendant assignment
   - Japanese language support indicator
   - Capacity warnings
   - Attendant summary
   - Auto-save every 30 seconds

4. **Reservations**
   - Date-based filtering
   - Status filtering (pending/confirmed/checked_in)
   - One-click check-in
   - RESERVA integration ready

5. **Shift Management**
   - Monthly calendar view
   - Horizontal scroll table
   - Shift symbols: 〇 (full day), 午前 (morning), 午後 (afternoon), 休 (off)
   - Car commute indicators
   - View-only for non-admin staff

6. **Time Clock System**
   - iPad mode: Staff selection grid with large touch targets
   - Personal mode: Request-based via Messages
   - Clock actions: 出勤/退勤/休憩開始/休憩終了
   - Car commute tracking
   - Recent activity feed

7. **Messages**
   - Conversation-based messaging
   - Quick request buttons (clock/vacation)
   - Admin approval system
   - Real-time message feed

8. **Weather Information**
   - Current conditions (Kabira Bay)
   - Wind speed and direction
   - Wave height
   - Tide information
   - 7-day forecast
   - UV index
   - Operation safety indicators

9. **Settings**
   - Account information
   - Theme switcher (Light/Dark/System)
   - Attendant list management
   - Pricing configuration
   - Boat capacity display

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS (utility-first)
- **Authentication**: Firebase Auth
- **Database**: Firebase Firestore
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Date Handling**: date-fns

## User Roles

| Role | Japanese | Access Level | Password |
|------|----------|--------------|----------|
| owner_executive | オーナー/エグゼクティブ | Full access | 0527 |
| admin | 管理者 | Full access | 0118 |
| captain | 船長 | Operations | - |
| beach_staff | 浜スタッフ | Operations support | - |
| reception | 受付 | Boarding & reservations | - |

## Test Accounts

```
Owner: owner@test.com / Test1234! (Role password: 0527)
Admin: admin@test.com / Test1234! (Role password: 0118)
Captain: captain@test.com / Test1234!
Beach Staff: beach@test.com / Test1234!
Reception: reception@test.com / Test1234!
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase account

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Firebase Setup

The Firebase configuration is already included in the project:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyArWXKkbh1-0VFc4ewQv3u9xQO_412o2MU",
  authDomain: "islai-ark-d6035.firebaseapp.com",
  projectId: "islai-ark-d6035",
  storageBucket: "islai-ark-d6035.firebasestorage.app",
  messagingSenderId: "555240021941",
  appId: "1:555240021941:web:e5f3b9b86f13845a7e83fc"
};
```

### Firestore Collections

The app uses the following Firestore collections:

- `users` - User profiles and roles
- `boarding` - Daily boarding data by date
- `reservations` - Reservation records
- `shifts` - Monthly shift schedules
- `timeClockEntries` - Time clock records
- `messages` - Message conversations
- `settings` - System settings (attendants, pricing)

## Design System

### Colors

- **Primary**: Teal-500 (#14b8a6)
- **Accent**: Yellow-500 (#eab308)
- **Background**: Navy-900 (#0c1e33) for dark mode
- **Text**: Gray-900 (light) / White (dark)

### Touch Targets

All interactive elements have a minimum touch target of 44x44px for mobile usability.

### Dark Mode

The app supports three theme modes:
- Light
- Dark
- System (follows OS preference)

Theme preference is persisted to localStorage.

## Mobile Optimization

- Mobile-first responsive design
- No horizontal zoom required
- Large touch targets (44px minimum)
- Horizontal scroll for wide tables
- Bottom navigation on mobile

## Key Features

### Auto-save
Boarding data auto-saves every 30 seconds to prevent data loss.

### Capacity Warnings
Red alerts appear when boat capacity is exceeded.

### Role-Based Navigation
Navigation items adjust based on user role permissions.

### Dark Mode Support
Full dark mode with persistent user preference.

### Japanese Language
All UI text is in Japanese for local staff.

## Development

### Project Structure

```
src/
├── components/       # Reusable components
│   ├── Layout.tsx
│   └── ProtectedRoute.tsx
├── contexts/        # React contexts
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── pages/           # Page components
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── BoardingManagement.tsx
│   ├── Reservations.tsx
│   ├── ShiftManagement.tsx
│   ├── TimeClock.tsx
│   ├── Messages.tsx
│   ├── Weather.tsx
│   └── Settings.tsx
├── lib/             # External integrations
│   └── firebase.ts
├── types/           # TypeScript types
│   └── index.ts
├── constants/       # App constants
│   └── index.ts
├── App.tsx
└── main.tsx
```

### Code Style

- TypeScript strict mode
- Functional components with hooks
- Tailwind CSS utility classes only
- No inline styles
- Mobile-first responsive design

## Production Deployment

The app is production-ready with:

- Optimized build output
- Code splitting
- Dark mode support
- Mobile optimization
- Error boundaries
- Loading states
- Form validation

## Support

For issues or questions, contact the development team.

## License

Proprietary - ISLAI ARK © 2024
