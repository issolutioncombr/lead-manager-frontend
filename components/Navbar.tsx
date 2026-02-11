'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

import { BrandMark } from './BrandMark';
import { Loading } from './Loading';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';

type IconName =
  | 'dashboard'
  | 'users'
  | 'funnel'
  | 'calendar'
  | 'megaphone'
  | 'puzzle'
  | 'chart'
  | 'sparkles'
  | 'clock';

type LinkItem = { type: 'link'; href: string; label: string; icon: IconName };
type GroupItem = {
  type: 'group';
  label: string;
  icon: IconName;
  children: Array<{ href: string; label: string }>;
};
type NavItem = LinkItem | GroupItem;

const SIDEBAR_COLLAPSED_KEY = 'crm_sidebar_collapsed';

const BASE_ITEMS: NavItem[] = [
  { type: 'link', href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { type: 'link', href: '/leads', label: 'Leads', icon: 'funnel' },
  { type: 'link', href: '/conversations', label: 'Conversas', icon: 'users' },
  { type: 'link', href: '/mensagens-api', label: 'Mensagens API', icon: 'users' },
  { type: 'link', href: '/appointments', label: 'Video Chamadas', icon: 'calendar' },
  { type: 'link', href: '/integrations', label: 'Integrações', icon: 'puzzle' },
  { type: 'link', href: '/reports', label: 'Relatórios', icon: 'chart' },
  { type: 'link', href: '/reports/seller-appointments', label: 'Calls por vendedor', icon: 'chart' },
  {
    type: 'group',
    label: 'Automação',
    icon: 'sparkles',
    children: [
      { href: '/bot-controls', label: 'Botões e Webhooks' },
      { href: '/agent-prompt', label: 'Prompt do agente' },
      { href: '/prompts/manual', label: 'Prompt Manual' },
      { href: '/agent-prompt/reports', label: 'Relatórios Prompt' },
      { href: '/bot-actions', label: 'Acionar Botões' }
    ]
  },
  {
    type: 'group',
    label: 'Configurações',
    icon: 'users',
    children: [
      { href: '/sellers', label: 'Vendedores' },
      { href: '/seller-notes', label: 'Notas Seller' },
      { href: '/seller-reminders', label: 'Lembretes Seller' }
    ]
  }
];

function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="1" />
          <rect x="13" y="3" width="8" height="5" rx="1" />
          <rect x="13" y="10" width="8" height="11" rx="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 21c0-3.314 2.686-6 6-6s6 2.686 6 6" />
          <circle cx="17" cy="9" r="2" />
          <path d="M14.5 21c.4-1.9 1.9-3.5 4-4" />
        </svg>
      );
    case 'funnel':
      return (
        <svg {...common}>
          <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 9h16" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg {...common}>
          <path d="M3 11l12-5v12L3 13V11z" />
          <path d="M15 8h2a4 4 0 0 1 4 4 4 4 0 0 1-4 4h-2" />
          <path d="M3 13v4a3 3 0 0 0 3 3h2" />
        </svg>
      );
    case 'puzzle':
      return (
        <svg {...common}>
          <path d="M10 3h4a1 1 0 0 1 1 1v2a2 2 0 1 0 2 2h2a1 1 0 0 1 1 1v4h-3a2 2 0 1 0 0 4h3v4a1 1 0 0 1-1 1h-4v-3a2 2 0 1 0-4 0v3H6a1 1 0 0 1-1-1v-4H2a1 1 0 0 1-1-1v-4h3a2 2 0 1 0 0-4H1V4a1 1 0 0 1 1-1h4v3a2 2 0 1 0 4 0V3z" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <path d="M4 20V6M10 20V10M16 20v-7M21 20H3" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="M12 3v4M12 17v4M5.5 5.5l2.5 2.5M16 16l2.5 2.5M3 12h4M17 12h4M5.5 18.5l2.5-2.5M16 8l2.5-2.5" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.5 2.5" />
        </svg>
      );
    default:
      return null;
  }
}

