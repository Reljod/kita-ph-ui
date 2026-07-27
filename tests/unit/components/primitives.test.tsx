/**
 * Tests for the shadcn primitives and the app-wide provider tree.
 *
 * These are thin wrappers, so the cases are correspondingly thin — enough to
 * pin the contract each one exposes to the rest of the app: the button's
 * variant/size mapping and `asChild`, the dialog's open/close plumbing, and
 * that Providers really does supply both contexts.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Button, buttonVariants } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Providers } from '@/components/Providers';
import { cn } from '@/lib/utils';

describe('cn', () => {
    it('joins class names', () => {
        expect(cn('a', 'b')).toBe('a b');
    });

    it('drops falsy entries', () => {
        expect(cn('a', false && 'b', undefined)).toBe('a');
    });

    it('lets the later tailwind class win', () => {
        // This is the whole reason it is twMerge and not clsx: a variant class
        // has to be overridable by the className a caller passes.
        expect(cn('p-2', 'p-4')).toBe('p-4');
    });
});

describe('Button', () => {
    it('renders its label', () => {
        render(<Button>Save</Button>);
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('records the default variant', () => {
        render(<Button>Save</Button>);
        expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'default');
    });

    it('records an explicit variant', () => {
        render(<Button variant="destructive">Delete</Button>);
        expect(screen.getByRole('button')).toHaveAttribute('data-variant', 'destructive');
    });

    it('records the size', () => {
        render(<Button size="lg">Save</Button>);
        expect(screen.getByRole('button')).toHaveAttribute('data-size', 'lg');
    });

    it('takes a className override', () => {
        render(<Button className="w-full">Save</Button>);
        expect(screen.getByRole('button').className).toContain('w-full');
    });

    it('fires its handler', () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Save</Button>);
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalled();
    });

    it('does not fire while disabled', () => {
        const onClick = vi.fn();
        render(
            <Button disabled onClick={onClick}>
                Save
            </Button>
        );
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).not.toHaveBeenCalled();
    });

    it('renders as the child element when asked', () => {
        // Used to make a link look like a button without nesting one inside
        // the other, which is invalid HTML.
        // An external href here on purpose: an internal one belongs in a
        // next/link, and the lint rule that says so would fire on the test.
        render(
            <Button asChild>
                <a href="https://docs.example.test">Docs</a>
            </Button>
        );
        expect(screen.getByRole('link', { name: 'Docs' })).toBeInTheDocument();
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('exposes its variants for reuse', () => {
        expect(buttonVariants({ variant: 'ghost' })).toContain('hover:bg-muted');
    });
});

describe('Dialog', () => {
    function renderDialog(open = true) {
        const onOpenChange = vi.fn();
        render(
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Memory</DialogTitle>
                        <DialogDescription>Change the stored text.</DialogDescription>
                    </DialogHeader>
                    <p>body</p>
                    <DialogFooter>
                        <Button>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
        return { onOpenChange };
    }

    it('renders nothing when closed', () => {
        renderDialog(false);
        expect(screen.queryByText('body')).not.toBeInTheDocument();
    });

    it('shows its content when open', () => {
        renderDialog();
        expect(screen.getByText('body')).toBeInTheDocument();
    });

    it('is a dialog to assistive tech', () => {
        renderDialog();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('names itself', () => {
        renderDialog();
        expect(screen.getByRole('dialog')).toHaveAccessibleName('Edit Memory');
    });

    it('describes itself', () => {
        renderDialog();
        expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
            'Change the stored text.'
        );
    });

    it('offers a close control', () => {
        renderDialog();
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('reports a close', () => {
        const { onOpenChange } = renderDialog();
        fireEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('reports a close on escape', () => {
        const { onOpenChange } = renderDialog();
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('opens from a trigger', () => {
        const onOpenChange = vi.fn();
        render(
            <Dialog onOpenChange={onOpenChange}>
                <DialogTrigger>Open it</DialogTrigger>
                <DialogContent>
                    <DialogTitle>Edit Memory</DialogTitle>
                </DialogContent>
            </Dialog>
        );
        fireEvent.click(screen.getByText('Open it'));
        expect(onOpenChange).toHaveBeenCalledWith(true);
    });
});

describe('Providers', () => {
    it('renders what it wraps', () => {
        render(
            <Providers>
                <p>app</p>
            </Providers>
        );
        expect(screen.getByText('app')).toBeInTheDocument();
    });

    it('supplies a query client', async () => {
        // Without one, every page in the app throws on its first useQuery.
        const { useQuery } = await import('@tanstack/react-query');
        function Probe() {
            const { data } = useQuery({ queryKey: ['probe'], queryFn: async () => 'ok' });
            return <span>query:{data ?? 'pending'}</span>;
        }
        render(
            <Providers>
                <Probe />
            </Providers>
        );
        expect(await screen.findByText('query:ok')).toBeInTheDocument();
    });

    it('supplies the theme', async () => {
        const { useTheme } = await import('@/components/ThemeProvider');
        function Probe() {
            return <span>theme:{useTheme().theme}</span>;
        }
        render(
            <Providers>
                <Probe />
            </Providers>
        );
        expect(screen.getByText(/^theme:/)).toBeInTheDocument();
    });
});
