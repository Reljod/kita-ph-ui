/**
 * Tests for the chrome that wraps every authenticated page.
 *
 * The header owns logout and the theme toggle; the sidebar owns navigation and
 * has to say which page you are on. Both read from stores that persist across
 * a session, so each case resets them rather than trusting the previous one.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
const pathname = vi.fn(() => '/dashboard');
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push }),
    usePathname: () => pathname(),
}));

vi.mock('next/link', () => ({
    default: ({ children, href, ...rest }: React.ComponentProps<'a'>) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
}));

const { Header } = await import('@/components/layout/Header');
const { Sidebar } = await import('@/components/layout/Sidebar');
const { ThemeProvider, useTheme } = await import('@/components/ThemeProvider');
const { useAuthStore } = await import('@/store/useAuthStore');
const { useSidebarStore } = await import('@/store/useSidebarStore');

const A_USER = {
    id: 'u1',
    email: 'someone@example.com',
    name: 'Ada',
    org_id: 'org_1',
};

function renderHeader() {
    return render(
        <ThemeProvider>
            <Header />
        </ThemeProvider>
    );
}

beforeEach(() => {
    push.mockClear();
    pathname.mockReturnValue('/dashboard');
    localStorage.clear();
    document.documentElement.className = '';
    act(() => {
        useAuthStore.setState({ user: null, isAuthenticated: false });
        useSidebarStore.setState({ isOpen: false });
    });
});

describe('Header', () => {
    it('renders the product name', () => {
        renderHeader();
        expect(screen.getByText(/kita/i)).toBeInTheDocument();
    });

    it('shows the signed-in user', () => {
        act(() => {
            useAuthStore.setState({ user: A_USER as never, isAuthenticated: true });
        });
        renderHeader();
        expect(screen.getByText('Ada')).toBeInTheDocument();
    });

    it('falls back to a placeholder name before the store hydrates', () => {
        // The header renders on the first paint, before the persisted store
        // has rehydrated; an empty name there reads as a broken page.
        renderHeader();
        expect(screen.getByText('Developer')).toBeInTheDocument();
    });

    it('shows the user avatar when there is one', () => {
        act(() => {
            useAuthStore.setState({
                user: { ...A_USER, avatar: 'https://img/a.png' } as never,
                isAuthenticated: true,
            });
        });
        renderHeader();
        expect(screen.getByRole('img')).toHaveAttribute('src', 'https://img/a.png');
    });

    it('falls back to an icon when there is no avatar', () => {
        renderHeader();
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('toggles the sidebar', () => {
        renderHeader();
        fireEvent.click(screen.getByLabelText('Toggle sidebar'));
        expect(useSidebarStore.getState().isOpen).toBe(true);
    });

    describe('the account menu', () => {
        it('is closed initially', () => {
            renderHeader();
            expect(screen.queryByText('Logout')).not.toBeInTheDocument();
        });

        it('opens on the avatar', () => {
            renderHeader();
            fireEvent.click(screen.getByText('Developer'));
            expect(screen.getByText('Logout')).toBeInTheDocument();
        });

        it('shows the email', () => {
            act(() => {
                useAuthStore.setState({ user: A_USER as never, isAuthenticated: true });
            });
            renderHeader();
            fireEvent.click(screen.getByText('Ada'));
            expect(screen.getByText('someone@example.com')).toBeInTheDocument();
        });

        it('falls back to a placeholder email', () => {
            renderHeader();
            fireEvent.click(screen.getByText('Developer'));
            expect(screen.getByText('dev@local.com')).toBeInTheDocument();
        });

        it('closes on a second press', () => {
            renderHeader();
            fireEvent.click(screen.getByText('Developer'));
            fireEvent.click(screen.getAllByText('Developer')[0]);
            expect(screen.queryByText('Logout')).not.toBeInTheDocument();
        });

        it('closes when the backdrop is clicked', () => {
            renderHeader();
            fireEvent.click(screen.getByText('Developer'));
            fireEvent.click(document.querySelector('.fixed.inset-0')!);
            expect(screen.queryByText('Logout')).not.toBeInTheDocument();
        });
    });

    describe('logout', () => {
        beforeEach(() => {
            document.cookie = 'token=tok;path=/';
            document.cookie = 'refreshToken=refresh;path=/';
            act(() => {
                useAuthStore.setState({
                    user: A_USER as never,
                    isAuthenticated: true,
                });
            });
            renderHeader();
            fireEvent.click(screen.getByText('Ada'));
        });

        it('clears the session', () => {
            fireEvent.click(screen.getByText('Logout'));
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });

        it('forgets the user', () => {
            fireEvent.click(screen.getByText('Logout'));
            expect(useAuthStore.getState().user).toBeNull();
        });

        it('drops the token cookie', () => {
            // The token lives in a cookie, not in the store — leaving it
            // behind would let the middleware keep waving the user through.
            fireEvent.click(screen.getByText('Logout'));
            expect(document.cookie).not.toContain('token=tok');
        });

        it('drops the refresh token too', () => {
            // Clearing only the access token leaves a credential that can
            // mint a new one.
            fireEvent.click(screen.getByText('Logout'));
            expect(document.cookie).not.toContain('refreshToken=');
        });

        it('sends the user to the login page', () => {
            fireEvent.click(screen.getByText('Logout'));
            expect(push).toHaveBeenCalledWith('/login');
        });
    });

    describe('the theme toggle', () => {
        it('offers a sun while dark', () => {
            renderHeader();
            expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
        });

        it('switches the document class', () => {
            renderHeader();
            fireEvent.click(screen.getByLabelText('Toggle theme'));
            expect(document.documentElement.classList.contains('light')).toBe(true);
        });

        it('switches back', () => {
            renderHeader();
            fireEvent.click(screen.getByLabelText('Toggle theme'));
            fireEvent.click(screen.getByLabelText('Toggle theme'));
            expect(document.documentElement.classList.contains('dark')).toBe(true);
        });
    });
});

describe('Sidebar', () => {
    it('lists every destination', () => {
        render(<Sidebar />);
        ['Dashboard', 'Agents', 'Memory Vault', 'Knowledge Base', 'Tools'].forEach(
            (label) => expect(screen.getByText(label)).toBeInTheDocument()
        );
    });

    it('collapses to nothing when closed', () => {
        const { container } = render(<Sidebar />);
        expect(container.querySelector('aside')?.className).toContain('w-0');
    });

    it('expands when opened', () => {
        act(() => useSidebarStore.setState({ isOpen: true }));
        const { container } = render(<Sidebar />);
        expect(container.querySelector('aside')?.className).toContain('w-56');
    });

    it('closes itself', () => {
        act(() => useSidebarStore.setState({ isOpen: true }));
        render(<Sidebar />);
        fireEvent.click(screen.getByLabelText('Close sidebar'));
        expect(useSidebarStore.getState().isOpen).toBe(false);
    });

    it('marks the current page', () => {
        pathname.mockReturnValue('/memory');
        render(<Sidebar />);
        expect(screen.getByText('Memory Vault').closest('a')?.className).toContain(
            'text-indigo-700'
        );
    });

    it('marks the section a nested page belongs to', () => {
        // /agents/a1/chat is still the Agents section; losing the highlight
        // there makes the sidebar look broken on every detail page.
        pathname.mockReturnValue('/agents/a1/chat');
        render(<Sidebar />);
        expect(screen.getByText('Agents').closest('a')?.className).toContain(
            'text-indigo-700'
        );
    });

    it('does not mark a section by prefix alone', () => {
        // /knowledge-base must not light up /knowledge, and vice versa.
        pathname.mockReturnValue('/knowledge-base');
        render(<Sidebar />);
        expect(screen.getByText('Dashboard').closest('a')?.className).not.toContain(
            'text-indigo-700'
        );
    });
});

describe('useTheme', () => {
    function Probe() {
        const { theme } = useTheme();
        return <span>theme:{theme}</span>;
    }

    it('defaults to dark', () => {
        render(
            <ThemeProvider>
                <Probe />
            </ThemeProvider>
        );
        expect(screen.getByText('theme:dark')).toBeInTheDocument();
    });

    it('restores the stored preference', () => {
        localStorage.setItem('theme', 'light');
        render(
            <ThemeProvider>
                <Probe />
            </ThemeProvider>
        );
        expect(screen.getByText('theme:light')).toBeInTheDocument();
    });

    it('persists a change', () => {
        renderHeader();
        fireEvent.click(screen.getByLabelText('Toggle theme'));
        expect(localStorage.getItem('theme')).toBe('light');
    });

    it('refuses to run outside a provider', () => {
        // Silently returning a default would leave the toggle inert with no
        // clue why, so the hook throws instead.
        vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
    });
});