const AccountDetails = ({
  label,
  name,
  email
}: {
  label: string;
  name?: string | null;
  email?: string | null;
}) => (
  <div>
    <p className="text-[11px] uppercase text-gray-400">{label}</p>
    <p className="font-semibold text-gray-700">{name ?? '—'}</p>
    <p className="text-gray-400">{email ?? '—'}</p>
  </div>
);

export const Navbar = () => {
  const pathname = usePathname();
  const { user, seller, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sellerLinkActive, setSellerLinkActive] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  });
  const [openGroupLabel, setOpenGroupLabel] = useState<string | null>(null);
  const hasRouteEffectMounted = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    if (!hasRouteEffectMounted.current) {
      hasRouteEffectMounted.current = true;
      return;
    }
    setMobileOpen(false);
    setOpenGroupLabel(null);
    setCollapsed(true);
  }, [pathname]);

  useEffect(() => {
    if (!seller) {
      setSellerLinkActive(false);
      return;
    }
    let cancelled = false;
    api
      .get<{ active: boolean }>('/sellers/me/video-call-link/active')
      .then((resp) => {
        if (cancelled) return;
        setSellerLinkActive(!!resp.data?.active);
      })
      .catch(() => {
        if (cancelled) return;
        setSellerLinkActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seller]);

  const navigationItems = useMemo<NavItem[]>(() => {
    const attendanceLink: LinkItem = {
      type: 'link',
      href: '/attendance',
      label: seller ? 'Atendimento' : 'Agenda dos vendedores',
      icon: 'clock'
    };

    if (seller) {
      const appointmentsFromBase = BASE_ITEMS.find(
        (item): item is LinkItem => item.type === 'link' && item.href === '/appointments'
      );

      const appointmentsLink: LinkItem =
        appointmentsFromBase ?? ({ type: 'link', href: '/appointments', label: 'Video Chamadas', icon: 'calendar' } as const);

      const sellerItems: NavItem[] = [
        appointmentsLink,
        attendanceLink,
        { type: 'link', href: '/seller-notes', label: 'Notas Seller', icon: 'chart' },
        { type: 'link', href: '/seller-reminders', label: 'Lembretes Seller', icon: 'clock' }
      ];
      if (sellerLinkActive) {
        sellerItems.push({ type: 'link', href: '/leads', label: 'Leads', icon: 'funnel' });
        sellerItems.push({ type: 'link', href: '/mensagens-api', label: 'Mensagens API', icon: 'users' });
      }
      return sellerItems;
    }

    const items: NavItem[] = BASE_ITEMS.map((item) => {
      if (item.type === 'link') return item;
      return { ...item, children: [...item.children] };
    });

    const appointmentsIndex = items.findIndex((item) => item.type === 'link' && item.href === '/appointments');
    if (appointmentsIndex >= 0) {
      items.splice(appointmentsIndex + 1, 0, attendanceLink);
    } else {
      items.push(attendanceLink);
    }

    const normalizedRole = String(user?.role ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
    const isSuperAdmin = normalizedRole === 'superadmin';
    const configIndex = items.findIndex((item) => item.type === 'group' && item.label === 'Configurações');
    if (isSuperAdmin && configIndex >= 0) {
      const configItem = items[configIndex];
      if (configItem.type === 'group') {
        configItem.children.push({ href: '/approvals', label: 'Aprovações' });
        configItem.children.push({ href: '/users', label: 'Usuários' });
        configItem.children.push({ href: '/admin', label: 'Admin (Super)' });
      }
    }

    const hiddenPrefixes = seller
      ? ['/sellers', '/agent-prompt', '/approvals', '/users']
      : [];

    const filteredItems = items
      .map((item) => {
        if (item.type === 'link') {
          return hiddenPrefixes.some((prefix) => item.href.startsWith(prefix)) ? null : item;
        }

        const filteredChildren = item.children.filter(
          (child) => !hiddenPrefixes.some((prefix) => child.href.startsWith(prefix))
        );
        if (!filteredChildren.length) return null;
        return { ...item, children: filteredChildren };
      })
      .filter(Boolean) as NavItem[];

    return filteredItems;
  }, [seller, sellerLinkActive, user?.role]);

  const isGroupActive = (group: GroupItem) => group.children.some((c) => pathname.startsWith(c.href));

  const handleLogout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    window.setTimeout(() => {
      logout();
    }, 400);
  };

  return (
    <>
      {/* Mobile header */}
      <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
        <button
          aria-label="Abrir menu"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
        >
          <span className="block h-0.5 w-5 bg-current"></span>
          <span className="mt-1.5 block h-0.5 w-5 bg-current"></span>
          <span className="mt-1.5 block h-0.5 w-5 bg-current"></span>
        </button>
        <BrandMark iconClassName="h-7 w-7 text-xs" titleClassName="text-base" showIcon={false} />
        <div className="w-7" />
      </header>

      {/* Mobile drawer */}
      <div className={clsx('fixed inset-0 z-50 md:hidden', mobileOpen ? 'block' : 'hidden')}>
        <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
        <aside
          className={clsx(
            'absolute left-0 top-0 h-full w-72 translate-x-0 border-r bg-white shadow-xl transition-transform',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex items-center gap-3 px-5 py-4">
            <BrandMark iconClassName="h-8 w-8 text-xs" titleClassName="text-lg" showIcon={false} />
            <button
              aria-label="Fechar menu"
              onClick={() => setMobileOpen(false)}
              className="ml-auto rounded-md p-2 text-gray-600 hover:bg-gray-100"
            >
              X
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2 text-sm text-gray-700">
            {navigationItems.map((item) => {
              if (item.type === 'link') {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      setMobileOpen(false);
                      setOpenGroupLabel(null);
                    }}
                    className={clsx(
                      'block rounded-md px-3 py-2 transition',
                      pathname.startsWith(item.href)
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-gray-100 hover:text-primary-dark'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon name={item.icon} className="h-5 w-5" />
                      <span>{item.label}</span>
                    </span>
                  </Link>
                );
              }
              const active = isGroupActive(item);
              const isOpen = openGroupLabel === item.label;
              return (
                <div key={item.label} className="rounded-md">
                  <button
                    type="button"
                    className={clsx(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
                      active ? 'bg-primary/10 text-primary' : 'text-gray-700'
                    )}
                    onClick={() => setOpenGroupLabel((current) => (current === item.label ? null : item.label))}
                  >
                    <Icon name={item.icon} className="h-5 w-5" />
                    <span className="font-semibold">{item.label}</span>
                    <span className="ml-auto text-gray-400">{isOpen ? '—' : '+'}</span>
                  </button>
                  {isOpen ? (
                    <div className="mt-1 space-y-1 pl-9">
                      {item.children.map((c) => (
                        <Link
                          key={c.href}
                          href={c.href}
                          onClick={() => {
                            setMobileOpen(false);
                            setOpenGroupLabel(null);
                          }}
                          className={clsx(
                            'block rounded-md px-3 py-2 text-sm transition',
                            pathname.startsWith(c.href)
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-gray-100 hover:text-primary-dark'
                          )}
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="mt-auto border-t px-4 py-4">
            <div className="mb-3 text-xs space-y-3">
              <AccountDetails label="Empresa" name={user?.name} email={user?.email} />
              {seller && (
                <div className="border-t border-dashed border-gray-200 pt-2">
                  <AccountDetails label="Vendedor" name={seller.name} email={seller.email} />
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={clsx(
                'w-full rounded-lg border border-primary px-3 py-2 text-xs font-semibold transition',
                isLoggingOut
                  ? 'cursor-not-allowed border-gray-300 bg-gray-200 text-gray-400'
                  : 'text-primary hover:bg-primary hover:text-white'
              )}
            >
              {isLoggingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </aside>
      </div>

      <aside
        className={clsx(
          'hidden shrink-0 border-r bg-white transition-all duration-200 md:sticky md:top-0 md:flex md:h-screen md:flex-col',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <div
          className={clsx(
            'py-4',
            collapsed ? 'flex flex-col items-center gap-2 px-2' : 'flex items-center justify-between px-5'
          )}
        >
          <BrandMark
            iconClassName="h-9 w-9 text-sm"
            titleClassName={collapsed ? 'hidden' : 'text-lg'}
            showIcon={collapsed}
          />
          <button
            type="button"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            onClick={() => setCollapsed((value) => !value)}
            className="rounded-md p-2 text-gray-600 hover:bg-gray-100"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              {collapsed ? <path d="M10 6l6 6-6 6" /> : <path d="M14 6l-6 6 6 6" />}
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2 text-sm text-gray-700">
          {navigationItems.map((item) => {
            if (item.type === 'link') {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={clsx(
                    'block rounded-md transition',
                    pathname.startsWith(item.href)
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-gray-100 hover:text-primary-dark',
                    collapsed ? 'px-2 py-2' : 'px-3 py-2'
                  )}
                  onClick={() => {
                    setCollapsed(true);
                    setOpenGroupLabel(null);
                  }}
                >
                  <span className={clsx('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
                    <Icon name={item.icon} className="h-5 w-5" />
                    <span className={clsx(collapsed ? 'hidden' : undefined)}>{item.label}</span>
                  </span>
                </Link>
              );
            }
            const active = isGroupActive(item);
            const isOpen = openGroupLabel === item.label;
            return (
              <div key={item.label} className="rounded-md">
                <button
                  type="button"
                  className={clsx(
                    'flex w-full items-center rounded-md transition',
                    active ? 'bg-primary/10 text-primary' : 'text-gray-700',
                    collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2'
                  )}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  onClick={() => {
                    if (collapsed) setCollapsed(false);
                    setOpenGroupLabel((current) => (current === item.label ? null : item.label));
                  }}
                >
                  <Icon name={item.icon} className="h-5 w-5" />
                  <span className={clsx('font-semibold', collapsed ? 'hidden' : undefined)}>{item.label}</span>
                  <span className={clsx('ml-auto text-gray-400', collapsed ? 'hidden' : undefined)}>
                    {isOpen ? '—' : '+'}
                  </span>
                </button>
                {!collapsed && isOpen ? (
                  <div className="mt-1 space-y-1 pl-9">
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={clsx(
                          'block rounded-md px-3 py-2 text-sm transition',
                          pathname.startsWith(c.href)
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-gray-100 hover:text-primary-dark'
                        )}
                        onClick={() => {
                          setCollapsed(true);
                          setOpenGroupLabel(null);
                        }}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className={clsx('mt-auto border-t py-4', collapsed ? 'px-2' : 'px-4')}>
          {!collapsed ? (
            <div className="mb-3 space-y-3 text-xs">
              <AccountDetails label="Empresa" name={user?.name} email={user?.email} />
              {seller && (
                <div className="border-t border-dashed border-gray-200 pt-2">
                  <AccountDetails label="Vendedor" name={seller.name} email={seller.email} />
                </div>
              )}
            </div>
          ) : null}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title="Sair"
            className={clsx(
              'rounded-lg border border-primary text-xs font-semibold transition',
              collapsed ? 'mx-auto flex h-10 w-10 items-center justify-center p-0' : 'w-full px-3 py-2',
              isLoggingOut
                ? 'cursor-not-allowed border-gray-300 bg-gray-200 text-gray-400'
                : 'text-primary hover:bg-primary hover:text-white'
            )}
          >
            {collapsed ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            ) : null}
            <span className={clsx(collapsed ? 'sr-only' : undefined)}>
              {isLoggingOut ? 'Saindo...' : 'Sair'}
            </span>
          </button>
        </div>
      </aside>

      {isLoggingOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <Loading />
        </div>
      )}
    </>
  );
};
