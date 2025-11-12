import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Ship,
  Calendar,
  Users,
  Clock,
  MessageSquare,
  Cloud,
  Settings,
  Menu,
  X,
  LogOut,
  BookOpen,
  FileText,
  Briefcase,
  Lock,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Home,
  Package
} from 'lucide-react';

interface NavSubItem {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  roles: string[];
}

interface NavGroup {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  type: 'group';
  items: NavSubItem[];
}

interface NavSingle {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  type: 'single';
  roles: string[];
}

type NavigationItem = NavGroup | NavSingle;

const navigationStructure: NavigationItem[] = [
  {
    id: 'dashboard',
    name: 'ダッシュボード',
    icon: LayoutDashboard,
    path: '/dashboard',
    type: 'single',
    roles: ['owner_executive', 'admin', 'captain', 'beach_staff', 'reception']
  },
  {
    id: 'operations',
    name: '業務管理',
    icon: Briefcase,
    type: 'group',
    items: [
      {
        name: '乗船管理',
        icon: Ship,
        path: '/boarding',
        roles: ['owner_executive', 'admin', 'reception']
      },
      {
        name: '予約管理',
        icon: Calendar,
        path: '/reservations',
        roles: ['owner_executive', 'admin', 'reception']
      },
      {
        name: 'シフト管理',
        icon: Users,
        path: '/shifts',
        roles: ['owner_executive', 'admin', 'captain', 'beach_staff', 'reception']
      },
      {
        name: '打刻システム',
        icon: Clock,
        path: '/time-clock',
        roles: ['owner_executive', 'admin']
      },
      {
        name: 'メッセージ',
        icon: MessageSquare,
        path: '/messages',
        roles: ['owner_executive', 'admin', 'captain', 'beach_staff', 'reception']
      },
      {
        name: '営業レポート',
        icon: FileText,
        path: '/daily-reports',
        roles: ['owner_executive', 'admin', 'captain', 'beach_staff', 'reception']
      },
      {
        name: '営業締め',
        icon: Lock,
        path: '/daily-closing',
        roles: ['owner_executive', 'admin']
      },
      {
        name: '一括アップロード',
        icon: Package,
        path: '/bulk-upload',
        roles: ['owner_executive', 'admin']
      }
    ]
  },
  {
    id: 'information',
    name: '情報管理',
    icon: BookOpen,
    type: 'group',
    items: [
      {
        name: 'ナレッジベース',
        icon: BookOpen,
        path: '/knowledge',
        roles: ['owner_executive', 'admin', 'captain', 'beach_staff', 'reception']
      },
      {
        name: '気象情報',
        icon: Cloud,
        path: '/weather',
        roles: ['owner_executive', 'admin', 'captain', 'beach_staff', 'reception']
      }
    ]
  },
  {
    id: 'system',
    name: 'システム',
    icon: Settings,
    type: 'group',
    items: [
      {
        name: '設定',
        icon: Settings,
        path: '/settings',
        roles: ['owner_executive', 'admin']
      }
    ]
  }
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['operations']);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-expanded-groups');
    if (saved) {
      try {
        setExpandedGroups(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved expanded groups', e);
      }
    }

    const savedCollapsed = localStorage.getItem('sidebar-collapsed');
    if (savedCollapsed !== null) {
      setIsSidebarCollapsed(savedCollapsed === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-expanded-groups', JSON.stringify(expandedGroups));
  }, [expandedGroups]);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const filterNavItems = (items: NavigationItem[]): NavigationItem[] => {
    if (!currentUser) return [];

    return items.filter(item => {
      if (item.type === 'single') {
        return item.roles.includes(currentUser.role);
      } else {
        const filteredSubItems = item.items.filter(subItem =>
          subItem.roles.includes(currentUser.role)
        );
        return filteredSubItems.length > 0;
      }
    }).map(item => {
      if (item.type === 'group') {
        return {
          ...item,
          items: item.items.filter(subItem =>
            subItem.roles.includes(currentUser.role)
          )
        };
      }
      return item;
    });
  };

  const filteredNavItems = filterNavItems(navigationStructure);

  const SidebarContent = () => (
    <nav className="flex-1 px-4 py-4 space-y-2">
      {filteredNavItems.map(item => {
        if (item.type === 'single') {
          return (
            <NavLink
              key={item.id}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                ${isSidebarCollapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-teal-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
              title={isSidebarCollapsed ? item.name : ''}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && (
                <span className="font-medium">{item.name}</span>
              )}
            </NavLink>
          );
        }

        const isExpanded = expandedGroups.includes(item.id);

        return (
          <div key={item.id}>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isSidebarCollapsed) {
                  toggleGroup(item.id);
                }
              }}
              className={`
                w-full flex items-center rounded-lg transition-colors
                ${isSidebarCollapsed ? 'justify-center px-4 py-3' : 'justify-between px-4 py-3'}
                text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
              `}
              title={isSidebarCollapsed ? item.name : ''}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!isSidebarCollapsed && (
                  <span className="font-medium">{item.name}</span>
                )}
              </div>
              {!isSidebarCollapsed && (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )
              )}
            </button>

            {!isSidebarCollapsed && isExpanded && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-4 transition-all duration-200 ease-in-out">
                {item.items.map(subItem => (
                  <NavLink
                    key={subItem.path}
                    to={subItem.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm
                      ${isActive
                        ? 'bg-teal-500 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    <subItem.icon className="w-4 h-4 flex-shrink-0" />
                    <span>{subItem.name}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Desktop Sidebar */}
      <aside className={`
        hidden md:flex md:flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        transition-all duration-300 ease-in-out
        ${isSidebarCollapsed ? 'md:w-20' : 'md:w-64'}
      `}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/11Tech and Nature Initiative Logo 'ISLAI ARK'.png"
              alt="ISLAI ARK Logo"
              className="w-10 h-10 object-contain flex-shrink-0"
            />
            <span className={`text-xl font-bold text-gray-900 dark:text-white transition-all duration-300 ${
              isSidebarCollapsed ? 'w-0 opacity-0' : 'opacity-100'
            }`}>
              ISLAI ARK
            </span>
          </div>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            title={isSidebarCollapsed ? 'サイドバーを展開' : 'サイドバーを折りたたむ'}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            )}
          </button>
        </div>

        <SidebarContent />

        <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSignOut}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${
              isSidebarCollapsed ? 'justify-center' : ''
            }`}
            title={isSidebarCollapsed ? 'ログアウト' : ''}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && (
              <span className="font-medium">ログアウト</span>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src="/11Tech and Nature Initiative Logo 'ISLAI ARK'.png"
              alt="ISLAI ARK Logo"
              className="w-8 h-8 object-contain"
            />
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              ISLAI ARK
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40 pt-[57px]"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="md:hidden fixed left-0 top-[57px] bottom-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 flex flex-col">
            <SidebarContent />
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">ログアウト</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-8 mt-[57px] md:mt-0">
          {children}
        </div>
      </main>
    </div>
  );
}
